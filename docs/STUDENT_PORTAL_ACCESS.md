# ConduiPRO — student portal data access

This note describes the intended access model after migrations 014–016 are applied and verified.

## Student read access
- Own student record and own module/practical progress.
- Own contract, invoice, payment and license/document metadata.
- Global curriculum plus the current phase and its school curriculum.
- Scheduled theory sessions for the student's current phase and school.
- Own theory course enrollments, course requests and conversations.

## Student write access
- Insert a learner-permit document record in pending state.
- Insert a learner-license record in pending verification state.
- Insert a course request that is automatically constrained to the current phase.
- No direct edits to progress, payment, invoices, contracts, reviews, or request status.

## School staff access
- Owner, admin and employee can manage school records and private documents.
- Instructors are limited to assigned student records and practical progress.
- Instructors do not receive access to contract/finance records or private identity-document files.

## Private file storage
- Bucket: `student-documents` (private).
- Path: `<school_uuid>/<student_uuid>/<opaque-file-name>`.
- Maximum upload: 10 MiB.
- Accepted types: PDF, JPEG and PNG.
- Students upload only within their own folder; school staff can upload/read/manage files for their school.
- Instructors cannot download or list private student documents.

## Important
Migrations 014–016 are repository drafts, not applied production changes. Validate them in a disposable Supabase project with separate school, instructor and student users before deployment.
