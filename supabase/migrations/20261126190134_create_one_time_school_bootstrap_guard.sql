-- One-time guard for initial ConduiPRO school bootstrap.
create table if not exists public.conduipro_bootstrap_guard (
  singleton boolean primary key default true check (singleton is true),
  created_at timestamptz not null default now(),
  owner_email text not null
);

alter table public.conduipro_bootstrap_guard enable row level security;
revoke all on public.conduipro_bootstrap_guard from public, anon, authenticated;
