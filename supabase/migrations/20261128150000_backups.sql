-- Weekly backups (M3-08): one private Storage bucket for the automatic Backups, each a
-- JSON export (M3-06) at <user id>/mythings-backup-<UTC time>.json, so each account
-- has one folder of its own. The app makes them and deletes all but the 8 newest.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  -- Private: Backups are read through signed URLs only.
  false,
  -- 50 MB: room above any likely export of one person's To-dos.
  52428800,
  -- JSON exports only.
  array['application/json']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Supabase's standard per-user folder policies: signed-in accounts reach only the
-- objects in the bucket whose first folder is their own user id. Signed-out callers
-- (anon) get no policy, so nothing. Backups are never replaced, so there is no update
-- policy: listing and reading need select, uploading insert, pruning select and delete.

create policy "Accounts read their own backups"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Accounts add their own backups"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Accounts delete their own backups"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
