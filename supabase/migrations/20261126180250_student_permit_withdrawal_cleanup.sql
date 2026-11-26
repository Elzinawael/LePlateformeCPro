-- ConduiPRO — allow a student to withdraw only their own unreviewed permit upload.
-- This supports safe cleanup if the matching license metadata insert fails.

drop policy if exists student_documents_student_delete on public.student_documents;
create policy student_documents_student_delete
on public.student_documents
for delete to authenticated
using (
  student_id = (select public.current_student_id())
  and uploaded_by = (select auth.uid())
  and document_type = 'learner_permit'
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
);

drop policy if exists conduipro_student_documents_student_delete on storage.objects;
create policy conduipro_student_documents_student_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-documents'
  and exists (
    select 1
    from public.students s
    join public.student_documents d
      on d.student_id = s.id
     and d.school_id = s.school_id
     and d.storage_path = storage.objects.name
    where s.user_id = (select auth.uid())
      and d.uploaded_by = (select auth.uid())
      and d.document_type = 'learner_permit'
      and d.status = 'pending'
      and d.reviewed_by is null
      and d.reviewed_at is null
      and d.rejection_reason is null
      and s.school_id::text = (storage.foldername(storage.objects.name))[1]
      and s.id::text = (storage.foldername(storage.objects.name))[2]
  )
);
