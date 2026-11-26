-- ConduiPRO — enforce SAAQ theory module 5 prerequisite.
-- Phase 1 module 5 is the driving school's theory evaluation.
-- Modules 1-4 must be completed before staff can record module 5 as completed.

create or replace function public.guard_phase_one_evaluation_completion()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_module_number integer;
  v_phase_number integer;
  v_previous_count integer;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select m.module_number, p.phase_number
    into v_module_number, v_phase_number
  from public.curriculum_modules m
  join public.curriculum_phases p on p.id = m.phase_id
  where m.id = new.module_id;

  if not found then
    raise exception 'Module or curriculum phase not found';
  end if;

  if v_phase_number = 1 and v_module_number = 5 then
    select count(distinct m.module_number)::integer
      into v_previous_count
    from public.curriculum_modules m
    join public.student_module_progress progress
      on progress.module_id = m.id
     and progress.student_id = new.student_id
     and progress.school_id = new.school_id
     and progress.status = 'completed'
    join public.curriculum_phases p on p.id = m.phase_id
    where p.id = (
      select phase_id
      from public.curriculum_modules
      where id = new.module_id
    )
      and m.module_number between 1 and 4;

    if v_previous_count <> 4 then
      raise exception 'Complete theory modules 1 through 4 before recording the Phase 1 evaluation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists student_module_progress_phase_one_evaluation_guard
  on public.student_module_progress;

create trigger student_module_progress_phase_one_evaluation_guard
before update of status on public.student_module_progress
for each row
execute function public.guard_phase_one_evaluation_completion();

revoke all on function public.guard_phase_one_evaluation_completion()
from public, anon, authenticated;
