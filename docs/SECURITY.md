# Security and tenant isolation — V1

## Roles
- School roles: owner, admin, employee, instructor.
- Students are separate profiles linked through students.user_id.
- School and student login destinations are separated by account_type and application routing; database policies remain the security boundary.

## Tenant helper functions
- is_school_member(school_id): active school membership.
- has_school_role(school_id, roles): active membership plus role check.
- current_student_id(): student's linked student record.

## Policy intent
- School staff: only their tenant's data.
- Students: only self read for student-facing records.
- Finance: owner/admin/employee only.
- Student progress: school staff writes; students read.
- Student requests: students create/read own; school staff process.
- Documents and licenses: school staff manage/review; students read own records.
- Messages: school staff in tenant; linked student reads conversation messages.
- Audit logs: tenant reads, trusted server-side writes.

## Important implementation cautions
1. This is a first security-policy draft and requires review/test before production.
2. The schema currently allows school-wide staff policies that need more granular role rules (e.g. instructor scope) in a later refinement.
3. Student profile provisioning and password setup must happen through a trusted server-side function using Supabase Auth Admin; never expose service role keys in browser.
4. The initial student password design (contract number-derived) is not safe as a permanent password. Use a one-time temporary credential and require password change.
5. The request INSERT policy requires careful SQL qualification to avoid ambiguity and should be tested/fixed in the migration validation pass.
6. Student self-service updates should be restricted to safe fields via RPC or column-level permissions; avoid direct unrestricted profile/student table updates.
7. Storage bucket policies are not yet included; create private buckets and tenant/student-scoped policies in a separate migration.
8. Before running these migrations against the Supabase project, validate syntax and test access scenarios with separate school and student accounts.
