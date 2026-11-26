-- ConduiPRO — correct student course-request school binding
-- Live policy audit found a tautology: s.school_id = s.school_id.
-- This replacement binds the request's school_id to the actual student's school.

drop policy if exists course_requests_student_insert on public.course_requests;

create policy course_requests_student_insert
on public.course_requests
for insert
to authenticated
with check (
  student_id = public.current_student_id()
  and exists (
    select 1
    from public.students s
    where s.id = course_requests.student_id
      and s.school_id = course_requests.school_id
  )
);
