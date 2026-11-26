-- ConduiPRO — align learner permit authorization with official PESR
-- The learner permit is obtained after the Phase 1 theory evaluation (module 5),
-- before Phase 2 road outings. Require all five Phase 1 modules to be complete.

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
        from public.curriculum_phases global_phase_one
        left join public.curriculum_phases school_phase_one
          on school_phase_one.school_id = s.school_id
         and school_phase_one.phase_number = 1
        join public.curriculum_modules milestone_module
          on milestone_module.phase_id = coalesce(school_phase_one.id, global_phase_one.id)
         and milestone_module.module_number between 1 and 5
        join public.student_module_progress milestone_progress
          on milestone_progress.module_id = milestone_module.id
         and milestone_progress.student_id = s.id
         and milestone_progress.school_id = s.school_id
         and milestone_progress.status = 'completed'
        where global_phase_one.school_id is null
          and global_phase_one.phase_number = 1
        group by global_phase_one.id, school_phase_one.id
        having count(distinct milestone_module.module_number) = 5
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
        from public.curriculum_phases global_phase_one
        left join public.curriculum_phases school_phase_one
          on school_phase_one.school_id = s.school_id
         and school_phase_one.phase_number = 1
        join public.curriculum_modules milestone_module
          on milestone_module.phase_id = coalesce(school_phase_one.id, global_phase_one.id)
         and milestone_module.module_number between 1 and 5
        join public.student_module_progress milestone_progress
          on milestone_progress.module_id = milestone_module.id
         and milestone_progress.student_id = s.id
         and milestone_progress.school_id = s.school_id
         and milestone_progress.status = 'completed'
        where global_phase_one.school_id is null
          and global_phase_one.phase_number = 1
        group by global_phase_one.id, school_phase_one.id
        having count(distinct milestone_module.module_number) = 5
      )
  )
);

-- Trigger functions are invoked by table triggers, not by REST RPC callers.
-- Remove direct execution rights from anon/authenticated for these helpers.
revoke all on function public.guard_profile_account_type() from public, anon, authenticated;
revoke all on function public.validate_course_request_curriculum_school() from public, anon, authenticated;
revoke all on function public.validate_student_phase_school() from public, anon, authenticated;
revoke all on function public.validate_instructor_assignment_role() from public, anon, authenticated;
revoke all on function public.validate_message_conversation_school() from public, anon, authenticated;
revoke all on function public.validate_payment_invoice_link() from public, anon, authenticated;
revoke all on function public.validate_enrollment_course_school() from public, anon, authenticated;
revoke all on function public.validate_theory_course_module_school() from public, anon, authenticated;
