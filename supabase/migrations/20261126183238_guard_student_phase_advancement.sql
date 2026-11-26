-- ConduiPRO — enforce SAAQ minimum time and completion before phase progression.

alter table public.students
  add column if not exists current_phase_started_at timestamptz not null default now();

create or replace function public.guard_student_phase_advancement()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_old_phase public.curriculum_phases%rowtype;
  v_new_phase public.curriculum_phases%rowtype;
  v_minimum_days integer;
  v_module_total integer;
  v_module_completed integer;
  v_lesson_total integer;
  v_lesson_completed integer;
begin
  if new.current_phase_id is not distinct from old.current_phase_id then
    if new.current_phase_started_at is distinct from old.current_phase_started_at then
      raise exception 'Phase start date cannot be edited directly';
    end if;
    return new;
  end if;

  if old.current_phase_id is null or new.current_phase_id is null then
    raise exception 'A student phase cannot be cleared';
  end if;

  select * into v_old_phase
  from public.curriculum_phases
  where id = old.current_phase_id;

  select * into v_new_phase
  from public.curriculum_phases
  where id = new.current_phase_id;

  if not found or v_old_phase.id is null then
    raise exception 'Current or target curriculum phase not found';
  end if;

  if v_old_phase.school_id is not null and v_old_phase.school_id <> old.school_id then
    raise exception 'Current phase belongs to another school';
  end if;

  if v_new_phase.school_id is not null and v_new_phase.school_id <> new.school_id then
    raise exception 'Target phase belongs to another school';
  end if;

  if v_new_phase.phase_number <> v_old_phase.phase_number + 1 then
    raise exception 'Students can advance only to the next phase';
  end if;

  case v_old_phase.phase_number
    when 1 then v_minimum_days := 28;
    when 2 then v_minimum_days := 28;
    when 3 then v_minimum_days := 56;
    else raise exception 'The final phase cannot be advanced further';
  end case;

  if old.current_phase_started_at + make_interval(days => v_minimum_days) > now() then
    raise exception 'The minimum time for this phase has not elapsed';
  end if;

  select count(*)::integer into v_module_total
  from public.curriculum_modules m
  where m.phase_id = v_old_phase.id and m.is_active;

  select count(distinct m.id)::integer into v_module_completed
  from public.curriculum_modules m
  join public.student_module_progress progress
    on progress.module_id = m.id
   and progress.student_id = old.id
   and progress.school_id = old.school_id
   and progress.status = 'completed'
  where m.phase_id = v_old_phase.id and m.is_active;

  select count(*)::integer into v_lesson_total
  from public.practical_lessons l
  where l.phase_id = v_old_phase.id and l.is_active;

  select count(distinct l.id)::integer into v_lesson_completed
  from public.practical_lessons l
  join public.student_practical_progress progress
    on progress.lesson_id = l.id
   and progress.student_id = old.id
   and progress.school_id = old.school_id
   and progress.status = 'completed'
  where l.phase_id = v_old_phase.id and l.is_active;

  if v_module_completed <> v_module_total then
    raise exception 'All active theory modules in the current phase must be completed';
  end if;

  if v_lesson_completed <> v_lesson_total then
    raise exception 'All active practical outings in the current phase must be completed';
  end if;

  new.current_phase_started_at := now();
  return new;
end;
$$;

drop trigger if exists students_phase_progression_guard on public.students;
create trigger students_phase_progression_guard
before update of current_phase_id, current_phase_started_at
on public.students
for each row
execute function public.guard_student_phase_advancement();

revoke all on function public.guard_student_phase_advancement()
from public, anon, authenticated;
