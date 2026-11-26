# ConduiPRO — Security validation plan (before applying migrations)

**Status: Draft — migrations must not be applied to production until reviewed and tested.**

## Review findings in the current V1 migrations
1. RLS policies are a first draft, not production-ready.
2. Several school-side policies currently grant all active school members (including instructor role) broad write access. This needs role-specific restrictions before launch.
3. The student request INSERT policy uses unqualified column names in a correlated condition; rewrite with explicit aliases to avoid ambiguity and verify that request type/module/phase constraints are enforced.
4. Direct student table/profile updates should be limited to safe fields; self-update policies are currently too broad for profile fields.
5. Finance policies are school-role constrained, but invoice/payment cross-record school ownership needs database-level validation.
6. Curriculum global/school-specific uniqueness with nullable school_id needs careful validation because PostgreSQL UNIQUE treats NULL values as distinct. Consider unique indexes using NULLS NOT DISTINCT or a global template strategy.
7. Policies for Storage buckets are not included yet.
8. School/student portal routing separation is not sufficient alone; authorization must be enforced server-side and by RLS.
9. Audit log writes should be implemented via trusted server-side functions and cannot be user-forged.
10. Multi-tenant consistency should be strengthened: child records must be guaranteed to reference parents from the same school. Foreign keys on IDs alone do not enforce school_id matching.

## Test matrix (use separate test accounts and tenants)
- Anonymous user: cannot read any tenant data.
- School A owner/admin: can read/manage School A, cannot read School B.
- School A employee: allowed operational functions only; cannot manage roles/security settings.
- School A instructor: only assigned/approved scope; no finance access.
- School A student: can read their own student-facing record only; cannot read another student.
- Student: cannot write progress, completion, invoice/payment, school settings, membership or audit records.
- School student: cannot access school portal routes or staff APIs.
- School member: cannot access student portal as a student unless linked student account.
- Cross-school ID substitution: every query must fail closed.
- Storage: school and student access limited to approved private document paths.
- Revoked/disabled membership: access is immediately denied.
- Suspended school: operational access blocked by server authorization.

## Required before production
- Correct the current security migration and policies.
- Add tenant-consistent composite foreign keys or trusted routines where appropriate.
- Implement private Storage buckets and policies.
- Implement safe profile update routines.
- Implement student account provisioning via server-side Auth Admin.
- Test RLS with SQL tests or integration tests using realistic role accounts.
