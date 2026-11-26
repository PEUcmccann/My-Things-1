import type { Area, Project, Settings, ToDo } from "./types";

export interface Collections {
  areas: Area;
  projects: Project;
  toDos: ToDo;
}

/** Where the core keeps its records. The app uses a device database; tests use memory. */
export interface Store {
  get<C extends keyof Collections>(collection: C, id: string): Collections[C] | undefined;
  put<C extends keyof Collections>(collection: C, record: Collections[C]): void;
  all<C extends keyof Collections>(collection: C): Collections[C][];
  settings(): Settings;
  saveSettings(settings: Settings): void;
}

export const defaultSettings: Settings = { logbookMode: "endOfDay" };

export function memoryStore(): Store {
  const data: { [C in keyof Collections]: Map<string, Collections[C]> } = {
    areas: new Map(),
    projects: new Map(),
    toDos: new Map(),
  };
  let settings: Settings = { ...defaultSettings };
  return {
    get: (collection, id) => data[collection].get(id),
    put: (collection, record) => {
      (data[collection] as Map<string, typeof record>).set(record.id, record);
    },
    all: (collection) => [...data[collection].values()],
    settings: () => ({ ...settings }),
    saveSettings: (next) => {
      settings = { ...next };
    },
  };
}
