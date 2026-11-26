-- ConduiPRO — Security helpers and tenant isolation (V1)
-- This migration intentionally avoids granting student access to school-side data.
-- Application flows should use server-side provisioning for Auth users.

create or replace function public.is_school_member(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_members sm
    where sm.school_id = target_school
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function public.has_school_role(target_school uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_members sm
    where sm.school_id = target_school
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role = any(allowed_roles)
  );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.students s
  where s.user_id = auth.uid()
  limit 1;
$$;

-- Prevent recursive policy evaluation when resolving membership.
revoke all on function public.is_school_member(uuid) from public;
revoke all on function public.has_school_role(uuid,text[]) from public;
revoke all on function public.current_student_id() from public;
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.has_school_role(uuid,text[]) to authenticated;
grant execute on function public.current_student_id() to authenticated;

-- School-scoped tables: members can read; privileged roles write.
create policy schools_member_select on public.schools
for select to authenticated using (public.is_school_member(id));
create policy schools_owner_admin_update on public.schools
for update to authenticated using (public.has_school_role(id,array['owner','admin']))
with check (public.has_school_role(id,array['owner','admin']));

create policy profiles_self_select on public.profiles
for select to authenticated using (id=auth.uid());
create policy profiles_self_update on public.profiles
for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy school_members_member_select on public.school_members
for select to authenticated using (public.is_school_member(school_id));
create policy school_members_owner_admin_manage on public.school_members
for all to authenticated using (public.has_school_role(school_id,array['owner','admin']))
with check (public.has_school_role(school_id,array['owner','admin']));

create policy school_settings_member_select on public.school_settings
for select to authenticated using (public.is_school_member(school_id));
create policy school_settings_owner_admin_manage on public.school_settings
for all to authenticated using (public.has_school_role(school_id,array['owner','admin']))
with check (public.has_school_role(school_id,array['owner','admin']));

-- Students: school users manage; students read only their own record.
create policy students_school_select on public.students
for select to authenticated using (public.is_school_member(school_id));
create policy students_student_self_select on public.students
for select to authenticated using (user_id=auth.uid());
create policy students_school_staff_manage on public.students
for all to authenticated using (public.has_school_role(school_id,array['owner','admin','employee','instructor']))
with check (public.has_school_role(school_id,array['owner','admin','employee','instructor']));

create policy contracts_school_access on public.student_contracts
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

create policy licenses_school_access on public.student_licenses
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy licenses_student_self_select on public.student_licenses
for select to authenticated using (student_id=public.current_student_id());

create policy documents_school_access on public.student_documents
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy documents_student_self_select on public.student_documents
for select to authenticated using (student_id=public.current_student_id());

-- Curriculum: global templates are readable; school custom curricula are member-readable.
create policy phases_read on public.curriculum_phases
for select to authenticated using (school_id is null or public.is_school_member(school_id));
create policy phases_school_manage on public.curriculum_phases
for all to authenticated using (school_id is not null and public.has_school_role(school_id,array['owner','admin']))
with check (school_id is not null and public.has_school_role(school_id,array['owner','admin']));

create policy modules_read on public.curriculum_modules
for select to authenticated using (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and (p.school_id is null or public.is_school_member(p.school_id)))
);
create policy modules_school_manage on public.curriculum_modules
for all to authenticated using (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and p.school_id is not null
            and public.has_school_role(p.school_id,array['owner','admin']))
)
with check (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and p.school_id is not null
            and public.has_school_role(p.school_id,array['owner','admin']))
);

create policy practical_lessons_read on public.practical_lessons
for select to authenticated using (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and (p.school_id is null or public.is_school_member(p.school_id)))
);
create policy practical_lessons_school_manage on public.practical_lessons
for all to authenticated using (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and p.school_id is not null
            and public.has_school_role(p.school_id,array['owner','admin']))
)
with check (
  exists (select 1 from public.curriculum_phases p
          where p.id=phase_id and p.school_id is not null
            and public.has_school_role(p.school_id,array['owner','admin']))
);

-- Progress: school staff can manage; students can read their own progress only.
create policy module_progress_school_access on public.student_module_progress
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy module_progress_student_read on public.student_module_progress
for select to authenticated using (student_id=public.current_student_id());

create policy practical_progress_school_access on public.student_practical_progress
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy practical_progress_student_read on public.student_practical_progress
for select to authenticated using (student_id=public.current_student_id());

create policy theory_courses_school_access on public.theory_courses
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy enrollments_school_access on public.theory_course_enrollments
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy enrollments_student_read on public.theory_course_enrollments
for select to authenticated using (student_id=public.current_student_id());

-- Requests: students can create and read their own requests; school members process requests.
create policy course_requests_school_access on public.course_requests
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy course_requests_student_select on public.course_requests
for select to authenticated using (student_id=public.current_student_id());
create policy course_requests_student_insert on public.course_requests
for insert to authenticated with check (
  student_id=public.current_student_id()
  and exists (select 1 from public.students s
              where s.id=student_id and s.school_id=school_id)
);

-- Finance: school only. No student-facing invoice/payment policies yet; student balance
-- will be served through restricted views/RPCs in the next migration.
create policy invoices_school_access on public.invoices
for all to authenticated using (public.is_school_member(school_id)
  and public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.is_school_member(school_id)
  and public.has_school_role(school_id,array['owner','admin','employee']));
create policy payments_school_access on public.payments
for all to authenticated using (public.is_school_member(school_id)
  and public.has_school_role(school_id,array['owner','admin','employee']))
with check (public.is_school_member(school_id)
  and public.has_school_role(school_id,array['owner','admin','employee']));

-- Conversations/messages: school members and the linked student only.
create policy conversations_school_access on public.conversations
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy conversations_student_select on public.conversations
for select to authenticated using (student_id=public.current_student_id());
create policy messages_school_access on public.messages
for all to authenticated using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));
create policy messages_student_select on public.messages
for select to authenticated using (
  exists (select 1 from public.conversations c
          where c.id=conversation_id and c.student_id=public.current_student_id())
);

create policy notifications_self_access on public.notifications
for all to authenticated using (user_id=auth.uid())
with check (user_id=auth.uid());

create policy subscription_plans_authenticated_read on public.subscription_plans
for select to authenticated using (is_active);
create policy school_subscriptions_member_read on public.school_subscriptions
for select to authenticated using (public.is_school_member(school_id));

create policy audit_logs_school_select on public.audit_logs
for select to authenticated using (public.is_school_member(school_id));
-- Audit insertion will be via server-side trusted routines, not direct client writes.
