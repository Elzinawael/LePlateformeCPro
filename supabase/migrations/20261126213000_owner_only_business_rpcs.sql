-- Update business RPCs after moving role helpers into the private schema.
-- Only the school owner remains authorized to process student workflows.

create or replace function public.process_course_request(
  p_request_id uuid,
  p_status text,
  p_school_response text default null
)
returns void
language plpgsql
set search_path = pg_catalog, public, private, auth
as $function$
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

  if not private.has_school_role(
    v_request.school_id,
    array['owner']::text[]
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
    ) into v_existing;

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
$function$;

create or replace function public.review_student_permit(
  p_license_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language plpgsql
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_license public.student_licenses%rowtype;
  v_document public.student_documents%rowtype;
  v_reason text := nullif(btrim(p_rejection_reason), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported permit review status';
  end if;

  if p_rejection_reason is not null and char_length(p_rejection_reason) > 500 then
    raise exception 'Rejection reason exceeds 500 characters';
  end if;

  if p_status = 'rejected' and v_reason is null then
    raise exception 'A rejection reason is required';
  end if;

  select *
    into v_license
  from public.student_licenses
  where id = p_license_id
  for update;

  if not found then
    raise exception 'Permit record not found or not visible';
  end if;

  if not private.has_school_role(
    v_license.school_id,
    array['owner']::text[]
  ) then
    raise exception 'Insufficient school role';
  end if;

  if v_license.verification_status <> 'pending' then
    raise exception 'Permit has already been reviewed';
  end if;

  if v_license.document_path is null then
    raise exception 'Permit file path is missing';
  end if;

  select *
    into v_document
  from public.student_documents
  where school_id = v_license.school_id
    and student_id = v_license.student_id
    and storage_path = v_license.document_path
    and document_type = 'learner_permit'
  for update;

  if not found then
    raise exception 'Archived permit document metadata not found';
  end if;

  if v_document.status <> 'pending' then
    raise exception 'Permit document has already been reviewed';
  end if;

  update public.student_licenses
  set
    verification_status = p_status,
    verified_by = auth.uid(),
    verified_at = now(),
    rejection_reason = case when p_status = 'rejected' then v_reason else null end
  where id = v_license.id;

  update public.student_documents
  set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = case when p_status = 'rejected' then v_reason else null end
  where id = v_document.id;
end;
$function$;

notify pgrst, 'reload schema';
