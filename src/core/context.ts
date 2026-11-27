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
  /**
   * The Owner new and restored records belong to: the account if signed in, else "me".
   * Signing in and erasing the device change it (owner.ts).
   */
  owner: string;
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
  isInLogbook(finishable: Finishable): boolean;
  /** Whether a To-do is in the Trash, itself or with its parent To-do or Project. */
  isTrashed(toDo: ToDo): boolean;
  /** Whether a To-do shows in ordinary lists: not in the Trash and not yet in the Logbook. */
  isOpenInLists(toDo: ToDo): boolean;
  entry(toDo: ToDo): ToDoEntry;
  /** Whether a Project shows in ordinary lists and the sidebar. */
  isProjectOpenInLists(project: Project): boolean;
  /**
   * Whether a To-do is held back by its Project: the Project is in Someday or
   * starts in the future, and the To-do has no Start date or Deadline of its own.
   */
  isHeldBackByProject(toDo: ToDo): boolean;
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
    owner,
    now,
    meta() {
      const at = now();
      return { id: newId(), owner: ctx.owner, createdAt: at, updatedAt: at };
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
    isInLogbook(finishable) {
      if (finishable.outcome === "active") return false;
      if (finishable.loggedAt) return true;
      const mode = store.settings().logbookMode;
      if (mode === "immediately") return true;
      if (mode === "manually" || !finishable.finishedAt) return false;
      return toLocalDate(new Date(finishable.finishedAt)) < clock.today();
    },
    isTrashed(toDo) {
      if (toDo.deletedAt) return true;
      if (ctx.find("toDos", toDo.parentId)?.deletedAt) return true;
      return Boolean(ctx.find("projects", toDo.projectId)?.deletedAt);
    },
    isOpenInLists(toDo) {
      return !ctx.isTrashed(toDo) && !ctx.isInLogbook(toDo);
    },
    isProjectOpenInLists(project) {
      return !project.deletedAt && !ctx.isInLogbook(project);
    },
    isHeldBackByProject(toDo) {
      if (toDo.startDate || toDo.deadline) return false;
      const project = ctx.find("projects", toDo.projectId);
      if (!project) return false;
      return project.someday || (project.startDate !== null && project.startDate > clock.today());
    },
    entry(toDo) {
      const parent = ctx.find("toDos", toDo.parentId);
      return { toDo, parentTitle: parent?.title ?? null };
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
