# ConduiPRO — RLS role test matrix

Run these tests only in a disposable Supabase project after applying the migrations in order. Create real test users and school records using the trusted provisioning path. Never use production student data.

## Test actors

- School A: Owner A, Admin A, Employee A, Instructor A1, Instructor A2, Student A1, Student A2
- School B: Owner B, Employee B, Instructor B1, Student B1
- Inactive member: Instructor A3 with status `disabled`

## Expected outcomes

| Test | Expected |
|---|---|
| Owner A reads School A students | Allow |
| Owner A reads School B students | Deny |
| Employee A reads School A students | Allow |
| Instructor A1 reads assigned Student A1 | Allow |
| Instructor A1 reads unassigned Student A2 | Deny |
| Instructor A1 reads Student B1 | Deny |
| Instructor A1 updates practical progress for assigned A1 | Allow |
| Instructor A1 updates practical progress for unassigned A2 | Deny |
| Instructor A1 inserts practical progress for assigned A1 | Allow |
| Instructor A1 inserts practical progress for unassigned A2 | Deny |
| Instructor A1 reads school-wide invoices | Deny |
| Instructor A1 reads office course requests | Deny |
| Instructor A1 reads office conversations/messages | Deny |
| Student A1 reads own student profile | Allow |
| Student A1 reads Student A2 profile | Deny |
| Student A1 reads own licenses/documents/progress/enrollments | Allow only under explicit self-read policies |
| Student A1 writes student progress directly | Deny |
| Student A1 creates request for own student record | Allow if request validation rules pass |
| Student A1 creates request for another student | Deny |
| Disabled instructor reads school data | Deny |
| Instructor A1 changes own role/profile privilege | Deny |
| Instructor A1 assigns themselves another student | Deny |
| Student A1 reads school-side member records | Deny |

## Cross-tenant integrity tests

Attempt to insert rows where the school ID belongs to School A and student ID belongs to School B. For every student-linked table protected by migration 007, the composite FK must reject the row.

Also attempt:
- Course enrollment School A + course from School B
- Theory course School A + module belonging to School B
- Theory request School A + module from School B
- Practical request School A + lesson from School B
- Message School A + conversation from School B
- Payment School A + invoice from School B or another student

The final six are known gaps in the current draft and are expected to fail only after corresponding constraints/validation are implemented. Record actual outcomes, SQLSTATE, and migration version.

## Execution notes

- Use authenticated JWTs for each role; don't rely only on service-role testing because service role bypasses RLS.
- Run SELECT, INSERT, UPDATE, and DELETE tests independently.
- Verify both row visibility and affected-row counts for UPDATE/DELETE.
- Confirm policies combine as expected: PostgreSQL permissive policies combine with OR, so remove obsolete policy names before adding replacements.
- Save evidence/results in a dated test report.
- Do not apply draft migrations to production until all tests pass.
