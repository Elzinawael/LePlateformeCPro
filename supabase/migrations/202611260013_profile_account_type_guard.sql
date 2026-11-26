-- ConduiPRO — prevent self-service account type changes
-- Server-side/service-role provisioning may still change account_type.

create or replace function public.guard_profile_account_type()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and new.account_type is distinct from old.account_type then
    raise exception 'Account type changes must be performed by authorized server-side provisioning';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_account_type_guard on public.profiles;
create trigger profiles_account_type_guard
before update of account_type on public.profiles
for each row execute function public.guard_profile_account_type();
