-- ConduiPRO — attach each scheduled practical outing to one instructor.
-- A practical slot lasts 55 minutes, consistent with the SAAQ curriculum.

alter table public.student_practical_progress
  add column if not exists instructor_user_id uuid
  references public.profiles(id) on delete set null;

create index if not exists practical_progress_instructor_schedule_idx
  on public.student_practical_progress (school_id, instructor_user_id, scheduled_at)
  where scheduled_at is not null
    and status in ('scheduled', 'in_progress');

drop policy if exists practical_progress_instructor_insert_assigned
  on public.student_practical_progress;

drop policy if exists practical_progress_instructor_assigned_select
  on public.student_practical_progress;

create policy practical_progress_instructor_assigned_select
on public.student_practical_progress
for select to authenticated
using (
  has_school_role(school_id, array['instructor']::text[])
  and instructor_user_id = (select auth.uid())
  and exists (
    select 1
    from public.instructor_student_assignments a
    where a.school_id = student_practical_progress.school_id
      and a.student_id = student_practical_progress.student_id
      and a.instructor_user_id = (select auth.uid())
      and a.active = true
  )
);

drop policy if exists practical_progress_instructor_update_assigned
  on public.student_practical_progress;

create policy practical_progress_instructor_update_assigned
on public.student_practical_progress
for update to authenticated
using (
  has_school_role(school_id, array['instructor']::text[])
  and instructor_user_id = (select auth.uid())
  and exists (
    select 1
    from public.instructor_student_assignments a
    where a.school_id = student_practical_progress.school_id
      and a.student_id = student_practical_progress.student_id
      and a.instructor_user_id = (select auth.uid())
      and a.active = true
  )
)
with check (
  has_school_role(school_id, array['instructor']::text[])
  and instructor_user_id = (select auth.uid())
  and exists (
    select 1
    from public.instructor_student_assignments a
    where a.school_id = student_practical_progress.school_id
      and a.student_id = student_practical_progress.student_id
      and a.instructor_user_id = (select auth.uid())
      and a.active = true
  )
);

create or replace function public.guard_practical_session_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_phase_id uuid;
  v_current_phase_id uuid;
  v_phase_active boolean;
  v_lesson_active boolean;
  v_is_instructor boolean;
  v_is_assigned boolean;
begin
  if new.instructor_user_id is null and new.scheduled_at is null then
    return new;
  end if;

  if new.instructor_user_id is null or new.scheduled_at is null then
    raise exception 'A practical session requires both an instructor and a scheduled time';
  end if;

  select l.phase_id, l.is_active, p.is_active, p.id, s.current_phase_id
    into v_phase_id, v_lesson_active, v_phase_active, v_phase_id, v_current_phase_id
  from public.practical_lessons l
  join public.curriculum_phases p on p.id = l.phase_id
  join public.students s on s.id = new.student_id and s.school_id = new.school_id
  where l.id = new.lesson_id;

  if not found then
    raise exception 'Student, lesson or curriculum phase not found for this school';
  end if;

  if v_phase_id <> v_current_phase_id or v_lesson_active is not true or v_phase_active is not true then
    raise exception 'Only active practical lessons in the student current phase can be scheduled';
  end if;

  select exists (
    select 1
    from public.school_members m
    where m.school_id = new.school_id
      and m.user_id = new.instructor_user_id
      and m.role = 'instructor'
      and m.status = 'active'
  )
  into v_is_instructor;

  if not v_is_instructor then
    raise exception 'The selected instructor is not active in this school';
  end if;

  select exists (
    select 1
    from public.instructor_student_assignments a
    where a.school_id = new.school_id
      and a.student_id = new.student_id
      and a.instructor_user_id = new.instructor_user_id
      and a.active = true
  )
  into v_is_assigned;

  if not v_is_assigned then
    raise exception 'The selected instructor is not assigned to this student';
  end if;

  if new.status = 'scheduled' and new.scheduled_at <= now() then
    raise exception 'A practical session must be scheduled in the future';
  end if;

  if new.status = 'scheduled' then
    perform pg_advisory_xact_lock(hashtextextended('instructor:' || new.instructor_user_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended('student:' || new.student_id::text, 0));

    if exists (
      select 1
      from public.student_practical_progress other
      where other.id <> new.id
        and other.instructor_user_id = new.instructor_user_id
        and other.status in ('scheduled', 'in_progress')
        and other.scheduled_at < new.scheduled_at + interval '55 minutes'
        and other.scheduled_at + interval '55 minutes' > new.scheduled_at
    ) then
      raise exception 'The selected instructor already has a practical session during this time';
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
$$;

drop trigger if exists student_practical_session_schedule_guard
  on public.student_practical_progress;

create trigger student_practical_session_schedule_guard
before insert or update of
  school_id, student_id, lesson_id, instructor_user_id, scheduled_at, status
on public.student_practical_progress
for each row
execute function public.guard_practical_session_schedule();

revoke all on function public.guard_practical_session_schedule()
from public, anon, authenticated;
