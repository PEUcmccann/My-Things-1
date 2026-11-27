import type { Clock } from "./clock";
import {
  collectionNames,
  defaultSettings,
  emptySyncBook,
  recordDefaults,
  type CollectionName,
  type Collections,
  type Snapshot,
  type Stamp,
  type Store,
  type SyncCollection,
} from "./store";
import type { Edit, Settings } from "./types";

/** The one record of the `settings` collection. */
export const settingsRecordId = "settings";

/** The field an edit uses to remove a record for good (true) or bring it back (false). */
export const removedField = "_removed";

export interface SyncActions {
  /** The edits made here that haven't been sent yet, oldest first, at most one per field. */
  unsentEdits(): Edit[];
  /** Forgets edits once they have been sent. Edits made since stay unsent. */
  markEditsSent(ids: string[]): void;
  /**
   * Merges edits from another device, per field: an edit is taken only if it is more
   * recent than the field's last edit here. Creates no edits to send, and applying
   * the same edits again changes nothing. Returns how many edits were taken.
   */
  applyEdits(edits: Edit[]): number;
  /** This device's id, made once and kept with the records. */
  deviceId(): string;
}

/** A random v4 UUID, for when the app passes no generator. */
export function randomUuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

function time(at: string): number {
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? -Infinity : ms;
}

/** Which of two edits is more recent: by time, then device id, then edit id. */
function compareStamps(a: Stamp, b: Stamp): number {
  const byTime = time(a.at) - time(b.at);
  if (byTime !== 0) return byTime;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.editId !== b.editId) return a.editId < b.editId ? -1 : 1;
  return 0;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => k in b && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** A JSON copy, so edits and records never share arrays or objects. */
function copy<T>(value: T): T {
  return value === undefined ? (null as T) : (JSON.parse(JSON.stringify(value)) as T);
}

function isRecordCollection(name: string): name is CollectionName {
  return (collectionNames as string[]).includes(name);
}

type Fields = Record<string, unknown>;

/**
 * Wraps a store so every write records per-field edits for sync (ADR 0002), and adds
 * the actions that exchange edits with other devices. The records, the merge state and
 * the unsent edits all live in the wrapped store's sync book, so they are saved together.
 */
export function syncedStore(
  inner: Store,
  clock: Clock,
  newEditId: () => string,
): {
  store: Store;
  sync: SyncActions;
  replaceEverything: (records: Snapshot["records"], settings: Settings) => void;
  eraseEverything: () => void;
} {
  const book = inner.syncBook();

  function deviceId(): string {
    if (!book.deviceId) {
      book.deviceId = newEditId();
      inner.syncBookChanged();
    }
    return book.deviceId;
  }

  function stampsOf(collection: SyncCollection, recordId: string) {
    const byRecord = (book.stamps[collection] ??= {});
    return (byRecord[recordId] ??= {});
  }

  const removedOf = (collection: CollectionName) => (book.removed[collection] ??= {});

  const unsentKey = (e: Pick<Edit, "collection" | "recordId" | "field">) =>
    JSON.stringify([e.collection, e.recordId, e.field]);

  /** Records a change made on this device, and queues it to send. */
  function record(collection: SyncCollection, recordId: string, field: string, value: unknown) {
    const stamps = stampsOf(collection, recordId);
    let at = clock.now().getTime();
    // Always newer than the field's last edit here, even one from a device whose clock
    // is ahead, so the value every device merges to is the one shown here.
    const last = stamps[field];
    if (last && time(last.at) >= at) at = time(last.at) + 1;
    const edit: Edit = {
      id: newEditId(),
      collection,
      recordId,
      field,
      value: copy(value),
      editedAt: new Date(at).toISOString(),
      deviceId: deviceId(),
    };
    stamps[field] = { at: edit.editedAt, deviceId: edit.deviceId, editId: edit.id };
    const key = unsentKey(edit);
    // A newer edit of a field replaces the unsent one: only the latest can win.
    delete book.unsent[key];
    book.unsent[key] = edit;
  }

  function recordChanges(
    collection: SyncCollection,
    recordId: string,
    before: Fields | undefined,
    after: Fields,
  ) {
    const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
    fields.delete("id");
    for (const f of fields) {
      if (!same(before?.[f], after[f])) record(collection, recordId, f, after[f]);
    }
  }

  const store: Store = {
    get: (collection, id) => inner.get(collection, id),
    all: (collection) => inner.all(collection),
    settings: () => inner.settings(),
    syncBook: () => inner.syncBook(),
    syncBookChanged: () => inner.syncBookChanged(),
    put(collection, next) {
      const removed = removedOf(collection)[next.id];
      const before = removed ?? (inner.get(collection, next.id) as Fields | undefined);
      recordChanges(collection, next.id, before, next as unknown as Fields);
      if (removed) {
        // Removed for good: ordinary writes never bring a record back.
        removedOf(collection)[next.id] = { ...removed, ...copy(next) };
        inner.syncBookChanged();
      } else {
        inner.put(collection, next);
      }
    },
    remove(collection, id) {
      if (!inner.get(collection, id)) return;
      record(collection, id, removedField, true);
      removedOf(collection)[id] = {};
      inner.remove(collection, id);
    },
    saveSettings(next) {
      recordChanges(
        "settings",
        settingsRecordId,
        inner.settings() as unknown as Fields,
        next as unknown as Fields,
      );
      inner.saveSettings(next);
    },
  };

  /** Writes one incoming value, without recording it as an edit of this device. */
  function write(collection: CollectionName, recordId: string, field: string, value: unknown) {
    const removed = removedOf(collection);
    const gone = removed[recordId];
    const live = inner.get(collection, recordId) as Fields | undefined;
    const fresh = { ...recordDefaults[collection], id: recordId } as Fields;
    if (field === removedField) {
      if (value === true) {
        if (gone) return;
        removed[recordId] = {};
        if (live) inner.remove(collection, recordId);
      } else if (gone || !live) {
        delete removed[recordId];
        inner.put(collection, { ...fresh, ...gone } as unknown as Collections[CollectionName]);
      }
    } else if (gone) {
      gone[field] = value;
    } else {
      inner.put(collection, {
        ...(live ?? fresh),
        [field]: value,
      } as unknown as Collections[CollectionName]);
    }
  }

  const sync: SyncActions = {
    unsentEdits: () => copy(Object.values(book.unsent)),
    markEditsSent(ids) {
      const sent = new Set(ids);
      let changed = false;
      for (const [key, edit] of Object.entries(book.unsent)) {
        if (!sent.has(edit.id)) continue;
        delete book.unsent[key];
        changed = true;
      }
      if (changed) inner.syncBookChanged();
    },
    applyEdits(edits) {
      let taken = 0;
      for (const edit of edits) {
        const { collection, recordId, field } = edit;
        if (collection !== "settings" && !isRecordCollection(collection)) continue;
        const incoming: Stamp = { at: edit.editedAt, deviceId: edit.deviceId, editId: edit.id };
        const stamps = stampsOf(collection, recordId);
        const last = stamps[field];
        if (last && compareStamps(incoming, last) <= 0) continue;
        stamps[field] = incoming;
        taken++;
        const value = copy(edit.value);
        if (collection === "settings") {
          inner.saveSettings({ ...inner.settings(), [field]: value } as Settings);
        } else {
          write(collection, recordId, field, value);
        }
      }
      if (taken) inner.syncBookChanged();
      return taken;
    },
    deviceId,
  };

  /**
   * Replaces every record and the settings (a restore). Every field is recorded as an
   * edit made now, changed or not, and each restored record gets `_removed: false`, so
   * other devices follow the restore over their own older edits and removals. Records
   * that are not in `records` are removed for good.
   */
  function replaceEverything(records: Snapshot["records"], settings: Settings): void {
    for (const name of collectionNames) {
      const keep = new Map<string, Fields>(
        (records[name] as unknown as Fields[]).map((r) => [r.id as string, copy(r)]),
      );
      for (const live of inner.all(name)) if (!keep.has(live.id)) store.remove(name, live.id);
      for (const [id, next] of keep) {
        delete removedOf(name)[id];
        record(name, id, removedField, false);
        for (const f of Object.keys(next)) if (f !== "id") record(name, id, f, next[f]);
        inner.put(name, next as unknown as Collections[CollectionName]);
      }
    }
    const fields = settings as unknown as Fields;
    for (const f of Object.keys(fields)) record("settings", settingsRecordId, f, fields[f]);
    inner.saveSettings(settings);
    inner.syncBookChanged();
  }

  /**
   * Empties this device: no records, default settings, and fresh sync bookkeeping
   * (only the device id is kept). Nothing is recorded as an edit, so other devices and
   * the account keep everything.
   */
  function eraseEverything(): void {
    for (const name of collectionNames) {
      for (const live of inner.all(name)) inner.remove(name, live.id);
    }
    inner.saveSettings(defaultSettings);
    const { deviceId: id } = book;
    for (const key of Object.keys(book)) delete (book as unknown as Record<string, unknown>)[key];
    Object.assign(book, emptySyncBook(), { deviceId: id });
    inner.syncBookChanged();
  }

  return { store, sync, replaceEverything, eraseEverything };
}
