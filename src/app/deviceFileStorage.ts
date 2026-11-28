import { fakeBackend } from "./backendConfig";
import { fakeStorage, supabaseStorage, type FileStorage } from "./fileStorage";
import { getSupabase } from "./supabase";

/** The private Storage buckets the app uses (supabase/migrations/). */
export type Bucket = "attachments";

/**
 * A private bucket of the signed-in account's files: Supabase Storage in the app, a
 * fake kept in memory in the `test:ui` build.
 */
export function deviceFileStorage(bucket: Bucket): FileStorage {
  return fakeBackend ? fakeStorage(bucket) : supabaseStorage(getSupabase(), bucket);
}
