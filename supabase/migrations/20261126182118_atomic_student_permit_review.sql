-- ConduiPRO — review and archive a learner permit atomically.
-- SECURITY INVOKER: both SELECT and UPDATE remain subject to the caller's RLS.

create or replace function public.review_student_permit(
  p_license_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
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

  if not public.has_school_role(
    v_license.school_id,
    array['owner', 'admin', 'employee']::text[]
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
$$;

revoke all on function public.review_student_permit(uuid, text, text) from public, anon;
grant execute on function public.review_student_permit(uuid, text, text) to authenticated;
