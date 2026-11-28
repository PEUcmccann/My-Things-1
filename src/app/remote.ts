import type { SupabaseClient } from "@supabase/supabase-js";
import type { Edit, Moment } from "../core";
import { didNotGetThrough, settled } from "./requests";

// The account's edits on the server (supabase/migrations/*_edits.sql): one append-only
// table, one row per edit, each account seeing only its own rows. All merging happens
// in the core; the remote only stores edits and hands them back.

/** An edit as the account holds it, with the server time it arrived. */
export interface ReceivedEdit extends Edit {
  receivedAt: Moment;
}

export interface Remote {
  /** Adds edits to the account, ignoring any it already has. Throws a SyncError. */
  send(edits: Edit[]): Promise<void>;
  /**
   * One page of the account's edits received after `after` (all of them when null),
   * ordered by receive time, then id. Throws a SyncError.
   */
  fetch(after: Moment | null, offset: number, limit: number): Promise<ReceivedEdit[]>;
}

export type SyncErrorKind = "offline" | "failed";

/** A request that didn't get through ("offline") or that the server refused. */
export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

/** From an error returned by supabase-js, or thrown by fetch. */
export function syncError(error: unknown): SyncError {
  if (error instanceof SyncError) return error;
  const e = (error ?? {}) as { name?: string; code?: string; message?: string };
  const message = e.message?.trim() || "unknown error";
  // postgrest-js reports a failed fetch as an error without a code.
  if (!e.code && didNotGetThrough(message)) {
    return new SyncError("offline", message);
  }
  return new SyncError("failed", message);
}

interface Row {
  id: string;
  collection: string;
  record_id: string;
  field: string;
  value: unknown;
  edited_at: string;
  device_id: string;
  received_at: string;
}

const columns = "id,collection,record_id,field,value,edited_at,device_id,received_at";

/**
 * The `edits` table through PostgREST. The owner and receive time are set by the
 * server (column defaults), and row-level security keeps each account to its own rows.
 */
export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async send(edits) {
      const rows = edits.map((e) => ({
        id: e.id,
        collection: e.collection,
        record_id: e.recordId,
        field: e.field,
        value: e.value,
        edited_at: e.editedAt,
        device_id: e.deviceId,
      }));
      const { error } = await settled(
        client.from("edits").upsert(rows, { onConflict: "id", ignoreDuplicates: true }),
      );
      if (error) throw syncError(error);
    },
    async fetch(after, offset, limit) {
      let query = client.from("edits").select(columns);
      if (after) query = query.gt("received_at", after);
      const { data, error } = await settled(
        query
          .order("received_at")
          .order("id")
          .range(offset, offset + limit - 1),
      );
      if (error) throw syncError(error);
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        collection: r.collection,
        recordId: r.record_id,
        field: r.field,
        value: r.value,
        editedAt: new Date(r.edited_at).toISOString(),
        deviceId: r.device_id,
        receivedAt: r.received_at,
      }));
    },
  };
}

/** The synchronous part of localStorage, so two pages of one browser share the fake. */
export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memorySyncStorage(): SyncStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/**
 * A remote kept in `storage` (localStorage in the `test:ui` build), one list of edits
 * per account, with receive times from `now` that never go backwards.
 */
export function fakeRemote(
  storage: SyncStorage,
  owner: string,
  now: () => number = Date.now,
): Remote {
  const key = `mythings:fake-remote:${owner}`;
  const read = (): ReceivedEdit[] => JSON.parse(storage.getItem(key) ?? "[]") as ReceivedEdit[];
  return {
    async send(edits) {
      // Read and write in one go, so another page's send isn't lost in between.
      const rows = read();
      const have = new Set(rows.map((r) => r.id));
      const last = rows.length ? Date.parse(rows[rows.length - 1].receivedAt) : -Infinity;
      const receivedAt = new Date(Math.max(now(), last + 1)).toISOString();
      for (const edit of edits) {
        if (have.has(edit.id)) continue;
        have.add(edit.id);
        rows.push({ ...JSON.parse(JSON.stringify(edit)), receivedAt });
      }
      storage.setItem(key, JSON.stringify(rows));
    },
    async fetch(after, offset, limit) {
      return read()
        .filter((r) => after === null || r.receivedAt > after)
        .sort((a, b) =>
          a.receivedAt !== b.receivedAt
            ? a.receivedAt < b.receivedAt
              ? -1
              : 1
            : a.id < b.id
              ? -1
              : a.id > b.id
                ? 1
                : 0,
        )
        .slice(offset, offset + limit);
    },
  };
}
