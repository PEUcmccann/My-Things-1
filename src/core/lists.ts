import { byPosition, todayKey, type Context, type ToDoEntry } from "./context";
import { addDays, daysBetween, startOfMonth, startOfWeek } from "./dates";
import type { LocalDate, Project, ToDo } from "./types";

/** Why an item shows on a day in Upcoming. */
export type UpcomingReason = "start" | "deadline";

export type UpcomingEntry = { date: LocalDate; reason: UpcomingReason } & (
  ({ kind: "toDo" } & ToDoEntry) | { kind: "project"; project: Project }
);

/** The Projects shown at the top of Today, Anytime or Someday. */
export type ProjectList = "today" | "anytime" | "someday";

/**
 * A stretch of Upcoming: a single day for the next seven days, then a week
 * (from Monday) up to four weeks out, then a calendar month.
 */
export interface UpcomingGroup {
  kind: "day" | "week" | "month";
  /** The first day the group covers. */
  start: LocalDate;
  entries: UpcomingEntry[];
}

/** Days shown one by one at the top of Upcoming. */
export const upcomingDays = 7;
/** Days after which Upcoming groups by month instead of by week. */
export const upcomingWeeksUntil = 28;

function groupFor(date: LocalDate, today: LocalDate): Pick<UpcomingGroup, "kind" | "start"> {
  const ahead = daysBetween(today, date);
  if (ahead <= upcomingDays) return { kind: "day", start: date };
  if (ahead <= upcomingWeeksUntil) {
    const monday = startOfWeek(date);
    const firstAfterDays = addDays(today, upcomingDays + 1);
    return { kind: "week", start: monday < firstAfterDays ? firstAfterDays : monday };
  }
  const month = startOfMonth(date);
  const firstAfterWeeks = addDays(today, upcomingWeeksUntil + 1);
  return { kind: "month", start: month < firstAfterWeeks ? firstAfterWeeks : month };
}

export interface TodayList {
  main: ToDoEntry[];
  thisEvening: ToDoEntry[];
}

function isDue(item: Pick<ToDo, "startDate" | "deadline">, today: LocalDate): boolean {
  const started = item.startDate !== null && item.startDate <= today;
  const deadlineReached = item.deadline !== null && item.deadline <= today;
  return started || deadlineReached;
}

/** Not yet organised: no Area, Project, Start date or Someday. */
function isInInbox(item: ToDo): boolean {
  return !item.areaId && !item.projectId && !item.startDate && !item.someday;
}

export function listQueries(ctx: Context) {
  const { store, clock } = ctx;

  /**
   * Today: every active To-do whose Start date or Deadline is today or earlier.
   * To-dos finished today stay visible until they move to the Logbook.
   */
  function todayList(): TodayList {
    const today = clock.today();
    const list: TodayList = { main: [], thisEvening: [] };
    const due = store
      .all("toDos")
      .filter(
        (item) => ctx.isOpenInLists(item) && isDue(item, today) && !ctx.isHeldBackByProject(item),
      )
      .sort((a, b) => todayKey(a) - todayKey(b) || byPosition(a, b));
    for (const item of due) {
      (item.evening ? list.thisEvening : list.main).push(ctx.entry(item));
    }
    return list;
  }

  return {
    /**
     * Inbox: To-dos that have not been organised yet. Filing a To-do in an Area or
     * Project, giving it a Start date, or moving it to Someday all organise it.
     */
    inbox(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((item) => ctx.isOpenInLists(item) && isInInbox(item))
        .sort(byPosition)
        .map(ctx.entry);
    },

    /**
     * Upcoming: active To-dos on their future Start date, and on the day of a
     * future Deadline, in date order.
     */
    upcoming(): UpcomingGroup[] {
      const today = clock.today();
      const entries: UpcomingEntry[] = [];
      const add = (
        item: { startDate: LocalDate | null; deadline: LocalDate | null },
        make: (date: LocalDate, reason: UpcomingReason) => UpcomingEntry,
      ) => {
        if (item.startDate && item.startDate > today) entries.push(make(item.startDate, "start"));
        if (item.deadline && item.deadline > today) entries.push(make(item.deadline, "deadline"));
      };
      for (const item of store.all("toDos")) {
        if (item.outcome !== "active" || !ctx.isOpenInLists(item)) continue;
        add(item, (date, reason) => ({ kind: "toDo", date, reason, ...ctx.entry(item) }));
      }
      for (const project of store.all("projects")) {
        if (project.outcome !== "active" || !ctx.isProjectOpenInLists(project)) continue;
        add(project, (date, reason) => ({ kind: "project", date, reason, project }));
      }
      const record = (e: UpcomingEntry) => (e.kind === "toDo" ? e.toDo : e.project);
      // Projects come before To-dos on the same day.
      entries.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          Number(a.kind === "toDo") - Number(b.kind === "toDo") ||
          byPosition(record(a), record(b)),
      );
      const groups: UpcomingGroup[] = [];
      for (const e of entries) {
        const { kind, start } = groupFor(e.date, today);
        let group = groups[groups.length - 1];
        if (!group || group.start !== start || group.kind !== kind) {
          group = { kind, start, entries: [] };
          groups.push(group);
        }
        group.entries.push(e);
      }
      return groups;
    },

    /**
     * Anytime: every To-do that could be done now. It has been organised (it is
     * not in the Inbox), has no future Start date and is not in Someday. This
     * includes the To-dos also shown in Today.
     */
    anytime(): ToDoEntry[] {
      const today = clock.today();
      return store
        .all("toDos")
        .filter(
          (item) =>
            ctx.isOpenInLists(item) &&
            !item.someday &&
            !(item.startDate && item.startDate > today) &&
            !isInInbox(item) &&
            !ctx.isHeldBackByProject(item),
        )
        .sort(byPosition)
        .map(ctx.entry);
    },

    /** Someday: To-dos parked with no commitment to do them. */
    someday(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((item) => ctx.isOpenInLists(item) && item.someday)
        .sort(byPosition)
        .map(ctx.entry);
    },

    /**
     * The Projects shown in Today, Anytime or Someday, by the same rules as
     * To-dos: Today has Projects whose Start date or Deadline has come, Anytime
     * those with no future Start date that are not in Someday, and Someday those
     * parked there.
     */
    projectsIn(list: ProjectList): Project[] {
      const today = clock.today();
      const matches = (p: Project) => {
        switch (list) {
          case "today":
            return isDue(p, today);
          case "anytime":
            return !p.someday && !(p.startDate && p.startDate > today);
          case "someday":
            return p.someday;
        }
      };
      return store
        .all("projects")
        .filter((p) => ctx.isProjectOpenInLists(p) && matches(p))
        .sort(byPosition);
    },

    today: todayList,

    /**
     * The total Estimate, in minutes, of Today's active To-dos (This Evening
     * included). To-dos with no Estimate count as nothing.
     */
    todayEstimate(): number {
      const { main, thisEvening } = todayList();
      return [...main, ...thisEvening]
        .filter((e) => e.toDo.outcome === "active")
        .reduce((total, e) => total + (e.toDo.estimate ?? 0), 0);
    },
  };
}
