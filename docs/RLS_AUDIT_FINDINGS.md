# RLS audit — migration 002 (reviewed 2026-11-26)

Status: **NOT READY TO APPLY**. This review is based on the current schema migration `202611260001_initial_schema.sql` and security migration `202611260002_security_policies.sql`.

## Critical findings

### 1. School-wide write access is too broad
Policies using `is_school_member(school_id)` in both `USING` and `WITH CHECK` grant every active member (including instructors) insert/update/delete access through `FOR ALL` policies on multiple tables:
- student_contracts
- student_licenses
- student_documents
- student_module_progress
- student_practical_progress
- theory_courses
- theory_course_enrollments
- course_requests
- conversations
- messages

A member-level read policy is often appropriate, but write access should be role- and operation-specific. For example, instructors should only update practical progress they are assigned to, not financial/student document records.

### 2. Student request insert policy has ambiguous identifiers
The `course_requests_student_insert` policy includes a correlated subquery:
`where s.id=student_id and s.school_id=school_id`.
The unqualified names are ambiguous and may resolve to the inner row rather than the outer request row. Explicit aliases and qualification are required, and validation must confirm the request's student belongs to the same school.

### 3. Profiles can self-update sensitive fields
`profiles_self_update` lets a user update their own row without limiting mutable columns. This could let a user change `account_type`, email, or other identity/profile fields. Prefer a narrowly scoped RPC or trigger that only permits approved fields, with account type and identity controlled by trusted provisioning.

### 4. School members can manage other members
`school_members_owner_admin_manage` is intended for owner/admin, but membership management should also protect against removing the last owner, changing a member's school/user identifiers, and privilege escalation. Use trusted routines for role changes and invitations.

### 5. Student records allow staff role writes without granular checks
`students_school_staff_manage` allows owner/admin/employee/instructor full CRUD on student rows. Instructors should not be able to create/delete student records or change sensitive enrollment/identity fields by default.

### 6. Cross-tenant relationships are not fully enforced by foreign keys
Many tables carry `school_id` and a separate foreign key to `student_id`, `course_id`, `module_id`, etc. Ordinary FKs do not prove that the referenced record belongs to the same school. Add composite unique keys and composite foreign keys (or trusted triggers) where appropriate to prevent cross-tenant mismatches at the database level.

### 7. Storage security is missing
No Storage bucket or policies are defined in these migrations. Student permits/contracts/documents must use private buckets, school/student-scoped object paths, strict read/write policies, file size/type validation, and server-generated signed URLs where appropriate. Storage policy testing is required before documents feature is enabled.

### 8. Student access should be read-only except for explicit self-service actions
Student policies should be explicit for their own records. Student account must not be able to modify progress, license verification state, balances, school records, or staff processing fields. Self-service actions (requests and permit upload) should use validated policies or server routines.

### 9. Audit log should be append-only
No client insert/update/delete policy should be added. Log writes should happen via trusted server-side routines or triggers, and ordinary users should not be able to modify or erase audit entries.

## Required remediation order

1. Fix ambiguous SQL and run migration validation in a disposable Supabase environment.
2. Replace broad `FOR ALL` policies with operation-specific policies and role restrictions.
3. Restrict profile self-updates to safe fields; protect `account_type`.
4. Make member management a trusted operation with last-owner protection.
5. Add tenant-safe composite FK constraints.
6. Add private Storage buckets and policies with test coverage.
7. Implement student read-only/self-service policies.
8. Run the security validation matrix in `docs/SECURITY_VALIDATION_PLAN.md`.
9. Only after passing, apply to the ConduiPRO Supabase project. Do not run any migration against TRADAR.

## Suggested role matrix (initial)

| Data area | Owner/Admin | Employee | Instructor | Student |
|---|---|---|---|---|
| School settings | Read/write | Read (limited) | Read (limited) | No |
| Student records | Read/write | Read/write (business fields) | Read assigned students only | Own record read |
| Contracts/documents | Read/write | Read/write (limited) | Read only if assigned | Own approved read / own upload flow |
| Theory scheduling | Read/write | Read/write | Read | Read own schedule |
| Practical progress | Read/write | Read/write | Update assigned lessons only | Read own progress |
| Course requests | Process | Process | No by default | Create/read own |
| Finance | Read/write | Read/write (limited) | No | Read via restricted balance view |
| Messages | School access | School access | Assigned context only | Own conversations |
| Audit logs | Read | Limited/no | No | No |

This matrix is a starting point for implementation, not a claim that policies have already been validated.
