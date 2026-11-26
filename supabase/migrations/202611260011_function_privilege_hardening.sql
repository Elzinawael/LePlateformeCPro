-- ConduiPRO — live security advisor remediation draft
-- Explicitly revoke API role EXECUTE from SECURITY DEFINER helpers and the event trigger.
-- This migration has not been applied to the live project.

alter function public.current_student_id() set search_path = public;
alter function public.has_school_role(uuid,text[]) set search_path = public;
alter function public.is_school_member(uuid) set search_path = public;
alter function public.rls_auto_enable() set search_path = pg_catalog;
alter function public.set_updated_at() set search_path = pg_catalog, public;

revoke all on function public.current_student_id() from public, anon;
revoke all on function public.has_school_role(uuid,text[]) from public, anon;
revoke all on function public.is_school_member(uuid) from public, anon;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.current_student_id() to authenticated;
grant execute on function public.has_school_role(uuid,text[]) to authenticated;
grant execute on function public.is_school_member(uuid) to authenticated;

-- The event-trigger function should remain owned by postgres and must not be callable
-- by API roles. Event-trigger execution is managed by PostgreSQL.
