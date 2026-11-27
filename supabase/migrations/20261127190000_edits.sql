-- Sync between devices (M3-04, ADR 0002): one append-only table of edits, one row per
-- edit in the shape the core defines (src/core/types.ts, Edit). Devices insert their
-- edits and fetch the ones they haven't seen; all merging happens in the app's core.

create table public.edits (
  -- The edit's own v4 UUID, so sending an edit twice is harmless.
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- "toDos", "projects", ..., or "settings".
  collection text not null,
  record_id text not null,
  -- A record field, or "_removed".
  field text not null,
  value jsonb,
  -- The device clock when the edit was made; the core merges by it.
  edited_at timestamptz not null,
  device_id text not null,
  -- The server clock when the edit arrived; devices fetch from it.
  received_at timestamptz not null default now()
);

comment on table public.edits is
  'Append-only per-field edits for sync (ADR 0002). Each account sees only its own rows.';

create index edits_owner_received_at_idx on public.edits (owner, received_at);

alter table public.edits enable row level security;

-- Supabase grants every new table to anon and authenticated by default. Signed-out
-- callers get nothing, and signed-in ones may only read and add rows. Only the edit's
-- own columns can be written, so the owner and receive time always come from the server.
revoke all on table public.edits from anon, authenticated;
grant select on table public.edits to authenticated;
grant insert (id, collection, record_id, field, value, edited_at, device_id)
  on table public.edits to authenticated;

create policy "Accounts read their own edits"
  on public.edits for select to authenticated
  using (owner = (select auth.uid()));

create policy "Accounts add their own edits"
  on public.edits for insert to authenticated
  with check (owner = (select auth.uid()));

-- No update or delete policy: edits are never changed, and they go only when the
-- account is deleted (on delete cascade).
