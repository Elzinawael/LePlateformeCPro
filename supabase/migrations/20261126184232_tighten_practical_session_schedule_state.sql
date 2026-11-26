-- ConduiPRO — tighten the practical scheduling trigger state machine.
-- Unscheduled progress rows must have neither instructor nor scheduled time.
-- Scheduled/in-progress/completed rows must retain both values.

create or replace function public.guard_practical_session_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_lesson_phase_id uuid;
  v_current_phase_id uuid;
  v_phase_active boolean;
  v_lesson_active boolean;
  v_is_instructor boolean;
  v_is_assigned boolean;
begin
  if new.status in ('not_started') then
    if new.instructor_user_id is not null or new.scheduled_at is not null then
      raise exception 'Unscheduled practical progress cannot retain an instructor or scheduled time';
    end if;
    return new;
  end if;

  if new.status not in ('scheduled', 'in_progress', 'completed') then
    raise exception 'Unsupported practical progress scheduling state';
  end if;

  if new.instructor_user_id is null or new.scheduled_at is null then
    raise exception 'A practical session requires both an instructor and a scheduled time';
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

revoke all on function public.guard_practical_session_schedule()
from public, anon, authenticated;
