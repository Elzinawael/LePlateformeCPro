-- ConduiPRO — RLS hardening, staged policy replacement (review draft)
-- IMPORTANT: This is a safer baseline, but still requires schema-specific validation
-- in a disposable project before applying to production.
-- Existing permissive policies are removed by name to prevent OR-composition.
-- Staff writes are role-scoped; students retain only explicit self-service reads/requests.

-- Remove broad policies from migration 002.
drop policy if exists contracts_school_access on public.student_contracts;
drop policy if exists licenses_school_access on public.student_licenses;
drop policy if exists documents_school_access on public.student_documents;
drop policy if exists module_progress_school_access on public.student_module_progress;
drop policy if exists practical_progress_school_access on public.student_practical_progress;
drop policy if exists theory_courses_school_access on public.theory_courses;
drop policy if exists enrollments_school_access on public.theory_course_enrollments;
drop policy if exists course_requests_school_access on public.course_requests;
drop policy if exists conversations_school_access on public.conversations;
drop policy if exists messages_school_access on public.messages;

-- Students: staff can read, only owner/admin/employee may create or delete;
-- instructors are restricted to updating records (ideally assigned students only,
-- which requires an assignment table in a follow-up migration).
drop policy if exists students_school_staff_manage on public.students;
create policy students_school_staff_select on public.students
for select to authenticated using (public.is_school_member(school_id));
create policy students_school_staff_insert on public.students
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy students_school_staff_update on public.students
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy students_school_staff_delete on public.students
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Contracts: owner/admin/employee manage; members read.
create policy contracts_school_select on public.student_contracts
for select to authenticated using (public.is_school_member(school_id));
create policy contracts_school_insert on public.student_contracts
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy contracts_school_update on public.student_contracts
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy contracts_school_delete on public.student_contracts
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Licenses: school members read; owner/admin/employee review and manage.
create policy licenses_school_select on public.student_licenses
for select to authenticated using (public.is_school_member(school_id));
create policy licenses_school_insert on public.student_licenses
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy licenses_school_update on public.student_licenses
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy licenses_school_delete on public.student_licenses
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Documents: owner/admin/employee writes; members read.
create policy documents_school_select on public.student_documents
for select to authenticated using (public.is_school_member(school_id));
create policy documents_school_insert on public.student_documents
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy documents_school_update on public.student_documents
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy documents_school_delete on public.student_documents
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Progress: school members read; owner/admin/employee update progress.
create policy module_progress_school_select on public.student_module_progress
for select to authenticated using (public.is_school_member(school_id));
create policy module_progress_school_insert on public.student_module_progress
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy module_progress_school_update on public.student_module_progress
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy module_progress_school_delete on public.student_module_progress
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Practical progress: instructor role is allowed here, but assignment-based
-- restriction is not possible yet; add instructor/student assignment before launch.
create policy practical_progress_school_select on public.student_practical_progress
for select to authenticated using (public.is_school_member(school_id));
create policy practical_progress_school_insert on public.student_practical_progress
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee','instructor']));
create policy practical_progress_school_update on public.student_practical_progress
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee','instructor']))
with check (public.has_school_role(school_id,array['owner','admin','employee','instructor']));
create policy practical_progress_school_delete on public.student_practical_progress
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Theory scheduling: members read; owner/admin/employee manage.
create policy theory_courses_school_select on public.theory_courses
for select to authenticated using (public.is_school_member(school_id));
create policy theory_courses_school_insert on public.theory_courses
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy theory_courses_school_update on public.theory_courses
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy theory_courses_school_delete on public.theory_courses
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Enrollments: members read; owner/admin/employee manage.
create policy enrollments_school_select on public.theory_course_enrollments
for select to authenticated using (public.is_school_member(school_id));
create policy enrollments_school_insert on public.theory_course_enrollments
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy enrollments_school_update on public.theory_course_enrollments
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy enrollments_school_delete on public.theory_course_enrollments
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Course requests: staff read/manage; student can read/insert own request.
create policy course_requests_school_select on public.course_requests
for select to authenticated using (public.is_school_member(school_id));
create policy course_requests_school_insert on public.course_requests
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy course_requests_school_update on public.course_requests
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy course_requests_school_delete on public.course_requests
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));
drop policy if exists course_requests_student_insert on public.course_requests;
create policy course_requests_student_insert on public.course_requests
for insert to authenticated with check (
  student_id = public.current_student_id()
  and exists (
    select 1 from public.students s
    where s.id = public.course_requests.student_id
      and s.school_id = public.course_requests.school_id
      and s.user_id = auth.uid()
  )
);
create policy course_requests_student_select on public.course_requests
for select to authenticated using (student_id=public.current_student_id());

-- Conversations/messages: members read; owner/admin/employee manage.
create policy conversations_school_select on public.conversations
for select to authenticated using (public.is_school_member(school_id));
create policy conversations_school_insert on public.conversations
for insert to authenticated with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy conversations_school_update on public.conversations
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy conversations_school_delete on public.conversations
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));
create policy messages_school_select on public.messages
for select to authenticated using (public.is_school_member(school_id));
create policy messages_school_insert on public.messages
for insert to authenticated with check (
  public.has_school_role(school_id,array['owner','admin','employee'])
  and sender_id=auth.uid()
);
create policy messages_school_update on public.messages
for update to authenticated using (public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.has_school_role(school_id,array['owner','admin','employee']));
create policy messages_school_delete on public.messages
for delete to authenticated using (public.has_school_role(school_id,array['owner','admin']));

-- Profiles: remove unrestricted self-update. Profile edits must use a trusted
-- server function after the app implements safe editable-field validation.
drop policy if exists profiles_self_update on public.profiles;
