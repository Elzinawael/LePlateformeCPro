-- ConduiPRO / LePlateformeCPro — Initial schema (V1)
-- PostgreSQL / Supabase. All timestamps are UTC.
create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  email text,
  phone text,
  address text,
  city text,
  province text not null default 'Québec',
  postal_code text,
  logo_path text,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  account_type text not null check (account_type in ('school','student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','employee','instructor')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  unique (school_id,user_id)
);

create table public.school_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  contract_number text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  address text,
  city text,
  postal_code text,
  enrollment_date date not null default current_date,
  status text not null default 'active' check (status in ('active','inactive','completed','withdrawn')),
  current_phase_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,contract_number)
);

create table public.student_contracts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  contract_number text not null,
  contract_date date,
  contract_amount numeric(12,2) not null default 0 check(contract_amount >= 0),
  currency text not null default 'CAD',
  contract_file_path text,
  status text not null default 'active' check(status in ('draft','active','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.student_licenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  license_number text,
  license_class text,
  issue_date date,
  expiry_date date,
  document_path text,
  verification_status text not null default 'pending' check(verification_status in ('pending','approved','rejected')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint check(file_size is null or file_size >= 0),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.curriculum_phases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  phase_number integer not null check(phase_number between 1 and 4),
  name text not null,
  description text,
  sort_order integer not null,
  is_active boolean not null default true,
  unique(school_id,phase_number)
);

create table public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.curriculum_phases(id) on delete cascade,
  module_number integer not null,
  name text not null,
  description text,
  duration_minutes integer not null default 120 check(duration_minutes > 0),
  sort_order integer not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  unique(phase_id,module_number)
);

create table public.practical_lessons (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.curriculum_phases(id) on delete cascade,
  lesson_number integer not null,
  name text not null,
  description text,
  duration_minutes integer not null default 55 check(duration_minutes > 0),
  sort_order integer not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  unique(phase_id,lesson_number)
);

alter table public.students add constraint students_current_phase_fk
  foreign key (current_phase_id) references public.curriculum_phases(id) on delete set null;

create table public.student_module_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  module_id uuid not null references public.curriculum_modules(id) on delete cascade,
  status text not null default 'not_started' check(status in ('not_started','scheduled','in_progress','completed')),
  completed_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  notes text,
  updated_at timestamptz not null default now(),
  unique(student_id,module_id)
);

create table public.student_practical_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.practical_lessons(id) on delete cascade,
  status text not null default 'not_started' check(status in ('not_started','scheduled','in_progress','completed')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  notes text,
  updated_at timestamptz not null default now(),
  unique(student_id,lesson_id)
);

create table public.theory_courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  module_id uuid not null references public.curriculum_modules(id) on delete restrict,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null check(end_at > start_at),
  capacity integer not null check(capacity > 0),
  location text,
  status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.theory_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  course_id uuid not null references public.theory_courses(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'enrolled' check(status in ('enrolled','cancelled','attended','absent')),
  enrolled_at timestamptz not null default now(),
  attended_at timestamptz,
  unique(course_id,student_id)
);

create table public.course_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  request_type text not null check(request_type in ('theory','practical')),
  module_id uuid references public.curriculum_modules(id) on delete restrict,
  practical_lesson_id uuid references public.practical_lessons(id) on delete restrict,
  availability_text text,
  preferred_course_id uuid references public.theory_courses(id) on delete set null,
  status text not null default 'submitted' check(status in ('submitted','processing','approved','rejected')),
  student_message text,
  school_response text,
  processed_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((request_type='theory' and module_id is not null) or (request_type='practical' and availability_text is not null))
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0 check(subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check(tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check(total_amount >= 0),
  currency text not null default 'CAD',
  status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','overdue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  unique(school_id,invoice_number)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12,2) not null check(amount > 0),
  payment_method text not null check(payment_method in ('cash','debit','credit','transfer','other')),
  payment_date date not null default current_date,
  reference text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject text,
  status text not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_monthly numeric(12,2) not null default 0 check(price_monthly >= 0),
  price_yearly numeric(12,2) not null default 0 check(price_yearly >= 0),
  student_limit integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.school_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status text not null default 'trial' check(status in ('trial','active','past_due','cancelled')),
  billing_cycle text check(billing_cycle in ('monthly','yearly')),
  start_date date not null default current_date,
  end_date date,
  trial_end_date date,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for common tenant-scoped lookups
create index students_school_idx on public.students(school_id);
create index students_school_last_first_idx on public.students(school_id,last_name,first_name);
create index student_documents_student_idx on public.student_documents(school_id,student_id);
create index student_module_progress_student_idx on public.student_module_progress(school_id,student_id);
create index student_practical_progress_student_idx on public.student_practical_progress(school_id,student_id);
create index theory_courses_school_start_idx on public.theory_courses(school_id,start_at);
create index enrollments_student_idx on public.theory_course_enrollments(school_id,student_id);
create index course_requests_school_status_idx on public.course_requests(school_id,status,created_at);
create index invoices_student_idx on public.invoices(school_id,student_id,status);
create index payments_student_date_idx on public.payments(school_id,student_id,payment_date);
create index notifications_user_unread_idx on public.notifications(user_id,read_at,created_at);
create index messages_conversation_date_idx on public.messages(conversation_id,created_at);
create index audit_logs_school_date_idx on public.audit_logs(school_id,created_at);

-- updated_at helper and triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger schools_set_updated_at before update on public.schools
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();
create trigger course_requests_set_updated_at before update on public.course_requests
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

-- RLS is enabled immediately. Policies are added in the dedicated security migration.
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_members enable row level security;
alter table public.school_settings enable row level security;
alter table public.students enable row level security;
alter table public.student_contracts enable row level security;
alter table public.student_licenses enable row level security;
alter table public.student_documents enable row level security;
alter table public.curriculum_phases enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.practical_lessons enable row level security;
alter table public.student_module_progress enable row level security;
alter table public.student_practical_progress enable row level security;
alter table public.theory_courses enable row level security;
alter table public.theory_course_enrollments enable row level security;
alter table public.course_requests enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.school_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- No permissive policies are added in this migration: until the security migration,
-- these tables are inaccessible to ordinary API roles (deny-by-default).
