import type { MyThings } from "../core";
import { syncError, type ReceivedEdit, type Remote } from "./remote";

// Sync while signed in (ADR 0002): send this device's unsent edits, then fetch the
// account's edits not seen yet and let the core merge them. state.tsx decides when.

/** Edits sent per request. */
export const sendBatch = 500;
/** Edits fetched per request. */
export const fetchPage = 1000;
/**
 * How far before the last edit seen a fetch starts again: rows can commit slightly out
 * of order of their receive times, and applying an edit twice is harmless.
 */
export const overlapMs = 2 * 60_000;

export type SyncStatus =
  /** No sync has finished since signing in or starting the app. */
  | { kind: "notYet" }
  | { kind: "syncing"; lastSyncedAt: number | null }
  | { kind: "synced"; at: number }
  | { kind: "offline"; lastSyncedAt: number | null }
  | { kind: "failed"; reason: string; lastSyncedAt: number | null };

/** What one sync did. */
export interface SyncResult {
  sent: number;
  fetched: number;
  applied: number;
}

/** The parts of the core a sync uses. */
type SyncApp = Pick<
  MyThings,
  | "unsentEdits"
  | "markEditsSent"
  | "applyEdits"
  | "lastReceivedAt"
  | "setLastReceivedAt"
  | "queueAllRecords"
>;

export interface Syncer {
  /**
   * Syncs, or, while a sync is under way, asks it to run once more and waits for that.
   * Never throws: a failure shows in `status`, and the next sync tries again.
   */
  sync(): Promise<SyncResult | null>;
  status(): SyncStatus;
  /** True while the syncer itself writes to the core, so those writes aren't synced back. */
  isWriting(): boolean;
  /** For signing out: no more syncs, and a sync under way changes nothing more here. */
  stop(): void;
}

export function createSyncer(
  app: SyncApp,
  remote: Remote,
  {
    now = Date.now,
    onStatus,
  }: { now?: () => number; onStatus?: (status: SyncStatus) => void } = {},
): Syncer {
  let status: SyncStatus = { kind: "notYet" };
  let running: Promise<SyncResult | null> | null = null;
  let again = false;
  let stopped = false;
  let writing = false;
  let lastSyncedAt: number | null = null;

  const set = (next: SyncStatus) => {
    status = next;
    if (!stopped) onStatus?.(next);
  };

  function write<T>(action: () => T): T {
    writing = true;
    try {
      return action();
    } finally {
      writing = false;
    }
  }

  async function once(): Promise<SyncResult | null> {
    set({ kind: "syncing", lastSyncedAt });
    const sentIds: string[] = [];
    try {
      // A device that has never fetched sends everything, so the account gets the
      // records made here before signing in (the core keeps their edit times).
      if (app.lastReceivedAt() === null) write(() => app.queueAllRecords());
      const unsent = app.unsentEdits();
      try {
        for (let i = 0; i < unsent.length; i += sendBatch) {
          const batch = unsent.slice(i, i + sendBatch);
          await remote.send(batch);
          if (stopped) return null;
          for (const edit of batch) sentIds.push(edit.id);
        }
      } finally {
        // Only edits whose insert succeeded count as sent.
        if (!stopped && sentIds.length) write(() => app.markEditsSent(sentIds));
      }

      const last = app.lastReceivedAt();
      const after = last ? new Date(Date.parse(last) - overlapMs).toISOString() : null;
      const fetched: ReceivedEdit[] = [];
      for (let offset = 0; ; offset += fetchPage) {
        const page = await remote.fetch(after, offset, fetchPage);
        if (stopped) return null;
        fetched.push(...page);
        if (page.length < fetchPage) break;
      }
      // Every page is applied in one go, so the screen refreshes once, and the point to
      // fetch from next moves on only after the edits are in.
      const applied = write(() => {
        const taken = app.applyEdits(fetched);
        const newest = fetched.at(-1)?.receivedAt;
        if (newest && (!last || Date.parse(newest) >= Date.parse(last))) {
          app.setLastReceivedAt(newest);
        }
        return taken;
      });
      lastSyncedAt = now();
      set({ kind: "synced", at: lastSyncedAt });
      return { sent: sentIds.length, fetched: fetched.length, applied };
    } catch (error) {
      if (stopped) return null;
      const e = syncError(error);
      set(
        e.kind === "offline"
          ? { kind: "offline", lastSyncedAt }
          : { kind: "failed", reason: e.message, lastSyncedAt },
      );
      return null;
    }
  }

  return {
    sync() {
      if (stopped) return Promise.resolve(null);
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        let result: SyncResult | null;
        do {
          again = false;
          result = await once();
        } while (again && !stopped);
        return result;
      })().finally(() => {
        running = null;
      });
      return running;
    },
    status: () => status,
    isWriting: () => writing,
    stop() {
      stopped = true;
    },
  };
}

/** Settings → Account's line about sync. */
export function syncStatusText(status: SyncStatus, now: number): string {
  switch (status.kind) {
    case "notYet":
    case "syncing":
      return "Syncing…";
    case "offline":
      return "Offline: changes will sync when you're back online";
    case "failed":
      return `Sync failed: ${status.reason}`;
    case "synced": {
      const minutes = Math.floor(Math.max(0, now - status.at) / 60_000);
      if (minutes < 1) return "Synced just now";
      if (minutes < 60) return `Synced ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
      const hours = Math.floor(minutes / 60);
      return `Synced ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }
  }
}
