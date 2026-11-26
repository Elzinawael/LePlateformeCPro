# ConduiPRO — Storage and Auth audit snapshot

## Storage
Read-only inspection of `pg_policies` in schemas `storage` and `auth` returned no policies. No private document-upload/download workflow is configured yet.

## Auth / profiles
The live `profiles_self_update` policy permits authenticated users to update their own profile row. The table contains `account_type` (school/student), so self-service update must not allow changing that field. Provisioning and account type changes should be server-side only.

## Required before app implementation
- Decide private storage buckets (e.g. student-documents and school-assets).
- Define object paths by tenant and student, and enforce those path prefixes in Storage policies.
- Keep documents private; use signed URLs with short expiry for access.
- Create server-side provisioning for school staff and students.
- Prevent client-side account_type changes.
