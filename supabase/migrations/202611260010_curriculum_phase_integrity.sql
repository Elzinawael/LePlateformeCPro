-- ConduiPRO — curriculum uniqueness and student phase ownership (draft)
-- Adds correct uniqueness for global curriculum rows and validates student phase selection.
-- Apply after inspecting duplicate phase rows in the target database.

create unique index if not exists curriculum_phases_global_phase_number_unique
  on public.curriculum_phases(phase_number)
  where school_id is null;

create unique index if not exists curriculum_phases_school_phase_number_unique
  on public.curriculum_phases(school_id,phase_number)
  where school_id is not null;

create or replace function public.validate_student_phase_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  phase_school uuid;
begin
  if new.current_phase_id is null then
    return new;
  end if;

  select p.school_id into phase_school
  from public.curriculum_phases p
  where p.id=new.current_phase_id;

  if not found then
    raise exception 'Student phase does not exist';
  end if;

  if phase_school is not null and phase_school <> new.school_id then
    raise exception 'Student phase must be global or belong to the same school';
  end if;

  return new;
end;
$$;

drop trigger if exists students_phase_school_guard on public.students;
create trigger students_phase_school_guard
before insert or update of school_id,current_phase_id on public.students
for each row execute function public.validate_student_phase_school();
