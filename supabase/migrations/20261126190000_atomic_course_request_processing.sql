-- ConduiPRO — atomically review a theory request and reserve a seat.
-- SECURITY INVOKER keeps the calling user's RLS policies in force.
create or replace function public.process_course_request(
  p_request_id uuid,
  p_status text,
  p_school_response text default null
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_request public.course_requests%rowtype;
  v_course public.theory_courses%rowtype;
  v_existing boolean;
  v_enrollment_count integer;
  v_response text := nullif(btrim(p_school_response), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('processing', 'approved', 'rejected') then
    raise exception 'Unsupported request status';
  end if;

  if p_school_response is not null and char_length(p_school_response) > 1000 then
    raise exception 'School response exceeds 1000 characters';
  end if;

  select *
    into v_request
  from public.course_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found or not visible';
  end if;

  if not public.has_school_role(
    v_request.school_id,
    array['owner', 'admin', 'employee']::text[]
  ) then
    raise exception 'Insufficient school role';
  end if;

  if v_request.status not in ('submitted', 'processing') then
    raise exception 'Request is already closed';
  end if;

  if p_status = 'rejected' and v_response is null then
    raise exception 'A response is required to reject a request';
  end if;

  if p_status = 'approved' and v_request.request_type = 'practical' and v_response is null then
    raise exception 'A response is required to approve a practical request';
  end if;

  if p_status = 'approved' and v_request.request_type = 'theory' then
    if v_request.preferred_course_id is null then
      raise exception 'The theory request has no selected session';
    end if;

    -- Serializes approvals for the same session, preventing the last seat
    -- from being assigned to more than one student at a time.
    select *
      into v_course
    from public.theory_courses
    where id = v_request.preferred_course_id
      and school_id = v_request.school_id
      and module_id = v_request.module_id
    for update;

    if not found
      or v_course.status <> 'scheduled'
      or v_course.start_at <= now() then
      raise exception 'The selected session is no longer available';
    end if;

    select exists (
      select 1
      from public.theory_course_enrollments e
      where e.course_id = v_course.id
        and e.student_id = v_request.student_id
        and e.status = 'enrolled'
    )
    into v_existing;

    if not v_existing then
      select count(*)::integer
        into v_enrollment_count
      from public.theory_course_enrollments e
      where e.course_id = v_course.id
        and e.status = 'enrolled';

      if v_enrollment_count >= v_course.capacity then
        raise exception 'The selected session is full';
      end if;

      insert into public.theory_course_enrollments
        (school_id, student_id, course_id, status)
      values
        (v_request.school_id, v_request.student_id, v_course.id, 'enrolled')
      on conflict (course_id, student_id) do nothing;
    end if;
  end if;

  update public.course_requests
  set
    status = p_status,
    school_response = v_response,
    processed_by = auth.uid(),
    processed_at = now()
  where id = v_request.id;
end;
$$;

revoke all on function public.process_course_request(uuid, text, text) from public, anon;
grant execute on function public.process_course_request(uuid, text, text) to authenticated;
