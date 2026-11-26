-- ConduiPRO — every theory request must reference a selected theory session.
-- Practical requests continue to use availability_text and no selected course.
alter table public.course_requests
  add constraint course_requests_theory_requires_preferred_session
  check (request_type <> 'theory' or preferred_course_id is not null);
