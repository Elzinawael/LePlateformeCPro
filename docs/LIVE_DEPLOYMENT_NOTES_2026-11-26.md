# ConduiPRO — live deployment notes (2026-11-26)

## Database
- Supabase project: `nahjdhvjozrvdgmjdbws` (Canada Central).
- Migration history observed in Supabase: versions `202611260001` through `202611260018`.
- Global class 5 curriculum in live database: 4 phases, 12 theory modules (120 minutes each), 15 practical outings (55 minutes each).
- Private Storage bucket `student-documents`: not public; 10 MiB limit; PDF, JPEG and PNG.
- No student records or application users were present at the time of this snapshot.

## Important deployment correction
An attempted SQL dry-run was executed by the Supabase SQL tool as live statements rather than being isolated by the `BEGIN/ROLLBACK` wrapper. Subsequent inspection confirmed the DDL and data seed are live. Treat the Supabase migration registry and direct database inspection as the source of truth; never use `execute_sql` with transaction wrappers as a dry-run mechanism.

## PESR permit rule
SAAQ class 5 structure places modules 1–5 in Phase 1. Module 5 is the driving school's theory evaluation; the learner permit follows completion of the first four modules and successful evaluation, before Phase 2 road outings. Migration 018 enforces completed Phase 1 modules 1–5.

## Security advisor
The three SECURITY DEFINER helpers `is_school_member`, `has_school_role` and `current_student_id` remain executable by authenticated users because the RLS policies call them. They return only the current user's membership/identity checks. Trigger-only helper functions have direct EXECUTE privileges revoked in migration 018 to prevent unnecessary RPC access.

## Application delivery
GitHub Actions CI runs ESLint and a production build. The first complete green run was observed on commit `7615ab5277dd43f8b460f0e13c51976fc66813ab`. Each later commit triggers a new check; the latest run should be confirmed before release.
