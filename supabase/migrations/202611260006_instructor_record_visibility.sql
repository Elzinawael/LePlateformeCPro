-- ConduiPRO — assignment-scoped instructor access to student records (review draft)
-- Instructors should not see school-wide student records or communications.
-- Staff roles retain school-wide access; students retain their explicit self-read policies.

-- Contracts
drop policy if exists contracts_school_select on public.student_contracts;
create policy contracts_staff_select on public.student_contracts
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
create policy contracts_instructor_assigned_select on public.student_contracts
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_contracts.school_id
      and a.student_id=public.student_contracts.student_id
      and a.instructor_user_id=auth.uid() and a.active=true
  )
);

-- Licenses (students retain their own read policy)
drop policy if exists licenses_school_select on public.student_licenses;
create policy licenses_staff_select on public.student_licenses
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
create policy licenses_instructor_assigned_select on public.student_licenses
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_licenses.school_id
      and a.student_id=public.student_licenses.student_id
      and a.instructor_user_id=auth.uid() and a.active=true
  )
);

-- Documents (students retain their own read policy)
drop policy if exists documents_school_select on public.student_documents;
create policy documents_staff_select on public.student_documents
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
create policy documents_instructor_assigned_select on public.student_documents
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_documents.school_id
      and a.student_id=public.student_documents.student_id
      and a.instructor_user_id=auth.uid() and a.active=true
  )
);

-- Theory module progress (students retain their own read policy)
drop policy if exists module_progress_school_select on public.student_module_progress;
create policy module_progress_staff_select on public.student_module_progress
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
create policy module_progress_instructor_assigned_select on public.student_module_progress
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_module_progress.school_id
      and a.student_id=public.student_module_progress.student_id
      and a.instructor_user_id=auth.uid() and a.active=true
  )
);

-- Enrollments: instructors only see assigned students' enrollments.
drop policy if exists enrollments_school_select on public.theory_course_enrollments;
create policy enrollments_staff_select on public.theory_course_enrollments
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
create policy enrollments_instructor_assigned_select on public.theory_course_enrollments
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.theory_course_enrollments.school_id
      and a.student_id=public.theory_course_enrollments.student_id
      and a.instructor_user_id=auth.uid() and a.active=true
  )
);

-- Requests and conversations/messages are school-office workflows, not instructor-wide views.
drop policy if exists course_requests_school_select on public.course_requests;
create policy course_requests_staff_select on public.course_requests
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));

drop policy if exists conversations_school_select on public.conversations;
create policy conversations_staff_select on public.conversations
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));

drop policy if exists messages_school_select on public.messages;
create policy messages_staff_select on public.messages
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));
