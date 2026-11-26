create or replace function public.validate_course_request_curriculum_school()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  student_school uuid;
  student_phase uuid;
  item_phase uuid;
  item_school uuid;
  item_active boolean;
  phase_active boolean;
  preferred_course_school uuid;
  preferred_course_module uuid;
  preferred_course_status text;
  preferred_course_start_at timestamptz;
  preferred_course_capacity integer;
  preferred_course_enrollments integer;
begin
  select s.school_id, s.current_phase_id
    into student_school, student_phase
  from public.students s
  where s.id = new.student_id;

  if not found or student_school <> new.school_id then
    raise exception 'Course request student must belong to the request school';
  end if;

  if new.student_message is not null and char_length(new.student_message) > 2000 then
    raise exception 'Student message exceeds 2000 characters';
  end if;

  if new.request_type = 'theory' then
    if new.module_id is null or new.practical_lesson_id is not null then
      raise exception 'Theory requests require one module and cannot reference a practical lesson';
    end if;

    select m.phase_id, p.school_id, m.is_active, p.is_active
      into item_phase, item_school, item_active, phase_active
    from public.curriculum_modules m
    join public.curriculum_phases p on p.id = m.phase_id
    where m.id = new.module_id;

    if not found then
      raise exception 'Requested theory module does not exist';
    end if;

    if item_school is not null and item_school <> new.school_id then
      raise exception 'Requested theory module belongs to another school';
    end if;

    if student_phase is null or item_phase <> student_phase then
      raise exception 'Students may request only modules in their current phase';
    end if;

    if item_active is not true or phase_active is not true then
      raise exception 'Requested theory module or phase is inactive';
    end if;

    if exists (
      select 1
      from public.student_module_progress p
      where p.student_id = new.student_id
        and p.module_id = new.module_id
        and p.status = 'completed'
    ) then
      raise exception 'Completed modules cannot be requested again';
    end if;

    if new.preferred_course_id is null then
      raise exception 'Theory requests require a selected session';
    end if;

    select c.school_id, c.module_id, c.status, c.start_at, c.capacity
      into preferred_course_school, preferred_course_module, preferred_course_status,
           preferred_course_start_at, preferred_course_capacity
    from public.theory_courses c
    where c.id = new.preferred_course_id;

    if not found
      or preferred_course_school <> new.school_id
      or preferred_course_module <> new.module_id
      or preferred_course_status <> 'scheduled'
      or preferred_course_start_at <= now() then
      raise exception 'Preferred course must be a future scheduled session for the requested module and school';
    end if;

    select count(*)::integer
      into preferred_course_enrollments
    from public.theory_course_enrollments e
    where e.course_id = new.preferred_course_id
      and e.status = 'enrolled';

    if preferred_course_enrollments >= preferred_course_capacity then
      raise exception 'Preferred theory session has no seats available';
    end if;

  elsif new.request_type = 'practical' then
    if new.module_id is not null then
      raise exception 'Practical requests cannot reference a theory module';
    end if;

    if new.preferred_course_id is not null then
      raise exception 'Practical requests cannot reference a theory course';
    end if;

    if new.availability_text is null
      or btrim(new.availability_text) = ''
      or char_length(new.availability_text) > 500 then
      raise exception 'Practical requests require availability text (maximum 500 characters)';
    end if;

    if new.practical_lesson_id is not null then
      select l.phase_id, p.school_id, l.is_active, p.is_active
        into item_phase, item_school, item_active, phase_active
      from public.practical_lessons l
      join public.curriculum_phases p on p.id = l.phase_id
      where l.id = new.practical_lesson_id;

      if not found then
        raise exception 'Requested practical lesson does not exist';
      end if;

      if item_school is not null and item_school <> new.school_id then
        raise exception 'Requested practical lesson belongs to another school';
      end if;

      if student_phase is null or item_phase <> student_phase then
        raise exception 'Students may request only practical lessons in their current phase';
      end if;

      if item_active is not true or phase_active is not true then
        raise exception 'Requested practical lesson or phase is inactive';
      end if;
    end if;
  else
    raise exception 'Unsupported course request type';
  end if;

  return new;
end;
$$;
