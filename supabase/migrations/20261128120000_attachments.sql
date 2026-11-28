-- Attachments (M3-05): one private Storage bucket for the files attached to To-dos and
-- their thumbnails. The details of each Attachment sync as edits (the `attachments`
-- collection); only the files live here, at <user id>/<attachment id>/<file name> and
-- <user id>/<attachment id>/thumbnail.jpg, so each account has one folder of its own.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  -- Private: files are read through signed URLs only.
  false,
  -- 25 MB (plan.md), the same limit the app checks before uploading.
  26214400,
  -- Any file type.
  null
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Supabase's standard per-user folder policies: signed-in accounts reach only the
-- objects in the bucket whose first folder is their own user id. Signed-out callers
-- (anon) get no policy, so nothing. An upsert needs insert, select and update together;
-- removing a file needs select and delete.

create policy "Accounts read their own attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Accounts add their own attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Accounts replace their own attachments"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Accounts delete their own attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
