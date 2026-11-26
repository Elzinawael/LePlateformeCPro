# ConduiPRO — Live RLS Audit (2026-11-26)

## Scope
Direct read-only inspection of `pg_policies` on the active Supabase project. This is a snapshot, not a penetration test.

## Critical findings

### 1. Students are currently school-wide readable
Live policy `students_school_select` uses `is_school_member(school_id)`, which grants all active school members—including instructors—read access to every student in their school. The initial `students_school_staff_manage` ALL policy also uses a broad member-role list.

**Expected model:** owner/admin/employee may read all student records; instructors should read only assigned students. Student self-read remains.

### 2. Student course request insert policy contains tautology
Live `course_requests_student_insert` includes `s.school_id = s.school_id`, which does not bind the request's school_id to the student. Migration 012 corrects this to `s.school_id = course_requests.school_id`, but it is not applied.

### 3. Student-facing self-read policies exist
Students have self-select policies for licenses, documents, module/practical progress, enrollments, course requests, conversations/messages. These must be tested against JWT-authenticated accounts.

### 4. Security helper function grants
Supabase security advisor flagged public/anon execution on SECURITY DEFINER helpers. Live catalog inspection confirms explicit anon grants on `current_student_id`, `has_school_role`, `is_school_member`, and `rls_auto_enable`. Migration 011 drafts explicit revokes and search_path hardening. It is not applied.

## No data found
The inspected tables currently report no user rows, so policy behavior has not been validated against real records.

## Recommendation
Do not onboard real students until:
- migration chain 003–012 has been consolidated/reviewed,
- a disposable staging database is available,
- role/tenant matrix tests pass,
- Storage policies are reviewed separately,
- auth provisioning and account lifecycle are implemented.
