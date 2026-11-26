# ConduiPRO — Live Supabase snapshot (2026-11-26)

## Project verified

- Project name: ConduiPROdb
- Project ref: `nahjdhvjozrvdgmjdbws`
- Region: `ca-central-1` (Canada Central)
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: 17
- Applied migration versions: `202611260001 initial_schema`, `202611260002 security_policies`
- Public tables reported: all expected initial schema tables
- Row counts reported: 0 for the tables reviewed
- RLS enabled: true on the public tables reported

## Migration drift

The GitHub repository contains later draft migrations 003–010, but the live database only reports migrations 001 and 002. Therefore the following draft changes are NOT live:

- role-specific RLS hardening
- instructor/student assignments
- instructor read scoping
- composite tenant constraints
- relationship integrity triggers
- course request validation correction
- global curriculum phase uniqueness / phase ownership guard

## Safe next steps

1. Review and correct the migration chain from 003 onward.
2. Apply to a disposable development database first.
3. Run the role test matrix with authenticated JWT test accounts.
4. Confirm all expected access/denial outcomes and cross-tenant integrity failures.
5. Only then decide whether to apply the hardening chain to the empty live project.

**No later migrations were applied during this inspection.**
