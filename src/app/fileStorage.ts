import type { SupabaseClient } from "@supabase/supabase-js";

// Files in one private Supabase Storage bucket, each account in its own folder
// (supabase/migrations/*_attachments.sql). Attachments use the `attachments` bucket;
// other features (backups) can open their own bucket through the same seam.

/** A file's contents to upload: an ArrayBuffer in Expo Go, a Blob on the web. */
export type FileBody = ArrayBuffer | Blob;

export interface FileStorage {
  /** Stores a file at `path`, replacing any there. Throws a StorageError. */
  upload(path: string, body: FileBody, contentType: string): Promise<void>;
  /** Deletes files; paths with no file are ignored. Throws a StorageError. */
  remove(paths: string[]): Promise<void>;
  /** A link that reads the file for `seconds`. Throws a StorageError ("missing" if none). */
  signedUrl(path: string, seconds: number): Promise<string>;
}

/** "missing": no file at the path. "offline": the request didn't get through. */
export type StorageErrorKind = "missing" | "offline" | "failed";

export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/** From an error returned by storage-js, or thrown by fetch. */
export function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const e = (error ?? {}) as { message?: string; statusCode?: string; status?: number };
  const message = e.message?.trim() || "unknown error";
  if (e.statusCode === "404" || e.status === 404 || /not found/i.test(message)) {
    return new StorageError("missing", message);
  }
  if (/fetch|network|load failed/i.test(message)) return new StorageError("offline", message);
  return new StorageError("failed", message);
}

/** Runs a storage-js call, turning its returned or thrown error into a StorageError. */
async function run<T>(call: () => Promise<{ data: T; error: unknown }>): Promise<T> {
  let result: { data: T; error: unknown };
  try {
    result = await call();
  } catch (thrown) {
    throw storageError(thrown);
  }
  if (result.error) throw storageError(result.error);
  return result.data;
}

/** One bucket of Supabase Storage, as the signed-in account. */
export function supabaseStorage(client: SupabaseClient, bucket: string): FileStorage {
  const files = () => client.storage.from(bucket);
  return {
    async upload(path, body, contentType) {
      await run(() => files().upload(path, body, { contentType, upsert: true }));
    },
    async remove(paths) {
      if (paths.length) await run(() => files().remove(paths));
    },
    async signedUrl(path, seconds) {
      const data = await run(() => files().createSignedUrl(path, seconds));
      if (!data) throw new StorageError("failed", "No signed URL");
      return data.signedUrl;
    },
  };
}

/** Files kept per bucket for the page's life, shared by every fakeStorage of that bucket. */
const fakeBuckets = new Map<string, Map<string, Blob>>();

/**
 * A bucket kept in memory, for the `test:ui` build and tests. Its signed URLs are
 * object URLs of the stored Blobs, so images show as they would from Supabase.
 */
export function fakeStorage(bucket = `fake-${Math.random()}`): FileStorage {
  const files = fakeBuckets.get(bucket) ?? new Map<string, Blob>();
  fakeBuckets.set(bucket, files);
  return {
    async upload(path, body, contentType) {
      files.set(path, body instanceof Blob ? body : new Blob([body], { type: contentType }));
    },
    async remove(paths) {
      for (const path of paths) files.delete(path);
    },
    async signedUrl(path) {
      const file = files.get(path);
      if (!file) throw new StorageError("missing", "Object not found");
      return URL.createObjectURL(file);
    },
  };
}
