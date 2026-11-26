-- ConduiPRO — Cross-tenant relationship validation (draft)
-- Prevents mismatched school ownership on course, curriculum, messaging and payment links.
-- Review and test in a disposable Supabase project before applying.

create or replace function public.validate_theory_course_module_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  module_school uuid;
begin
  select p.school_id into module_school
  from public.curriculum_modules m
  join public.curriculum_phases p on p.id=m.phase_id
  where m.id=new.module_id;

  if not found then
    raise exception 'Theory course module does not exist';
  end if;

  if module_school is not null and module_school <> new.school_id then
    raise exception 'Theory course module belongs to another school';
  end if;

  return new;
end;
$$;

drop trigger if exists theory_course_module_school_guard on public.theory_courses;
create trigger theory_course_module_school_guard
before insert or update of school_id,module_id on public.theory_courses
for each row execute function public.validate_theory_course_module_school();

create or replace function public.validate_enrollment_course_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  course_school uuid;
begin
  select c.school_id into course_school
  from public.theory_courses c where c.id=new.course_id;

  if not found or course_school <> new.school_id then
    raise exception 'Enrollment course must belong to the same school';
  end if;

  return new;
end;
$$;

drop trigger if exists enrollment_course_school_guard on public.theory_course_enrollments;
create trigger enrollment_course_school_guard
before insert or update of school_id,course_id on public.theory_course_enrollments
for each row execute function public.validate_enrollment_course_school();

create or replace function public.validate_course_request_curriculum_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_school uuid;
begin
  if new.request_type='theory' then
    select p.school_id into item_school
    from public.curriculum_modules m
    join public.curriculum_phases p on p.id=m.phase_id
    where m.id=new.module_id;

    if not found or (item_school is not null and item_school <> new.school_id) then
      raise exception 'Requested theory module must be global or belong to the same school';
    end if;
  elsif new.request_type='practical' then
    select p.school_id into item_school
    from public.practical_lessons l
    join public.curriculum_phases p on p.id=l.phase_id
    where l.id=new.practical_lesson_id;

    if not found or (item_school is not null and item_school <> new.school_id) then
      raise exception 'Requested practical lesson must be global or belong to the same school';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists course_request_curriculum_school_guard on public.course_requests;
create trigger course_request_curriculum_school_guard
before insert or update of school_id,request_type,module_id,practical_lesson_id
on public.course_requests
for each row execute function public.validate_course_request_curriculum_school();

create or replace function public.validate_message_conversation_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  conversation_school uuid;
begin
  select c.school_id into conversation_school
  from public.conversations c where c.id=new.conversation_id;

  if not found or conversation_school <> new.school_id then
    raise exception 'Message conversation must belong to the same school';
  end if;

  return new;
end;
$$;

drop trigger if exists message_conversation_school_guard on public.messages;
create trigger message_conversation_school_guard
before insert or update of school_id,conversation_id on public.messages
for each row execute function public.validate_message_conversation_school();

create or replace function public.validate_payment_invoice_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  invoice_school uuid;
  invoice_student uuid;
begin
  if new.invoice_id is null then
    return new;
  end if;

  select i.school_id,i.student_id into invoice_school,invoice_student
  from public.invoices i where i.id=new.invoice_id;

  if not found or invoice_school <> new.school_id or invoice_student <> new.student_id then
    raise exception 'Payment invoice must match payment school and student';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_invoice_link_guard on public.payments;
create trigger payment_invoice_link_guard
before insert or update of school_id,student_id,invoice_id on public.payments
for each row execute function public.validate_payment_invoice_link();

create or replace function public.validate_instructor_assignment_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  member_role text;
begin
  select sm.role into member_role
  from public.school_members sm
  where sm.school_id=new.school_id
    and sm.user_id=new.instructor_user_id
    and sm.status='active';

  if not found or member_role <> 'instructor' then
    raise exception 'Assignment target must be an active instructor in this school';
  end if;

  return new;
end;
$$;

drop trigger if exists instructor_assignment_role_guard on public.instructor_student_assignments;
create trigger instructor_assignment_role_guard
before insert or update of school_id,instructor_user_id on public.instructor_student_assignments
for each row execute function public.validate_instructor_assignment_role();
