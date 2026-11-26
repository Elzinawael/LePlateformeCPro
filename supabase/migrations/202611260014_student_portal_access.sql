-- ConduiPRO — student portal read and document-submission access
-- Apply after 001-013 have passed in a disposable environment.
-- Students receive read-only access to their own financial/contract records and
-- the curriculum belonging to their current school. Instructors do not receive
-- access to private identity documents or financial contracts.

-- Remove assigned-instructor visibility from sensitive records.
drop policy if exists contracts_instructor_assigned_select on public.student_contracts;
drop policy if exists licenses_instructor_assigned_select on public.student_licenses;
drop policy if exists documents_instructor_assigned_select on public.student_documents;

-- A student can read only their own contract records.
drop policy if exists contracts_student_self_select on public.student_contracts;
create policy contracts_student_self_select
on public.student_contracts
for select to authenticated
using (student_id = (select public.current_student_id()));

-- Students can read their own invoices and payments, but cannot modify them.
drop policy if exists invoices_student_self_select on public.invoices;
create policy invoices_student_self_select
on public.invoices
for select to authenticated
using (student_id = (select public.current_student_id()));

drop policy if exists payments_student_self_select on public.payments;
create policy payments_student_self_select
on public.payments
for select to authenticated
using (student_id = (select public.current_student_id()));

-- Expose the school-specific curriculum to the linked student only.
drop policy if exists phases_student_school_select on public.curriculum_phases;
create policy phases_student_school_select
on public.curriculum_phases
for select to authenticated
using (
  school_id is not null
  and exists (
    select 1
    from public.students s
    where s.user_id = (select auth.uid())
      and s.school_id = curriculum_phases.school_id
  )
);

drop policy if exists modules_student_school_select on public.curriculum_modules;
create policy modules_student_school_select
on public.curriculum_modules
for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_phases p
    join public.students s
      on s.user_id = (select auth.uid())
    where p.id = curriculum_modules.phase_id
      and (p.school_id is null or p.school_id = s.school_id)
  )
);

drop policy if exists practical_lessons_student_school_select on public.practical_lessons;
create policy practical_lessons_student_school_select
on public.practical_lessons
for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_phases p
    join public.students s
      on s.user_id = (select auth.uid())
    where p.id = practical_lessons.phase_id
      and (p.school_id is null or p.school_id = s.school_id)
  )
);

-- Students may browse scheduled theory sessions for modules in their current phase.
drop policy if exists theory_courses_student_current_phase_select on public.theory_courses;
create policy theory_courses_student_current_phase_select
on public.theory_courses
for select to authenticated
using (
  status = 'scheduled'
  and exists (
    select 1
    from public.students s
    join public.curriculum_modules m on m.id = theory_courses.module_id
    join public.curriculum_phases p on p.id = m.phase_id
    where s.user_id = (select auth.uid())
      and s.school_id = theory_courses.school_id
      and s.current_phase_id = p.id
      and p.is_active = true
      and m.is_active = true
  )
);

-- Students can submit a pending permit/document record only for themselves.
-- File content is uploaded separately to the private Storage bucket.
drop policy if exists student_documents_student_insert on public.student_documents;
create policy student_documents_student_insert
on public.student_documents
for insert to authenticated
with check (
  student_id = (select public.current_student_id())
  and uploaded_by = (select auth.uid())
  and document_type = 'learner_permit'
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
  and exists (
    select 1
    from public.students s
    where s.id = student_documents.student_id
      and s.school_id = student_documents.school_id
      and s.user_id = (select auth.uid())
      and student_documents.storage_path like
        s.school_id::text || '/' || s.id::text || '/%'
      and exists (
        select 1
        from public.curriculum_phases phase_two
        join public.curriculum_modules milestone_module
          on milestone_module.phase_id = phase_two.id
         and milestone_module.module_number = 5
        join public.student_module_progress milestone_progress
          on milestone_progress.module_id = milestone_module.id
         and milestone_progress.student_id = s.id
         and milestone_progress.status = 'completed'
        where phase_two.id = s.current_phase_id
          and phase_two.phase_number = 2
      )
  )
);

drop policy if exists student_licenses_student_insert on public.student_licenses;
create policy student_licenses_student_insert
on public.student_licenses
for insert to authenticated
with check (
  student_id = (select public.current_student_id())
  and verification_status = 'pending'
  and verified_by is null
  and verified_at is null
  and rejection_reason is null
  and document_path is not null
  and exists (
    select 1
    from public.students s
    where s.id = student_licenses.student_id
      and s.school_id = student_licenses.school_id
      and s.user_id = (select auth.uid())
      and student_licenses.document_path like
        s.school_id::text || '/' || s.id::text || '/%'
      and exists (
        select 1
        from public.curriculum_phases phase_two
        join public.curriculum_modules milestone_module
          on milestone_module.phase_id = phase_two.id
         and milestone_module.module_number = 5
        join public.student_module_progress milestone_progress
          on milestone_progress.module_id = milestone_module.id
         and milestone_progress.student_id = s.id
         and milestone_progress.status = 'completed'
        where phase_two.id = s.current_phase_id
          and phase_two.phase_number = 2
      )
  )
);

-- One active permit review at a time; rejected records remain in the audit trail.
create unique index if not exists student_licenses_one_pending_per_student
  on public.student_licenses(student_id)
  where verification_status = 'pending';
