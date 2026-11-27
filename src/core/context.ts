import { toLocalDate, type Clock } from "./clock";
import type { CollectionName, Collections, Store } from "./store";
import type { Moment, RecordMeta, ToDo } from "./types";

/** The lifecycle fields shared by To-dos and Projects. */
export type Finishable = Pick<ToDo, "outcome" | "finishedAt" | "loggedAt">;

/** A To-do as shown in a list. */
export interface ToDoEntry {
  toDo: ToDo;
  /** Title of the parent To-do, when this is a Sub-to-do. */
  parentTitle: string | null;
}

/** What every part of the core shares: its inputs, record helpers and common rules. */
export interface Context {
  store: Store;
  clock: Clock;
  now(): Moment;
  /** A new record's id, owner and timestamps. */
  meta(): RecordMeta;
  find<C extends CollectionName>(collection: C, id: string | null): Collections[C] | undefined;
  require<C extends CollectionName>(collection: C, id: string): Collections[C];
  update<C extends CollectionName>(
    collection: C,
    id: string,
    changes: Partial<Collections[C]>,
  ): void;
  isInLogbook(item: Finishable): boolean;
  /** Whether a To-do shows in ordinary lists: not in the Trash and not yet in the Logbook. */
  isOpenInLists(item: ToDo): boolean;
  entry(item: ToDo): ToDoEntry;
}

const names: Record<CollectionName, string> = {
  areas: "Area",
  projects: "Project",
  toDos: "To-do",
};

export function createContext(opts: {
  clock: Clock;
  store: Store;
  newId: () => string;
  owner: string;
}): Context {
  const { clock, store, newId, owner } = opts;
  const now = () => clock.now().toISOString();

  const ctx: Context = {
    store,
    clock,
    now,
    meta() {
      const at = now();
      return { id: newId(), owner, createdAt: at, updatedAt: at };
    },
    find(collection, id) {
      return id === null ? undefined : store.get(collection, id);
    },
    require(collection, id) {
      const found = store.get(collection, id);
      if (!found) throw new Error(`No ${names[collection]} with id ${id}`);
      return found;
    },
    update(collection, id, changes) {
      store.put(collection, { ...ctx.require(collection, id), ...changes, updatedAt: now() });
    },
    /**
     * Whether a finished item has reached the Logbook. "immediately" logs it as it is
     * finished, "endOfDay" once the day it was finished is over, and "manually" only
     * when the user moves finished items there.
     */
    isInLogbook(item) {
      if (item.outcome === "active") return false;
      if (item.loggedAt) return true;
      const mode = store.settings().logbookMode;
      if (mode === "immediately") return true;
      if (mode === "manually" || !item.finishedAt) return false;
      return toLocalDate(new Date(item.finishedAt)) < clock.today();
    },
    isOpenInLists(item) {
      return !item.deletedAt && !ctx.isInLogbook(item);
    },
    entry(item) {
      const parent = ctx.find("toDos", item.parentId);
      return { toDo: item, parentTitle: parent?.title ?? null };
    },
  };
  return ctx;
}

/** Oldest first. */
export function byCreation(a: RecordMeta, b: RecordMeta): number {
  return a.createdAt.localeCompare(b.createdAt);
}
