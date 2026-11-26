-- ConduiPRO — instructor/student assignment boundary (draft)
-- Apply only after migrations 001-003 have been reviewed and tested in a disposable DB.

create table if not exists public.instructor_student_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  instructor_user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (school_id, instructor_user_id, student_id)
);

create index if not exists instructor_assignments_active_idx
  on public.instructor_student_assignments(school_id, instructor_user_id, student_id)
  where active = true;

alter table public.instructor_student_assignments enable row level security;

create policy instructor_assignments_staff_select on public.instructor_student_assignments
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));

create policy instructor_assignments_instructor_self_select on public.instructor_student_assignments
for select to authenticated
using (instructor_user_id=auth.uid() and active=true);

create policy instructor_assignments_admin_insert on public.instructor_student_assignments
for insert to authenticated
with check (public.has_school_role(school_id,array['owner','admin','employee']));

create policy instructor_assignments_admin_update on public.instructor_student_assignments
for update to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));

create policy instructor_assignments_admin_delete on public.instructor_student_assignments
for delete to authenticated
using (public.has_school_role(school_id,array['owner','admin']));

-- Replace the broad instructor role in practical-progress policies.
drop policy if exists practical_progress_school_insert on public.student_practical_progress;
drop policy if exists practical_progress_school_update on public.student_practical_progress;

create policy practical_progress_staff_insert on public.student_practical_progress
for insert to authenticated
with check (public.has_school_role(school_id,array['owner','admin','employee']));

create policy practical_progress_instructor_insert_assigned on public.student_practical_progress
for insert to authenticated
with check (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_practical_progress.school_id
      and a.student_id=public.student_practical_progress.student_id
      and a.instructor_user_id=auth.uid()
      and a.active=true
  )
);

create policy practical_progress_staff_update on public.student_practical_progress
for update to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));

create policy practical_progress_instructor_update_assigned on public.student_practical_progress
for update to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_practical_progress.school_id
      and a.student_id=public.student_practical_progress.student_id
      and a.instructor_user_id=auth.uid()
      and a.active=true
  )
)
with check (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_practical_progress.school_id
      and a.student_id=public.student_practical_progress.student_id
      and a.instructor_user_id=auth.uid()
      and a.active=true
  )
);
