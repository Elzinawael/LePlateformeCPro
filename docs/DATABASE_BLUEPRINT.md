# ConduiPRO — Database blueprint V1

## Architecture
- Next.js / TypeScript application hosted separately from the WordPress marketing site.
- Supabase PostgreSQL, Auth and private Storage.
- Multi-tenant: each driving school is isolated by school_id and Row Level Security.
- Roles: owner, admin, employee, instructor; students have a separate account type and portal.
- All operational records are tenant-scoped.

## Database domains
1. Tenant & access: schools, profiles, school_members, school_settings
2. Students: students, student_contracts, student_licenses, student_documents
3. Curriculum: curriculum_phases, curriculum_modules, practical_lessons
4. Progress: student_module_progress, student_practical_progress
5. Scheduling: theory_courses, theory_course_enrollments, course_requests
6. Finance: invoices, payments
7. Communication: conversations, messages, notifications
8. SaaS: subscription_plans, school_subscriptions
9. Security/audit: audit_logs

## Business rules to implement in SQL/RLS/functions
- A school employee can only see/manage records for schools where they are an active member.
- A student account can only see its own student record and student-facing information.
- School and student portal access are separated by account_type and authorization logic.
- Contract number is unique per school.
- A student can only request theory modules belonging to their current phase and not already completed.
- A student cannot register twice for the same theory course.
- Student progress completion is staff-validated, never self-validated.
- Practical course requests use availability text; requests do not themselves mark a practical lesson complete.
- Permit documents uploaded by students require school review before approval.
- Private files must be stored in Supabase Storage, never in public buckets.
- Credential creation and student account provisioning must be server-side; never expose service-role credentials.
- Passwords should not be derived from contract numbers in production. Use a generated temporary password or secure invitation/reset flow and require password change. Contract numbers are identifiers, not secrets.

## Curriculum assumptions
The program model supports 4 phases, 12 theory modules (24 hours total), and 15 practical lessons (55 minutes each). Module/lesson names and phase mapping should be seeded only after validating the current official Québec/SAAQ curriculum.

## Migration
Initial schema: `supabase/migrations/202611260001_initial_schema.sql`.
This migration creates tables, constraints, indexes, update triggers, and enables RLS.
It intentionally creates no permissive policies. A follow-up security migration must define policies and helper functions before client access.
