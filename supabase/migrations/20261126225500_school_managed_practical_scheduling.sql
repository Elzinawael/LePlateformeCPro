-- ConduiPRO V1: the school owner manages all practical lesson scheduling.
-- No employee/instructor login accounts or trainer assignments are part of this model.

drop trigger if exists student_practical_session_schedule_guard
  on public.student_practical_progress;

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
begin
  if new.status = 'not_started' then
    if new.scheduled_at is not null then
      raise exception 'An unstarted practical lesson cannot have a scheduled time';
    end if;
    return new;
  end if;

  if new.status not in ('scheduled', 'in_progress', 'completed') then
    raise exception 'Unsupported practical progress state';
  end if;

  if new.scheduled_at is null then
    raise exception 'A practical lesson requires a scheduled date and time';
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

  if new.status = 'scheduled' and new.scheduled_at <= now() then
    raise exception 'A practical session must be scheduled in the future';
  end if;

  if new.status = 'scheduled' then
    -- Prevent concurrent overlapping appointments for the same student.
    perform pg_advisory_xact_lock(hashtextextended('student:' || new.student_id::text, 0));

    if exists (
      select 1
      from public.student_practical_progress other
      where other.id <> new.id
        and other.student_id = new.student_id
        and other.status in ('scheduled', 'in_progress')
        and other.scheduled_at < new.scheduled_at + interval '55 minutes'
        and other.scheduled_at + interval '55 minutes' > new.scheduled_at
    ) then
      raise exception 'The student already has a practical lesson during this 55-minute time slot';
    end if;
  end if;

  return new;
end;
$function$;

create trigger student_practical_session_schedule_guard
before insert or update of school_id, student_id, lesson_id, scheduled_at, status
on public.student_practical_progress
for each row
execute function public.guard_practical_session_schedule();

revoke all on function public.guard_practical_session_schedule()
from public, anon, authenticated;

-- Remove obsolete instructor-account infrastructure. The table is confirmed empty.
drop table if exists public.instructor_student_assignments;

-- These columns were used only for instructor-account and trainer-name assignment.
-- Practical appointments are now owned and managed directly by the school.
alter table public.student_practical_progress
  drop column if exists instructor_user_id,
  drop column if exists instructor_name;

-- The one-time bootstrap endpoint is retired; all new schools are provisioned
-- by an authenticated platform administrator in /admin.
drop table if exists public.conduipro_bootstrap_guard;

comment on table public.student_practical_progress is
  'School-managed practical lesson progression and scheduling; no instructor account is required.';
