# ConduiPRO — Tenant integrity & curriculum audit (draft)

This is a static review of the current migrations, not a database execution or security certification.

## Confirmed schema risks

1. **Global curriculum phase uniqueness:** `curriculum_phases` has `unique(school_id, phase_number)`. PostgreSQL permits multiple NULL values in this unique constraint, so duplicate global phase numbers can exist.
2. **Tenant consistency across child records:** composite student/school foreign keys in migration 007 protect student-linked records, but course/module/lesson references still need cross-school consistency validation.
3. **Theory course module ownership:** `theory_courses.school_id` and `module_id` can point to a school-specific curriculum module belonging to another school unless validated.
4. **Enrollment course-school integrity:** `theory_course_enrollments.school_id` can differ from the referenced course's school unless composite constraints are added.
5. **Request target validation:** a theory request can reference a module from another school; practical request can reference a lesson from another school. Existing CHECK constraints only validate required fields by request type, not cross-school ownership.
6. **Messages/conversations tenant consistency:** `messages.school_id` can disagree with the linked conversation's school without a composite FK.
7. **Payment/invoice integrity:** a payment's `school_id` and `student_id` can be valid while its `invoice_id` points to an invoice from another school/student.
8. **Progress curriculum consistency:** module/practical progress may reference a curriculum item not associated with the same school/global curriculum.

## Next hardening order

- Add partial unique indexes for global phases and school-specific phases (after dropping the redundant nullable unique constraint).
- Add composite unique indexes on parent records needed for tenant-scoped foreign keys.
- Add composite foreign keys where possible; use triggers only for relationships that legitimately include global curriculum templates.
- Validate existing data before adding constraints; use NOT VALID only for a staged production migration and follow with explicit validation.
- Create a disposable Supabase project, apply migrations in order, and test all role combinations before production.

## Status

**NOT READY TO APPLY TO PRODUCTION.** This audit is static; no migration was run against Supabase and no live data was inspected.
