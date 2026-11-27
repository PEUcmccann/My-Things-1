import { byCreation, type Context, type ToDoEntry } from "./context";
import { addDays, daysBetween, startOfMonth, startOfWeek } from "./dates";
import type { LocalDate, ToDo } from "./types";

/** Why an item shows on a day in Upcoming. */
export type UpcomingReason = "start" | "deadline";

export type UpcomingEntry = { kind: "toDo"; date: LocalDate; reason: UpcomingReason } & ToDoEntry;

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

function isDue(item: ToDo, today: LocalDate): boolean {
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

  return {
    /**
     * Inbox: To-dos that have not been organised yet. Filing a To-do in an Area or
     * Project, giving it a Start date, or moving it to Someday all organise it.
     */
    inbox(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((item) => ctx.isOpenInLists(item) && isInInbox(item))
        .sort(byCreation)
        .map(ctx.entry);
    },

    /**
     * Upcoming: active To-dos on their future Start date, and on the day of a
     * future Deadline, in date order.
     */
    upcoming(): UpcomingGroup[] {
      const today = clock.today();
      const entries: UpcomingEntry[] = [];
      for (const item of store.all("toDos")) {
        if (item.outcome !== "active" || !ctx.isOpenInLists(item)) continue;
        if (item.startDate && item.startDate > today) {
          entries.push({ kind: "toDo", date: item.startDate, reason: "start", ...ctx.entry(item) });
        }
        if (item.deadline && item.deadline > today) {
          entries.push({
            kind: "toDo",
            date: item.deadline,
            reason: "deadline",
            ...ctx.entry(item),
          });
        }
      }
      entries.sort((a, b) => a.date.localeCompare(b.date) || byCreation(a.toDo, b.toDo));
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
            !isInInbox(item),
        )
        .sort(byCreation)
        .map(ctx.entry);
    },

    /** Someday: To-dos parked with no commitment to do them. */
    someday(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((item) => ctx.isOpenInLists(item) && item.someday)
        .sort(byCreation)
        .map(ctx.entry);
    },

    /**
     * Today: every active To-do whose Start date or Deadline is today or earlier.
     * To-dos finished today stay visible until they move to the Logbook.
     */
    today(): TodayList {
      const today = clock.today();
      const list: TodayList = { main: [], thisEvening: [] };
      for (const item of store.all("toDos")) {
        if (!ctx.isOpenInLists(item)) continue;
        if (!isDue(item, today)) continue;
        (item.evening ? list.thisEvening : list.main).push(ctx.entry(item));
      }
      return list;
    },
  };
}
