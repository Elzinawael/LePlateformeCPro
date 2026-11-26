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
