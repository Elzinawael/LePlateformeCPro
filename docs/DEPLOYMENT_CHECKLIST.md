# ConduiPRO — deployment checklist

## Application environment

Set these variables in Hostinger:

| Variable | Public | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ConduiPROdb Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | **No** | Server-only Auth Admin and trusted server operations |
| `APP_BASE_URL` | No | Public application origin |

Never expose `SUPABASE_SECRET_KEY` through a `NEXT_PUBLIC_` variable. Never commit it to GitHub.

## Operating model

ConduiPRO uses three account classes:

1. **Platform administrator** — created and managed by ConduiPRO. This account provisions and suspends schools.
2. **School owner** — one owner account per school, created by the platform administrator. The owner manages student records, contracts, payments, theory sessions, requests, permit reviews and practical scheduling.
3. **Student** — automatically created when a school creates a student record. The student signs in using the school code, contract number and initial password defined in the product specification.

There are no employee or instructor login accounts. A school records the responsible trainer's name when scheduling a practical session.

The old `/setup/first-school`, `/api/bootstrap/first-school` and `npm run bootstrap:school` flows are retired. Use `/admin` after logging in as the ConduiPRO platform administrator to create schools.

## Initial platform operator

The first ConduiPRO platform administrator is registered in `public.platform_admins` through a controlled migration. Additional platform operators must be provisioned by a trusted server-side administrative process; never grant this role through a browser form.

## Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to the deployed application origin.
- Add `<APP_BASE_URL>/auth/callback` to Redirect URLs.
- Add `http://localhost:3000/auth/callback` for local development.
- Configure SMTP for school-owner invitations, school-owner password recovery and required notifications.
- Student logins use the generated internal Auth identifier derived from school code and contract number; student contact email is not used as the login identifier.

## Database and storage

The ConduiPRO Supabase project is hosted in Canada Central.

- Keep the `student-documents` bucket private.
- Student files use a path scoped to school ID and student ID.
- School owners review permits and access contract files; students can read their own approved or submitted files only.
- School finance and operational RLS policies are owner-only. Platform administration is managed separately.

## Test checklist

Before onboarding real schools:

- Platform admin can create a school and receives a one-time owner password.
- School owner must change the temporary password at first login.
- Owner can create a student and receives the school code, contract identifier and first password.
- Student must change the first password at first login.
- Student can see their own contract, balance, progress, courses and requests only.
- Student can request a future theory session only for an incomplete module in the current phase.
- Student can submit a practical availability request without a date picker.
- School owner can process/reject requests, schedule lessons, complete practical lessons and review learner permits.
- Contract amount creates a matching invoice; partial payments update the outstanding balance and overpayments are rejected.
- Suspended schools and their students cannot access portals.
- Cross-school reads and writes are denied.
- File upload, signed file access, rejected permit resubmission and Storage RLS are exercised.

## CI and release gate

GitHub Actions on `main` runs dependency audit, ESLint and the production Next.js build. A green CI run verifies code compilation and dependency audit; it does not prove browser workflows, email delivery or every RLS branch. Keep real Supabase role tests and the product acceptance checklist as release requirements.
