-- ConduiPRO — owner-only finance actions and storage helper hardening.

-- A school has at most one active training contract per student.
create unique index if not exists student_contracts_one_active_per_student_idx
  on public.student_contracts (school_id, student_id)
  where status = 'active';

-- Update school finance access to the new owner-only model.
alter policy contracts_school_delete on public.student_contracts
  using (private.has_school_role(school_id, array['owner']::text[]));
alter policy contracts_school_insert on public.student_contracts
  with check (private.has_school_role(school_id, array['owner']::text[]));
alter policy contracts_school_update on public.student_contracts
  using (private.has_school_role(school_id, array['owner']::text[]))
  with check (private.has_school_role(school_id, array['owner']::text[]));
alter policy contracts_staff_select on public.student_contracts
  using (private.has_school_role(school_id, array['owner']::text[]));
alter policy invoices_school_access on public.invoices
  using (private.has_school_role(school_id, array['owner']::text[]))
  with check (private.has_school_role(school_id, array['owner']::text[]));
alter policy payments_school_access on public.payments
  using (private.has_school_role(school_id, array['owner']::text[]))
  with check (private.has_school_role(school_id, array['owner']::text[]));

-- Replace storage policies that referenced public.has_school_role after it was
-- removed from the exposed Data API. Students retain access only to their own path.
alter policy conduipro_student_documents_read on storage.objects using (
  bucket_id = 'student-documents'
  and exists (
    select 1 from public.students s
    where s.id::text = (storage.foldername(name))[2]
      and s.school_id::text = (storage.foldername(name))[1]
      and (
        s.user_id = (select auth.uid())
        or private.has_school_role(s.school_id, array['owner']::text[])
      )
  )
);
alter policy conduipro_student_documents_upload on storage.objects with check (
  bucket_id = 'student-documents'
  and exists (
    select 1 from public.students s
    where s.id::text = (storage.foldername(name))[2]
      and s.school_id::text = (storage.foldername(name))[1]
      and (
        s.user_id = (select auth.uid())
        or private.has_school_role(s.school_id, array['owner']::text[])
      )
  )
);
alter policy conduipro_student_documents_update on storage.objects
using (
  bucket_id = 'student-documents'
  and exists (
    select 1 from public.students s
    where s.school_id::text = (storage.foldername(name))[1]
      and s.id::text = (storage.foldername(name))[2]
      and private.has_school_role(s.school_id, array['owner']::text[])
  )
)
with check (
  bucket_id = 'student-documents'
  and exists (
    select 1 from public.students s
    where s.school_id::text = (storage.foldername(name))[1]
      and s.id::text = (storage.foldername(name))[2]
      and private.has_school_role(s.school_id, array['owner']::text[])
  )
);
alter policy conduipro_student_documents_delete on storage.objects using (
  bucket_id = 'student-documents'
  and exists (
    select 1 from public.students s
    where s.school_id::text = (storage.foldername(name))[1]
      and s.id::text = (storage.foldername(name))[2]
      and private.has_school_role(s.school_id, array['owner']::text[])
  )
);

-- Atomic contract and matching invoice creation/update.
create or replace function public.save_student_contract(
  p_student_id uuid,
  p_contract_date date,
  p_contract_amount numeric,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_school_id uuid;
  v_contract_number text;
  v_contract_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_paid numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_contract_amount is null or p_contract_amount <= 0 or p_contract_amount > 1000000 then
    raise exception 'Contract amount must be greater than zero and within the permitted limit';
  end if;
  if p_due_date is not null and p_contract_date is not null and p_due_date < p_contract_date then
    raise exception 'Invoice due date cannot precede the contract date';
  end if;

  select s.school_id, s.contract_number
    into v_school_id, v_contract_number
  from public.students s
  where s.id = p_student_id
  for update;

  if not found then raise exception 'Student not found'; end if;
  if not private.has_school_role(v_school_id, array['owner']::text[]) then
    raise exception 'Insufficient school role';
  end if;

  select sc.id
    into v_contract_id
  from public.student_contracts sc
  where sc.school_id = v_school_id
    and sc.student_id = p_student_id
    and sc.status = 'active'
  order by sc.created_at desc
  limit 1
  for update;

  if v_contract_id is null then
    insert into public.student_contracts (
      school_id, student_id, contract_number, contract_date,
      contract_amount, currency, status
    )
    values (
      v_school_id, p_student_id, v_contract_number, p_contract_date,
      p_contract_amount, 'CAD', 'active'
    )
    returning id into v_contract_id;
  else
    update public.student_contracts
    set contract_number = v_contract_number,
        contract_date = p_contract_date,
        contract_amount = p_contract_amount,
        currency = 'CAD',
        status = 'active'
    where id = v_contract_id;
  end if;

  v_invoice_number := 'FAC-' || v_contract_number;
  select i.id
    into v_invoice_id
  from public.invoices i
  where i.school_id = v_school_id
    and i.invoice_number = v_invoice_number
  for update;

  if v_invoice_id is not null then
    select coalesce(sum(p.amount), 0)
      into v_paid
    from public.payments p
    where p.invoice_id = v_invoice_id;

    if v_paid > p_contract_amount then
      raise exception 'The contract amount cannot be lower than payments already recorded';
    end if;

    update public.invoices
    set subtotal = p_contract_amount,
        tax_amount = 0,
        total_amount = p_contract_amount,
        due_date = p_due_date,
        currency = 'CAD',
        status = case
          when v_paid >= p_contract_amount then 'paid'
          when v_paid > 0 then 'partially_paid'
          else 'issued'
        end
    where id = v_invoice_id;
  else
    insert into public.invoices (
      school_id, student_id, invoice_number, issue_date, due_date,
      subtotal, tax_amount, total_amount, currency, status, notes
    )
    values (
      v_school_id, p_student_id, v_invoice_number, coalesce(p_contract_date, current_date),
      p_due_date, p_contract_amount, 0, p_contract_amount, 'CAD', 'issued',
      'Facture de contrat de formation ConduiPRO'
    )
    returning id into v_invoice_id;
  end if;

  return v_contract_id;
end;
$function$;

-- Atomic payment registration with invoice-level locking and remaining-balance guard.
create or replace function public.record_student_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date default current_date,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_invoice public.invoices%rowtype;
  v_paid numeric(12,2);
  v_payment_id uuid;
  v_new_paid numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'Payment amount must be greater than zero and within the permitted limit';
  end if;
  if p_payment_method not in ('cash', 'debit', 'credit', 'transfer', 'other') then
    raise exception 'Unsupported payment method';
  end if;
  if p_reference is not null and char_length(p_reference) > 120 then
    raise exception 'Payment reference is too long';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Payment notes are too long';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if not private.has_school_role(v_invoice.school_id, array['owner']::text[]) then
    raise exception 'Insufficient school role';
  end if;
  if v_invoice.status not in ('issued', 'partially_paid', 'overdue') then
    raise exception 'This invoice cannot accept payments';
  end if;

  select coalesce(sum(p.amount),0)
    into v_paid
  from public.payments p
  where p.invoice_id = v_invoice.id;

  if p_amount > (v_invoice.total_amount - v_paid) then
    raise exception 'Payment exceeds the remaining invoice balance';
  end if;

  insert into public.payments (
    school_id, student_id, invoice_id, amount, payment_method,
    payment_date, reference, notes, recorded_by
  )
  values (
    v_invoice.school_id, v_invoice.student_id, v_invoice.id, p_amount, p_payment_method,
    coalesce(p_payment_date, current_date), nullif(btrim(p_reference), ''),
    nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_payment_id;

  v_new_paid := v_paid + p_amount;
  update public.invoices
  set status = case
    when v_new_paid >= total_amount then 'paid'
    else 'partially_paid'
  end
  where id = v_invoice.id;

  return v_payment_id;
end;
$function$;

revoke all on function public.save_student_contract(uuid, date, numeric, date) from public, anon;
revoke all on function public.record_student_payment(uuid, numeric, text, date, text, text) from public, anon;
grant execute on function public.save_student_contract(uuid, date, numeric, date) to authenticated;
grant execute on function public.record_student_payment(uuid, numeric, text, date, text, text) to authenticated;

notify pgrst, 'reload schema';
