import type {
  Area,
  ChecklistItem,
  Edit,
  Heading,
  Moment,
  Project,
  Settings,
  SmartList,
  Tag,
  ToDo,
} from "./types";

export interface Collections {
  areas: Area;
  projects: Project;
  headings: Heading;
  toDos: ToDo;
  checklistItems: ChecklistItem;
  tags: Tag;
  smartLists: SmartList;
}

export type CollectionName = keyof Collections;

/** Where the core keeps its records. The app saves them on the device; tests use memory. */
export interface Store {
  get<C extends CollectionName>(collection: C, id: string): Collections[C] | undefined;
  put<C extends CollectionName>(collection: C, record: Collections[C]): void;
  remove(collection: CollectionName, id: string): void;
  all<C extends CollectionName>(collection: C): Collections[C][];
  settings(): Settings;
  saveSettings(settings: Settings): void;
  /**
   * The sync bookkeeping kept with the records, as live data: the core's sync layer
   * (sync.ts) changes it in place, then calls `syncBookChanged` so it is saved.
   */
  syncBook(): SyncBook;
  syncBookChanged(): void;
}

/** The last edit of one field here: when, on which device, and which edit (ADR 0002). */
export interface Stamp {
  at: Moment;
  deviceId: string;
  editId: string;
}

/** The collections edits name: every record collection, and the settings. */
export type SyncCollection = CollectionName | "settings";

/**
 * What one device keeps to sync (ADR 0002): per record, the last edit of each field,
 * `_removed` included; the records removed for good, with any field values that
 * arrived after the removal; and the edits not sent yet, at most one per field.
 */
export interface SyncBook {
  /** A v4 UUID made once per device, on first use. */
  deviceId: string | null;
  stamps: { [collection: string]: { [recordId: string]: { [field: string]: Stamp } } };
  removed: { [collection: string]: { [recordId: string]: { [field: string]: unknown } } };
  /** Keyed by collection, record id and field; oldest first. */
  unsent: { [key: string]: Edit };
}

/** Everything in a store, as plain data that can be saved and loaded again. */
export interface Snapshot {
  version: 2;
  records: { [C in CollectionName]: Collections[C][] };
  settings: Settings;
  sync: SyncBook;
}

/** A snapshot saved before sync, by Milestones 1 and 2. */
export interface SnapshotV1 {
  version: 1;
  records: Partial<{ [C in CollectionName]: Collections[C][] }>;
  settings: Settings;
}

export const defaultSettings: Settings = { logbookMode: "endOfDay", accentColour: "teal" };

export const collectionNames: CollectionName[] = [
  "areas",
  "projects",
  "headings",
  "toDos",
  "checklistItems",
  "tags",
  "smartLists",
];

/** Defaults for fields that records saved by earlier versions, or synced in part, may lack. */
export const recordDefaults: { [C in CollectionName]: Partial<Collections[C]> } = {
  areas: { tagIds: [], position: 0 },
  projects: {
    tagIds: [],
    notes: "",
    position: 0,
    finishedAt: null,
    loggedAt: null,
  },
  headings: { position: 0, archivedAt: null },
  toDos: {
    tagIds: [],
    notes: "",
    position: 0,
    todayPosition: null,
    timeSlot: null,
    priority: "none",
    energy: null,
    estimate: null,
    repeat: null,
    seriesId: null,
    seriesValues: null,
  },
  checklistItems: {},
  tags: {},
  smartLists: {},
};

export interface MemoryStore extends Store {
  snapshot(): Snapshot;
}

export function emptySyncBook(): SyncBook {
  return { deviceId: null, stamps: {}, removed: {}, unsent: {} };
}

/**
 * The bookkeeping for a snapshot saved before sync: each field was last edited at its
 * record's `updatedAt`, on no device in particular, and nothing waits to be sent.
 */
function syncBookFromV1(records: SnapshotV1["records"]): SyncBook {
  const book = emptySyncBook();
  for (const name of collectionNames) {
    const stamps: SyncBook["stamps"][string] = {};
    for (const record of records[name] ?? []) {
      const stamp: Stamp = { at: record.updatedAt, deviceId: "", editId: "" };
      stamps[record.id] = Object.fromEntries(
        Object.keys(record)
          .filter((f) => f !== "id")
          .map((f) => [f, { ...stamp }]),
      );
    }
    book.stamps[name] = stamps;
  }
  return book;
}

/**
 * A store held in memory. It can start from a saved snapshot of either version, and
 * calls `onChange` after every write so the app can save it to the device.
 */
export function memoryStore(initial?: Snapshot | SnapshotV1, onChange?: () => void): MemoryStore {
  const data = {} as { [C in CollectionName]: Map<string, Collections[C]> };
  for (const name of collectionNames) {
    // Collections added after a snapshot was saved start empty, and fields added
    // since then get their defaults.
    const records = (initial?.records[name] ?? []).map((r) => ({
      ...recordDefaults[name],
      ...r,
    })) as Collections[typeof name][];
    (data as Record<CollectionName, Map<string, unknown>>)[name] = new Map(
      records.map((r) => [r.id, r]),
    );
  }
  let settings: Settings = { ...defaultSettings, ...initial?.settings };
  const book: SyncBook =
    initial?.version === 2
      ? { ...emptySyncBook(), ...initial.sync }
      : initial
        ? syncBookFromV1(initial.records)
        : emptySyncBook();
  const changed = () => onChange?.();
  return {
    get: (collection, id) => data[collection].get(id),
    put: (collection, record) => {
      (data[collection] as Map<string, typeof record>).set(record.id, record);
      changed();
    },
    remove: (collection, id) => {
      data[collection].delete(id);
      changed();
    },
    all: (collection) => [...data[collection].values()],
    settings: () => ({ ...settings }),
    saveSettings: (next) => {
      settings = { ...next };
      changed();
    },
    syncBook: () => book,
    syncBookChanged: changed,
    snapshot: () => {
      const records = {} as Snapshot["records"];
      for (const name of collectionNames) {
        (records as Record<CollectionName, unknown[]>)[name] = [...data[name].values()];
      }
      return {
        version: 2,
        records,
        settings: { ...settings },
        sync: JSON.parse(JSON.stringify(book)) as SyncBook,
      };
    },
  };
}
