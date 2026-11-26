-- ConduiPRO — add missing FK indexes and cache auth.uid() in RLS policy init plans.
-- The application currently has a small demo dataset; these indexes prepare common
-- tenant joins and FK maintenance for the expected production tables.

do $indexes$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      c.conrelid,
      c.conname,
      c.conrelid::regclass as table_name,
      (
        select string_agg(format('%I', a.attname), ', ' order by k.ordinality)
        from unnest(c.conkey) with ordinality k(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = k.attnum
      ) as columns_sql
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indisready
          and i.indnatts >= cardinality(c.conkey)
          and (
            select array_agg(i.indkey[g]::smallint order by g)
            from generate_series(0, cardinality(c.conkey) - 1) g
          ) = c.conkey
      )
    order by c.conrelid::regclass::text, c.conname
  loop
    index_name := 'idx_fk_' || substring(md5(fk.conrelid::regclass::text || ':' || fk.conname), 1, 16);
    execute format(
      'create index if not exists %I on %s (%s)',
      index_name, fk.table_name, fk.columns_sql
    );
  end loop;
end;
$indexes$;

do $rls_initplan$
declare
  item record;
  using_expression text;
  check_expression text;
  optimized_count integer := 0;
begin
  for item in
    select
      p.polname,
      n.nspname as schema_name,
      c.relname as table_name,
      pg_get_expr(p.polqual, p.polrelid) as using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and p.polname = any(array[
        'profiles_self_select',
        'students_instructor_assigned_select',
        'students_student_self_select',
        'module_progress_instructor_assigned_select',
        'enrollments_instructor_assigned_select',
        'messages_school_insert',
        'notifications_self_access',
        'instructor_assignments_instructor_self_select'
      ])
  loop
    using_expression := item.using_expression;
    check_expression := item.check_expression;

    if using_expression is not null and using_expression ~ 'auth\.uid\(\)' then
      using_expression := regexp_replace(
        using_expression,
        'auth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      execute format(
        'alter policy %I on %I.%I using (%s)',
        item.polname, item.schema_name, item.table_name, using_expression
      );
    end if;

    if check_expression is not null and check_expression ~ 'auth\.uid\(\)' then
      check_expression := regexp_replace(
        check_expression,
        'auth\.uid\(\)',
        '(select auth.uid())',
        'g'
      );
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        item.polname, item.schema_name, item.table_name, check_expression
      );
    end if;

    optimized_count := optimized_count + 1;
  end loop;
  raise notice 'Reviewed % RLS policies for auth.uid() init-plan optimization', optimized_count;
end;
$rls_initplan$;
