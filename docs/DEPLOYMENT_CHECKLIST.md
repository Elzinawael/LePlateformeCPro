# ConduiPRO — deployment checklist

## Application environment variables

Configure these variables in the hosting provider (for example, Vercel):

| Variable | Browser visible? | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://nahjdhvjozrvdgmjdbws.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key for ConduiPROdb |
| `APP_BASE_URL` | Server only | Deployed application origin, e.g. `https://app.example.ca` |
| `SUPABASE_SECRET_KEY` | **Server only** | Supabase secret key for server-side invitation actions |

Never prefix `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_`. Never commit it to GitHub or send it through the browser.

For local development, copy `.env.example` to `.env.local` and populate the values using the Supabase Dashboard.

## Initial school and owner bootstrap

The database starts without application users or schools. After deploying the application and configuring the environment, the first school/owner can be provisioned once from a trusted terminal:

1. Copy `.env.example` to a private `.env.local` file and set the Supabase URL, server secret key, `APP_BASE_URL`, and the `BOOTSTRAP_*` school/owner fields.
2. Run `npm install` and `npm run bootstrap:school`.
3. The script creates the school, owner profile and owner membership, then sends an invitation email.
4. The owner opens the email, confirms the invitation and sets a password in ConduiPRO.

Run this script only once for each new school. Keep `SUPABASE_SECRET_KEY` in the terminal environment only; do not put it in a browser variable or commit it to GitHub. The script cleans up partial records if provisioning fails.

## Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to the deployed application origin.
- Add `<APP_BASE_URL>/auth/callback` to Redirect URLs.
- Add `http://localhost:3000/auth/callback` for local development.
- Configure an email provider/SMTP service that can deliver invitations and password recovery messages.
- Confirm the invitation and password recovery templates point to Supabase's confirmation URL and permit the configured redirect URL.

The student invite flow sends an email, associates the invited Auth user with the student record, and routes the confirmed link to password setup. Password recovery uses the same callback.

## Database and storage

The ConduiPRO Supabase project is in Canada Central. Applied migrations are listed in `docs/LIVE_DEPLOYMENT_NOTES_2026-11-26.md`.

Before real student onboarding:
- Create at least one school.
- Create the first owner profile and active school membership through a trusted administrative provisioning process.
- Verify school and staff account types and membership roles.
- Verify the private `student-documents` bucket and its row-level policies.
- Confirm the class 5 curriculum is loaded.
- Test one student invitation, first password setup, login, request submission, school review, theory course enrollment, and permit upload with distinct test users.

## GitHub Actions

The `.github/workflows/ci.yml` workflow runs on pushes and pull requests to `main`:
- `npm install`
- `npm run lint`
- `npm run build`

The production build uses placeholder public Supabase values. It validates the Next.js build and types but does not test real authentication, email delivery, Storage permissions, or school/student RLS behavior.

## Release gate

Do not treat the service as production-ready until:
- Hosting environment variables and the correct Supabase project are configured.
- SMTP delivery and redirect allowlists have been verified.
- A separate test school, owner/admin/employee/instructor accounts, and student account have passed the role test matrix.
- File upload, signed document access, rejected document re-upload, and cross-school denial have been exercised.
- A successful CI run is attached to the exact commit selected for deployment.
