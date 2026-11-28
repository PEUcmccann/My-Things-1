import { fakeBackend } from "./backendConfig";
import { fakeStorage, supabaseStorage, type FileStorage } from "./fileStorage";
import { getSupabase } from "./supabase";

/** The private Storage buckets the app uses (supabase/migrations/). */
export type Bucket = "attachments" | "backups";

/**
 * A private bucket of the signed-in account's files: Supabase Storage in the app, a
 * fake kept in memory in the `test:ui` build. Backups are never replaced, and their
 * bucket has no update policy, so its uploads don't upsert.
 */
export function deviceFileStorage(bucket: Bucket): FileStorage {
  const options = { replace: bucket !== "backups" };
  return fakeBackend
    ? fakeStorage(bucket, options)
    : supabaseStorage(getSupabase(), bucket, options);
}
