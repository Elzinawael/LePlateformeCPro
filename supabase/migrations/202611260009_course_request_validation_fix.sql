-- ConduiPRO — course-request validation correction (draft)
-- Practical requests may be availability-based without a lesson_id.
-- Theory requests must target a module; optional preferred courses must belong to same school.

create or replace function public.validate_course_request_curriculum_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_school uuid;
  preferred_course_school uuid;
begin
  if new.request_type='theory' then
    if new.module_id is null then
      raise exception 'Theory requests require a module';
    end if;

    if new.practical_lesson_id is not null then
      raise exception 'Theory requests cannot reference a practical lesson';
    end if;

    select p.school_id into item_school
    from public.curriculum_modules m
    join public.curriculum_phases p on p.id=m.phase_id
    where m.id=new.module_id;

    if not found or (item_school is not null and item_school <> new.school_id) then
      raise exception 'Requested theory module must be global or belong to the same school';
    end if;
  elsif new.request_type='practical' then
    if new.module_id is not null then
      raise exception 'Practical requests cannot reference a theory module';
    end if;

    if new.availability_text is null or btrim(new.availability_text) = '' then
      raise exception 'Practical requests require availability text';
    end if;

    if new.practical_lesson_id is not null then
      select p.school_id into item_school
      from public.practical_lessons l
      join public.curriculum_phases p on p.id=l.phase_id
      where l.id=new.practical_lesson_id;

      if not found or (item_school is not null and item_school <> new.school_id) then
        raise exception 'Requested practical lesson must be global or belong to the same school';
      end if;
    end if;
  else
    raise exception 'Unsupported course request type';
  end if;

  if new.preferred_course_id is not null then
    select c.school_id into preferred_course_school
    from public.theory_courses c
    where c.id=new.preferred_course_id;

    if not found or preferred_course_school <> new.school_id then
      raise exception 'Preferred theory course must belong to the same school';
    end if;
  end if;

  return new;
end;
$$;
