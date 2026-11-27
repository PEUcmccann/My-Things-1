import { toLocalDate, type Clock } from "./clock";
import type { Store } from "./store";
import type { LocalDate, LogbookMode, Project, ToDo } from "./types";

export interface Options {
  clock: Clock;
  store: Store;
  newId?: () => string;
  /** The user who owns new records. There is one user for now; sharing comes later. */
  owner?: string;
}

export interface NewToDo {
  title: string;
  areaId?: string;
  projectId?: string;
  parentId?: string;
}

export interface NewProject {
  title: string;
  areaId?: string;
}

/** A To-do as shown in a list. */
export interface ToDoEntry {
  toDo: ToDo;
  /** Title of the parent To-do, when this is a Sub-to-do. */
  parentTitle: string | null;
}

export interface TodayList {
  main: ToDoEntry[];
  thisEvening: ToDoEntry[];
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const localOwner = "me";

export function createMyThings({ clock, store, newId = randomId, owner = localOwner }: Options) {
  function stamp(): { owner: string; createdAt: string; updatedAt: string } {
    const now = clock.now().toISOString();
    return { owner, createdAt: now, updatedAt: now };
  }

  function toDo(id: string): ToDo {
    const found = store.get("toDos", id);
    if (!found) throw new Error(`No To-do with id ${id}`);
    return found;
  }

  function project(id: string): Project {
    const found = store.get("projects", id);
    if (!found) throw new Error(`No Project with id ${id}`);
    return found;
  }

  function updateToDo(id: string, changes: Partial<ToDo>): void {
    store.put("toDos", { ...toDo(id), ...changes, updatedAt: clock.now().toISOString() });
  }

  function updateProject(id: string, changes: Partial<Project>): void {
    store.put("projects", { ...project(id), ...changes, updatedAt: clock.now().toISOString() });
  }

  function entry(item: ToDo): ToDoEntry {
    const parent = item.parentId ? store.get("toDos", item.parentId) : undefined;
    return { toDo: item, parentTitle: parent?.title ?? null };
  }

  /** Whether a To-do shows in ordinary lists: not in the Trash and not yet in the Logbook. */
  function isOpenInLists(item: ToDo): boolean {
    return !item.deletedAt && !isInLogbook(item);
  }

  function byCreation(a: ToDo, b: ToDo): number {
    return a.createdAt.localeCompare(b.createdAt);
  }

  function finish(id: string, outcome: "completed" | "cancelled"): void {
    const now = clock.now().toISOString();
    const logNow = store.settings().logbookMode === "immediately";
    updateToDo(id, { outcome, finishedAt: now, loggedAt: logNow ? now : null });
  }

  /** Whether a finished To-do has reached the Logbook, given the Logbook mode. */
  function isInLogbook(item: ToDo): boolean {
    if (item.outcome === "active") return false;
    if (item.loggedAt) return true;
    if (store.settings().logbookMode !== "endOfDay" || !item.finishedAt) return false;
    return toLocalDate(new Date(item.finishedAt)) < clock.today();
  }

  function isDue(item: ToDo, today: LocalDate): boolean {
    const started = item.startDate !== null && item.startDate <= today;
    const deadlineReached = item.deadline !== null && item.deadline <= today;
    return started || deadlineReached;
  }

  return {
    createToDo(input: NewToDo): string {
      const parent = input.parentId ? toDo(input.parentId) : null;
      const id = newId();
      store.put("toDos", {
        id,
        ...stamp(),
        title: input.title,
        outcome: "active",
        finishedAt: null,
        loggedAt: null,
        startDate: null,
        evening: false,
        someday: false,
        deadline: null,
        // A Sub-to-do always sits where its parent sits.
        areaId: parent ? parent.areaId : (input.areaId ?? null),
        projectId: parent ? parent.projectId : (input.projectId ?? null),
        headingId: parent ? parent.headingId : null,
        parentId: parent ? parent.id : null,
        deletedAt: null,
      });
      return id;
    },

    createProject(input: NewProject): string {
      const id = newId();
      store.put("projects", {
        id,
        ...stamp(),
        title: input.title,
        areaId: input.areaId ?? null,
        outcome: "active",
        startDate: null,
        someday: false,
        deadline: null,
        deletedAt: null,
      });
      return id;
    },

    /** Sets the Start date ("When"). `evening` puts it in This Evening. */
    setStartDate(id: string, date: LocalDate | null, opts: { evening?: boolean } = {}): void {
      updateToDo(id, {
        startDate: date,
        evening: date !== null && (opts.evening ?? false),
        someday: false,
      });
    },

    /** Choosing "Today" just sets the Start date to today. */
    moveToToday(id: string, opts: { evening?: boolean } = {}): void {
      this.setStartDate(id, clock.today(), opts);
    },

    moveToSomeday(id: string): void {
      updateToDo(id, { startDate: null, evening: false, someday: true });
    },

    moveProjectToSomeday(id: string): void {
      updateProject(id, { startDate: null, someday: true });
    },

    setDeadline(id: string, date: LocalDate | null): void {
      updateToDo(id, { deadline: date });
    },

    complete(id: string): void {
      finish(id, "completed");
    },

    cancel(id: string): void {
      finish(id, "cancelled");
    },

    /** Moves a To-do to the Trash. */
    delete(id: string): void {
      updateToDo(id, { deletedAt: clock.now().toISOString() });
    },

    setLogbookMode(mode: LogbookMode): void {
      store.saveSettings({ ...store.settings(), logbookMode: mode });
    },

    getToDo(id: string): ToDo {
      return toDo(id);
    },

    /** Inbox: To-dos that have not been organised into an Area or Project. */
    inbox(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((item) => isOpenInLists(item) && !item.areaId && !item.projectId)
        .sort(byCreation)
        .map(entry);
    },

    /**
     * Today: every active To-do whose Start date or Deadline is today or earlier.
     * To-dos finished today stay visible until they move to the Logbook.
     */
    today(): TodayList {
      const today = clock.today();
      const list: TodayList = { main: [], thisEvening: [] };
      for (const item of store.all("toDos")) {
        if (!isOpenInLists(item)) continue;
        if (!isDue(item, today)) continue;
        (item.evening ? list.thisEvening : list.main).push(entry(item));
      }
      return list;
    },
  };
}

export type MyThings = ReturnType<typeof createMyThings>;
