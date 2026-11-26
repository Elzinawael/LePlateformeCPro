-- ConduiPRO — private student documents bucket and tenant-scoped object policies
-- Object path convention: <school_uuid>/<student_uuid>/<opaque-file-name>
-- The bucket contains learner permits and other private student documents.

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'student-documents',
  'student-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists conduipro_student_documents_read on storage.objects;
create policy conduipro_student_documents_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'student-documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[2]
      and s.school_id::text = (storage.foldername(name))[1]
      and (
        s.user_id = (select auth.uid())
        or public.has_school_role(
          s.school_id,
          array['owner', 'admin', 'employee']::text[]
        )
      )
  )
);

drop policy if exists conduipro_student_documents_upload on storage.objects;
create policy conduipro_student_documents_upload
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[2]
      and s.school_id::text = (storage.foldername(name))[1]
      and (
        s.user_id = (select auth.uid())
        or public.has_school_role(
          s.school_id,
          array['owner', 'admin', 'employee']::text[]
        )
      )
  )
);

drop policy if exists conduipro_student_documents_update on storage.objects;
create policy conduipro_student_documents_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'student-documents'
  and public.has_school_role(
    (storage.foldername(name))[1]::uuid,
    array['owner', 'admin', 'employee']::text[]
  )
)
with check (
  bucket_id = 'student-documents'
  and public.has_school_role(
    (storage.foldername(name))[1]::uuid,
    array['owner', 'admin', 'employee']::text[]
  )
);

drop policy if exists conduipro_student_documents_delete on storage.objects;
create policy conduipro_student_documents_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-documents'
  and public.has_school_role(
    (storage.foldername(name))[1]::uuid,
    array['owner', 'admin', 'employee']::text[]
  )
);
