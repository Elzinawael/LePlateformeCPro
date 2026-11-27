-- Read-only acceptance guard for the ConduiPRO V1 operating model.
-- Run with: supabase db execute --file supabase/tests/operating_model_invariants.sql
-- This script raises an exception if a required production invariant is not met.

do $$
declare
  v_phases integer;
  v_modules integer;
  v_lessons integer;
  v_bucket_private boolean;
  v_table text;
begin
  if not exists (select 1 from public.platform_admins) then
    raise exception 'No platform administrator is configured';
  end if;

  if exists (select 1 from public.school_members where role <> 'owner') then
    raise exception 'Only owner school memberships are permitted in V1';
  end if;

  if to_regclass('public.instructor_student_assignments') is not null then
    raise exception 'Legacy instructor assignment table must not exist';
  end if;

  if to_regclass('public.conduipro_bootstrap_guard') is not null then
    raise exception 'Retired one-time bootstrap guard must not exist';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_practical_progress'
      and column_name in ('instructor_user_id', 'instructor_name')
  ) then
    raise exception 'Practical scheduling must not depend on an instructor account or trainer identity';
  end if;

  select count(*) into v_phases
  from public.curriculum_phases
  where school_id is null and is_active;

  select count(*) into v_modules
  from public.curriculum_modules m
  join public.curriculum_phases p on p.id = m.phase_id
  where p.school_id is null and m.is_active;

  select count(*) into v_lessons
  from public.practical_lessons l
  join public.curriculum_phases p on p.id = l.phase_id
  where p.school_id is null and l.is_active;

  if v_phases <> 4 or v_modules <> 12 or v_lessons <> 15 then
    raise exception 'Global PESR curriculum mismatch: phases %, modules %, lessons %',
      v_phases, v_modules, v_lessons;
  end if;

  foreach v_table in array array[
    'schools','school_members','students','student_module_progress',
    'student_practical_progress','course_requests','student_documents',
    'student_licenses','student_contracts','invoices','payments'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
    ) then
      raise exception 'Row-level security is not enabled on public.%', v_table;
    end if;
  end loop;

  select (not public) into v_bucket_private
  from storage.buckets
  where id = 'student-documents';

  if v_bucket_private is distinct from true then
    raise exception 'student-documents storage bucket must exist and remain private';
  end if;
end;
$$;

select
  'PASS' as result,
  'Platform admin + school owner + student; no staff/instructor accounts; 4 phases, 12 modules, 15 outings; RLS and private document storage verified.' as details;
