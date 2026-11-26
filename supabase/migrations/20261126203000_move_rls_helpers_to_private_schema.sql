-- Move internal RLS helpers out of the exposed public API schema.
-- Policies keep using the helpers, but signed-in clients can no longer call them
-- through /rest/v1/rpc/<function>.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_school_member(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.school_members sm
    where sm.school_id = target_school
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function private.has_school_role(target_school uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.school_members sm
    where sm.school_id = target_school
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role = any(allowed_roles)
  );
$$;

create or replace function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select s.id
  from public.students s
  where s.user_id = auth.uid()
  limit 1;
$$;

revoke all on function private.is_school_member(uuid) from public, anon, authenticated;
revoke all on function private.has_school_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.current_student_id() from public, anon, authenticated;

grant execute on function private.is_school_member(uuid) to authenticated;
grant execute on function private.has_school_role(uuid, text[]) to authenticated;
grant execute on function private.current_student_id() to authenticated;

do $migration$
declare
  item record;
  using_expression text;
  check_expression text;
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
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ '(has_school_role|is_school_member|current_student_id)'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '(has_school_role|is_school_member|current_student_id)'
      )
  loop
    using_expression := item.using_expression;
    check_expression := item.check_expression;

    if using_expression is not null then
      using_expression := regexp_replace(
        using_expression,
        '(^|[^[:alnum:]_.])(public\.)?has_school_role\(',
        '\1private.has_school_role(',
        'g'
      );
      using_expression := regexp_replace(
        using_expression,
        '(^|[^[:alnum:]_.])(public\.)?is_school_member\(',
        '\1private.is_school_member(',
        'g'
      );
      using_expression := regexp_replace(
        using_expression,
        '(^|[^[:alnum:]_.])(public\.)?current_student_id\(',
        '\1private.current_student_id(',
        'g'
      );
      execute format(
        'alter policy %I on %I.%I using (%s)',
        item.polname, item.schema_name, item.table_name, using_expression
      );
    end if;

    if check_expression is not null then
      check_expression := regexp_replace(
        check_expression,
        '(^|[^[:alnum:]_.])(public\.)?has_school_role\(',
        '\1private.has_school_role(',
        'g'
      );
      check_expression := regexp_replace(
        check_expression,
        '(^|[^[:alnum:]_.])(public\.)?is_school_member\(',
        '\1private.is_school_member(',
        'g'
      );
      check_expression := regexp_replace(
        check_expression,
        '(^|[^[:alnum:]_.])(public\.)?current_student_id\(',
        '\1private.current_student_id(',
        'g'
      );
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        item.polname, item.schema_name, item.table_name, check_expression
      );
    end if;
  end loop;
end;
$migration$;

-- Public wrappers are intentionally retained for rollback compatibility,
-- but they are no longer callable through the Data API.
revoke all on function public.is_school_member(uuid) from public, anon, authenticated;
revoke all on function public.has_school_role(uuid, text[]) from public, anon, authenticated;
revoke all on function public.current_student_id() from public, anon, authenticated;

notify pgrst, 'reload schema';
