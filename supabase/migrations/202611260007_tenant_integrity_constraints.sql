-- ConduiPRO — tenant-consistency constraints (draft; validate before applying)
-- These composite foreign keys prevent rows from linking a student to another school.
-- Assumes a clean database and no existing orphaned cross-tenant records.

create unique index if not exists students_id_school_unique
  on public.students(id,school_id);

alter table public.student_contracts
  add constraint student_contracts_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.student_licenses
  add constraint student_licenses_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.student_documents
  add constraint student_documents_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.student_module_progress
  add constraint module_progress_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.student_practical_progress
  add constraint practical_progress_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.theory_course_enrollments
  add constraint enrollments_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.course_requests
  add constraint course_requests_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.invoices
  add constraint invoices_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.payments
  add constraint payments_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.conversations
  add constraint conversations_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

alter table public.instructor_student_assignments
  add constraint instructor_assignments_student_school_fk
  foreign key (student_id,school_id) references public.students(id,school_id)
  on delete cascade;

-- The assigned instructor must also be a member of the same school.
alter table public.instructor_student_assignments
  add constraint instructor_assignments_member_fk
  foreign key (school_id,instructor_user_id)
  references public.school_members(school_id,user_id)
  on delete cascade;
