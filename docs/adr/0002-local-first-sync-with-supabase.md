# Local-first storage, synced through Supabase

Each device keeps its own database, and that local copy is the source of truth, so MyThings works offline and every action is instant. Changes sync through Supabase, which provides Postgres, login and file storage for attachments. We chose this over a server-first design, which would be slow or unusable without signal. Postgres row-level security also leaves room to add shared projects later without changing the data model.

## Consequences

Sync has to detect and resolve conflicting edits made on different devices while offline.
