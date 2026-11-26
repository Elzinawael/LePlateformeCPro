-- ConduiPRO V1 operating model:
-- one ConduiPRO platform administrator provisions school owners;
-- each school owner provisions their own students;
-- no employee or instructor login accounts are required.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to authenticated;

drop policy if exists platform_admins_self_select on public.platform_admins;
create policy platform_admins_self_select
on public.platform_admins
for select to authenticated
using (user_id = (select auth.uid()));

-- Register the existing ConduiPRO operator account as the first platform administrator.
insert into public.platform_admins (user_id, granted_by)
select id, id
from auth.users
where lower(email) = 'elzinawael@gmail.com'
on conflict (user_id) do nothing;

-- A school code is used to scope contract-number student logins.
alter table public.schools
  add column if not exists school_code text;

update public.schools
set school_code = 'CP-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where school_code is null or btrim(school_code) = '';

alter table public.schools
  alter column school_code set not null;

create unique index if not exists schools_school_code_unique_idx
  on public.schools (upper(school_code));

-- Practical lessons are assigned to a named school trainer, not to a login account.
alter table public.student_practical_progress
  add column if not exists instructor_name text;

create or replace function public.guard_practical_session_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_lesson_phase_id uuid;
  v_current_phase_id uuid;
  v_phase_active boolean;
  v_lesson_active boolean;
  v_is_instructor boolean;
  v_is_assigned boolean;
  v_trainer_key text;
begin
  if new.status = 'not_started' then
    if new.instructor_user_id is not null
       or nullif(btrim(new.instructor_name), '') is not null
       or new.scheduled_at is not null then
      raise exception 'Unscheduled practical progress cannot retain a trainer or scheduled time';
    end if;
    return new;
  end if;

  if new.status not in ('scheduled', 'in_progress', 'completed') then
    raise exception 'Unsupported practical progress scheduling state';
  end if;

  if new.scheduled_at is null
     or (new.instructor_user_id is null and nullif(btrim(new.instructor_name), '') is null) then
    raise exception 'A practical session requires a trainer name and a scheduled time';
  end if;

  select l.phase_id, l.is_active, p.is_active, s.current_phase_id
    into v_lesson_phase_id, v_lesson_active, v_phase_active, v_current_phase_id
  from public.practical_lessons l
  join public.curriculum_phases p on p.id = l.phase_id
  join public.students s on s.id = new.student_id and s.school_id = new.school_id
  where l.id = new.lesson_id;

  if not found then
    raise exception 'Student, lesson or curriculum phase not found for this school';
  end if;

  if v_lesson_phase_id is distinct from v_current_phase_id
     or v_lesson_active is not true
     or v_phase_active is not true then
    raise exception 'Only active practical lessons in the student current phase can be scheduled';
  end if;

  if new.instructor_user_id is not null then
    select exists (
      select 1
      from public.school_members m
      where m.school_id = new.school_id
        and m.user_id = new.instructor_user_id
        and m.role = 'instructor'
        and m.status = 'active'
    ) into v_is_instructor;

    if not v_is_instructor then
      raise exception 'The selected trainer account is not active in this school';
    end if;

    select exists (
      select 1
      from public.instructor_student_assignments a
      where a.school_id = new.school_id
        and a.student_id = new.student_id
        and a.instructor_user_id = new.instructor_user_id
        and a.active = true
    ) into v_is_assigned;

    if not v_is_assigned then
      raise exception 'The selected trainer account is not assigned to this student';
    end if;

    v_trainer_key := 'user:' || new.instructor_user_id::text;
  else
    new.instructor_name := btrim(new.instructor_name);
    v_trainer_key := 'school:' || new.school_id::text || ':trainer:' || lower(new.instructor_name);
  end if;

  if new.status = 'scheduled' and new.scheduled_at <= now() then
    raise exception 'A practical session must be scheduled in the future';
  end if;

  if new.status = 'scheduled' then
    perform pg_advisory_xact_lock(hashtextextended(v_trainer_key, 0));
    perform pg_advisory_xact_lock(hashtextextended('student:' || new.student_id::text, 0));

    if exists (
      select 1
      from public.student_practical_progress other
      where other.id <> new.id
        and other.status in ('scheduled', 'in_progress')
        and other.scheduled_at < new.scheduled_at + interval '55 minutes'
        and other.scheduled_at + interval '55 minutes' > new.scheduled_at
        and (
          (new.instructor_user_id is not null and other.instructor_user_id = new.instructor_user_id)
          or
          (new.instructor_user_id is null and other.instructor_user_id is null
            and other.school_id = new.school_id
            and lower(btrim(coalesce(other.instructor_name, ''))) = lower(new.instructor_name))
        )
    ) then
      raise exception 'The selected trainer already has a practical session during this time';
    end if;

    if exists (
      select 1
      from public.student_practical_progress other
      where other.id <> new.id
        and other.student_id = new.student_id
        and other.status in ('scheduled', 'in_progress')
        and other.scheduled_at < new.scheduled_at + interval '55 minutes'
        and other.scheduled_at + interval '55 minutes' > new.scheduled_at
    ) then
      raise exception 'The student already has a practical session during this time';
    end if;
  end if;

  return new;
end;
$function$;

-- Keep the demo appointment while removing its obsolete user-linked instructor account.
update public.student_practical_progress
set instructor_user_id = null,
    instructor_name = 'Moniteur de démonstration'
where instructor_user_id is not null;

-- Disable legacy demo accounts for admin/employee/instructor roles.
-- Historical Auth users are retained, but cannot pass active school-membership checks.
update public.school_members
set role = 'owner',
    status = 'disabled'
where role in ('admin', 'employee', 'instructor');

-- Remove obsolete instructor-to-student assignment fixtures; practical lessons stay scheduled.
delete from public.instructor_student_assignments;

update public.student_practical_progress
set instructor_user_id = null
where instructor_user_id is not null;

-- Only owner memberships are supported in this product version.
alter table public.school_members
  drop constraint if exists school_members_role_check;

alter table public.school_members
  add constraint school_members_role_check
  check (role = 'owner');

comment on table public.platform_admins is
  'ConduiPRO platform operators who provision and manage school tenants.';
comment on column public.schools.school_code is
  'Short unique school identifier used with a student contract number for portal login.';
