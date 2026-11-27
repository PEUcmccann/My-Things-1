import { toLocalDate, type Clock } from "./clock";
import { addDays, deadlineFlag, type DeadlineFlag } from "./dates";
import type { Store } from "./store";
import type { LocalDate, LogbookMode, Project, ToDo } from "./types";

/** The lifecycle fields shared by To-dos and Projects. */
type Finishable = Pick<ToDo, "outcome" | "finishedAt" | "loggedAt">;

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
  /** "When" for the new To-do, as when it is created from Today or Someday. */
  when?: When;
}

/** A choice of "When" for a To-do: what the Start date picker offers. */
export type When =
  | { kind: "today" }
  | { kind: "thisEvening" }
  | { kind: "date"; date: LocalDate }
  | { kind: "someday" }
  | { kind: "none" };

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

export type LogbookEntry = { kind: "toDo" } & ToDoEntry;

export interface LogbookDay {
  date: LocalDate;
  entries: LogbookEntry[];
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

  /**
   * Whether a finished item has reached the Logbook. "immediately" logs it as it is
   * finished, "endOfDay" once the day it was finished is over, and "manually" only
   * when the user moves finished items there.
   */
  function isInLogbook(item: Finishable): boolean {
    if (item.outcome === "active") return false;
    if (item.loggedAt) return true;
    const mode = store.settings().logbookMode;
    if (mode === "immediately") return true;
    if (mode === "manually" || !item.finishedAt) return false;
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
      if (input.when) this.setWhen(id, input.when);
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

    editToDo(id: string, changes: { title?: string }): void {
      const next: Partial<ToDo> = {};
      if (changes.title !== undefined) next.title = changes.title.trim() || toDo(id).title;
      updateToDo(id, next);
    },

    /** Sets "When": Today, This Evening, a date, Someday, or nothing. */
    setWhen(id: string, when: When): void {
      switch (when.kind) {
        case "today":
          return this.moveToToday(id);
        case "thisEvening":
          return this.moveToToday(id, { evening: true });
        case "date":
          return this.setStartDate(id, when.date);
        case "someday":
          return this.moveToSomeday(id);
        case "none":
          return this.setStartDate(id, null);
      }
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
      // Whatever has reached the Logbook under the old mode stays there.
      const now = clock.now().toISOString();
      for (const item of store.all("toDos")) {
        if (!item.loggedAt && isInLogbook(item)) updateToDo(item.id, { loggedAt: now });
      }
      store.saveSettings({ ...store.settings(), logbookMode: mode });
    },

    logbookMode(): LogbookMode {
      return store.settings().logbookMode;
    },

    /** Moves every finished To-do to the Logbook now, as in the "manually" mode. */
    moveFinishedToLogbook(): void {
      const now = clock.now().toISOString();
      for (const item of store.all("toDos")) {
        if (item.outcome !== "active" && !item.loggedAt) updateToDo(item.id, { loggedAt: now });
      }
    },

    /** Makes a Completed or Cancelled To-do active again, in its original place. */
    reopen(id: string): void {
      updateToDo(id, { outcome: "active", finishedAt: null, loggedAt: null });
    },

    /** Whether there are finished To-dos still waiting to move to the Logbook. */
    hasFinishedOutsideLogbook(): boolean {
      return store
        .all("toDos")
        .some((item) => !item.deletedAt && item.outcome !== "active" && !isInLogbook(item));
    },

    /** The Logbook: finished To-dos grouped by the day they were finished, newest first. */
    logbook(): LogbookDay[] {
      const finished = store
        .all("toDos")
        .filter((item) => !item.deletedAt && isInLogbook(item))
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
      const days: LogbookDay[] = [];
      for (const item of finished) {
        const date = toLocalDate(new Date(item.finishedAt ?? item.updatedAt));
        let day = days[days.length - 1];
        if (!day || day.date !== date) {
          day = { date, entries: [] };
          days.push(day);
        }
        day.entries.push({ kind: "toDo", ...entry(item) });
      }
      return days;
    },

    getToDo(id: string): ToDo {
      return toDo(id);
    },

    /** The To-do with this id, or undefined once it has been removed for good. */
    findToDo(id: string): ToDo | undefined {
      return store.get("toDos", id);
    },

    /** Whether to flag a Deadline as close or passed, as of today. */
    deadlineFlag(deadline: LocalDate | null): DeadlineFlag {
      return deadlineFlag(deadline, clock.today());
    },

    /** Tomorrow's date, for the "When" picker. */
    tomorrow(): LocalDate {
      return addDays(clock.today(), 1);
    },

    /** Today's date, from the core's clock. */
    currentDate(): LocalDate {
      return clock.today();
    },

    /**
     * Inbox: To-dos that have not been organised yet. Filing a To-do in an Area or
     * Project, giving it a Start date, or moving it to Someday all organise it.
     */
    inbox(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter(
          (item) =>
            isOpenInLists(item) &&
            !item.areaId &&
            !item.projectId &&
            !item.startDate &&
            !item.someday,
        )
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
