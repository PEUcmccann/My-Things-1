import { toLocalDate, type Clock } from "./clock";
import type { CollectionName, Collections, Store } from "./store";
import type { Moment, Ordered, Project, RecordMeta, ToDo } from "./types";

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
  /** A position after every existing record in the collection. */
  nextPosition(collection: "areas" | "projects" | "headings" | "toDos"): number;
  isInLogbook(item: Finishable): boolean;
  /** Whether a To-do is in the Trash, itself or with its parent To-do or Project. */
  isTrashed(item: ToDo): boolean;
  /** Whether a To-do shows in ordinary lists: not in the Trash and not yet in the Logbook. */
  isOpenInLists(item: ToDo): boolean;
  entry(item: ToDo): ToDoEntry;
  /** Whether a Project shows in ordinary lists and the sidebar. */
  isProjectOpenInLists(project: Project): boolean;
  /**
   * Whether a To-do is held back by its Project: the Project is in Someday or
   * starts in the future, and the To-do has no Start date or Deadline of its own.
   */
  isHeldBackByProject(item: ToDo): boolean;
}

const names: Record<CollectionName, string> = {
  areas: "Area",
  projects: "Project",
  headings: "Heading",
  checklistItems: "Checklist item",
  tags: "Tag",
  toDos: "To-do",
  smartLists: "Smart List",
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
    nextPosition(collection) {
      let max = -1;
      for (const r of store.all(collection)) max = Math.max(max, r.position ?? 0);
      return Math.floor(max) + 1;
    },
    isInLogbook(item) {
      if (item.outcome === "active") return false;
      if (item.loggedAt) return true;
      const mode = store.settings().logbookMode;
      if (mode === "immediately") return true;
      if (mode === "manually" || !item.finishedAt) return false;
      return toLocalDate(new Date(item.finishedAt)) < clock.today();
    },
    isTrashed(item) {
      if (item.deletedAt) return true;
      if (ctx.find("toDos", item.parentId)?.deletedAt) return true;
      return Boolean(ctx.find("projects", item.projectId)?.deletedAt);
    },
    isOpenInLists(item) {
      return !ctx.isTrashed(item) && !ctx.isInLogbook(item);
    },
    isProjectOpenInLists(project) {
      return !project.deletedAt && !ctx.isInLogbook(project);
    },
    isHeldBackByProject(item) {
      if (item.startDate || item.deadline) return false;
      const project = ctx.find("projects", item.projectId);
      if (!project) return false;
      return project.someday || (project.startDate !== null && project.startDate > clock.today());
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

/** In list order, then oldest first. */
export function byPosition(a: RecordMeta & Ordered, b: RecordMeta & Ordered): number {
  return (a.position ?? 0) - (b.position ?? 0) || byCreation(a, b);
}

/** Today has its own order; To-dos never placed there use their ordinary position. */
export function todayKey(t: ToDo): number {
  return t.todayPosition ?? t.position ?? 0;
}
