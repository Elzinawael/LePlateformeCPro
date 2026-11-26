-- ConduiPRO — assignment-scoped reads for instructors (review draft)
-- Fixes instructor visibility across all students in the school.
-- Apply only after prior migrations are validated in a disposable database.

-- Student records: remove broad member read, keep staff access and student self-read.
drop policy if exists students_school_select on public.students;
drop policy if exists students_school_staff_select on public.students;

create policy students_staff_select on public.students
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));

create policy students_instructor_assigned_select on public.students
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.students.school_id
      and a.student_id=public.students.id
      and a.instructor_user_id=auth.uid()
      and a.active=true
  )
);

-- Practical progress: staff read all; instructors read assigned students only.
drop policy if exists practical_progress_school_select on public.student_practical_progress;

create policy practical_progress_staff_select on public.student_practical_progress
for select to authenticated
using (public.has_school_role(school_id,array['owner','admin','employee']));

create policy practical_progress_instructor_assigned_select on public.student_practical_progress
for select to authenticated
using (
  public.has_school_role(school_id,array['instructor'])
  and exists (
    select 1 from public.instructor_student_assignments a
    where a.school_id=public.student_practical_progress.school_id
      and a.student_id=public.student_practical_progress.student_id
      and a.instructor_user_id=auth.uid()
      and a.active=true
  )
);
