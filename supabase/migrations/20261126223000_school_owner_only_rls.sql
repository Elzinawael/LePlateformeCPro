-- ConduiPRO — reduce every school-side RLS policy to the single School Owner role.
-- Platform operators remain controlled separately through public.platform_admins.
-- Student self-read policies are left unchanged.

do $owner_only$
declare
  item record;
  using_expression text;
  check_expression text;
  owner_array text := 'ARRAY[''owner''::text]';
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
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'private\.has_school_role'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'private\.has_school_role'
      )
  loop
    using_expression := item.using_expression;
    check_expression := item.check_expression;

    if using_expression is not null then
      using_expression := regexp_replace(
        using_expression,
        'ARRAY\[''owner''::text, ''admin''::text(, ''employee''::text)?\]',
        owner_array,
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
        'ARRAY\[''owner''::text, ''admin''::text(, ''employee''::text)?\]',
        owner_array,
        'g'
      );
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        item.polname, item.schema_name, item.table_name, check_expression
      );
    end if;
  end loop;
end;
$owner_only$;

-- Retire all instructor-account and employee-account policy paths.
drop policy if exists instructor_assignments_admin_delete on public.instructor_student_assignments;
drop policy if exists instructor_assignments_admin_insert on public.instructor_student_assignments;
drop policy if exists instructor_assignments_admin_update on public.instructor_student_assignments;
drop policy if exists instructor_assignments_staff_select on public.instructor_student_assignments;
drop policy if exists instructor_assignments_instructor_self_select on public.instructor_student_assignments;

drop policy if exists students_instructor_assigned_select on public.students;
drop policy if exists module_progress_instructor_assigned_select on public.student_module_progress;
drop policy if exists practical_progress_instructor_assigned_select on public.student_practical_progress;
drop policy if exists practical_progress_instructor_update_assigned on public.student_practical_progress;
drop policy if exists enrollments_instructor_assigned_select on public.theory_course_enrollments;

-- Membership provisioning and membership-role management stay server-side only.
drop policy if exists school_members_owner_admin_manage on public.school_members;

notify pgrst, 'reload schema';
