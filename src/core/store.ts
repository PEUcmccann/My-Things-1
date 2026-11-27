import type { Area, ChecklistItem, Heading, Project, Settings, Tag, ToDo } from "./types";

export interface Collections {
  areas: Area;
  projects: Project;
  headings: Heading;
  toDos: ToDo;
  checklistItems: ChecklistItem;
  tags: Tag;
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
}

/** Everything in a store, as plain data that can be saved and loaded again. */
export interface Snapshot {
  version: 1;
  records: { [C in CollectionName]: Collections[C][] };
  settings: Settings;
}

export const defaultSettings: Settings = { logbookMode: "endOfDay", accentColour: "teal" };

const collectionNames: CollectionName[] = [
  "areas",
  "projects",
  "headings",
  "toDos",
  "checklistItems",
  "tags",
];

/** Defaults for fields that records saved by earlier versions may lack. */
const recordDefaults: { [C in CollectionName]: Partial<Collections[C]> } = {
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
    priority: "none",
    energy: null,
    estimate: null,
  },
  checklistItems: {},
  tags: {},
};

export interface MemoryStore extends Store {
  snapshot(): Snapshot;
}

/**
 * A store held in memory. It can start from a saved snapshot, and calls `onChange`
 * after every write so the app can save it to the device.
 */
export function memoryStore(initial?: Snapshot, onChange?: () => void): MemoryStore {
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
    snapshot: () => {
      const records = {} as Snapshot["records"];
      for (const name of collectionNames) {
        (records as Record<CollectionName, unknown[]>)[name] = [...data[name].values()];
      }
      return { version: 1, records, settings: { ...settings } };
    },
  };
}
