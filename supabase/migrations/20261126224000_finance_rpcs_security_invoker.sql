-- Finance RPCs do not need SECURITY DEFINER: owner RLS policies authorize
-- the caller's writes directly. Run these functions with invoker privileges.
alter function public.save_student_contract(uuid, date, numeric, date) security invoker;
alter function public.record_student_payment(uuid, numeric, text, date, text, text) security invoker;

revoke all on function public.save_student_contract(uuid, date, numeric, date) from public, anon;
revoke all on function public.record_student_payment(uuid, numeric, text, date, text, text) from public, anon;
grant execute on function public.save_student_contract(uuid, date, numeric, date) to authenticated;
grant execute on function public.record_student_payment(uuid, numeric, text, date, text, text) to authenticated;

notify pgrst, 'reload schema';
