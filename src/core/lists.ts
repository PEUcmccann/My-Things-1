import { byPosition, todayKey, type Context, type ToDoEntry } from "./context";
import { addDays, daysBetween, startOfMonth, startOfWeek } from "./dates";
import { occurrencesLeft } from "./repeat";
import { parseRrule, repeatDates } from "./rrule";
import { seriesFieldsFor } from "./seriesEdits";
import type { LocalDate, Project, Tag, ToDo } from "./types";

/** Why an item shows on a day in Upcoming. */
export type UpcomingReason = "start" | "deadline";

/**
 * An entry in Upcoming. A "projected" entry is a later date of a repeating To-do's
 * rule: it isn't a To-do and isn't stored, and stands for the current occurrence.
 * Its `toDo` is the current occurrence as the series is, without "this one"
 * changes (the id is the current occurrence's), and `tags` are the series' Tags.
 */
export type UpcomingEntry = { date: LocalDate; reason: UpcomingReason } & (
  | ({ kind: "toDo" } & ToDoEntry)
  | ({ kind: "projected"; tags: Tag[] } & ToDoEntry)
  | { kind: "project"; project: Project }
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
/** How many days ahead Upcoming projects the dates of Repeat rules. */
export const upcomingRepeatDays = 365;

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

function isDue(toDo: Pick<ToDo, "startDate" | "deadline">, today: LocalDate): boolean {
  const started = toDo.startDate !== null && toDo.startDate <= today;
  const deadlineReached = toDo.deadline !== null && toDo.deadline <= today;
  return started || deadlineReached;
}

/** Not yet organised: no Area, Project, Start date or Someday. */
function isInInbox(toDo: ToDo): boolean {
  return !toDo.areaId && !toDo.projectId && !toDo.startDate && !toDo.someday;
}

/**
 * The later dates of a repeating To-do's rule, as completing each occurrence in turn
 * would produce them: after the later of its Start date and today, up to a year
 * ahead, and no further than the rule's end (COUNT, counted over the series'
 * occurrences, or UNTIL). After-completion rules have none, since their dates
 * depend on when each occurrence is done.
 *
 * Every date shows in the day-by-day part; in a week or month group the rule shows
 * at most once (counting the current occurrence), on its first date there, so a
 * daily rule can't flood the list.
 */
function projectedDates(ctx: Context, toDo: ToDo, today: LocalDate): LocalDate[] {
  const rule = toDo.repeat;
  if (!rule || rule.mode !== "onSchedule") return [];
  const pattern = parseRrule(rule.rrule);
  let left = occurrencesLeft(ctx, toDo, pattern);
  const after = toDo.startDate && toDo.startDate > today ? toDo.startDate : today;
  const last = addDays(today, upcomingRepeatDays);
  const shown = new Set<string>();
  const groupKey = (date: LocalDate) => {
    const { kind, start } = groupFor(date, today);
    return kind === "day" ? null : `${kind} ${start}`;
  };
  const current = after === today ? null : groupKey(after);
  if (current) shown.add(current);
  const dates: LocalDate[] = [];
  for (const date of repeatDates(pattern, rule.start, after)) {
    if (date > last || left === 0) break;
    left--;
    const key = groupKey(date);
    if (key && shown.has(key)) continue;
    if (key) shown.add(key);
    dates.push(date);
  }
  return dates;
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
        (toDo) => ctx.isOpenInLists(toDo) && isDue(toDo, today) && !ctx.isHeldBackByProject(toDo),
      )
      .sort((a, b) => todayKey(a) - todayKey(b) || byPosition(a, b));
    for (const toDo of due) {
      (toDo.evening ? list.thisEvening : list.main).push(ctx.entry(toDo));
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
        .filter((toDo) => ctx.isOpenInLists(toDo) && isInInbox(toDo))
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
        dated: { startDate: LocalDate | null; deadline: LocalDate | null },
        make: (date: LocalDate, reason: UpcomingReason) => UpcomingEntry,
      ) => {
        if (dated.startDate && dated.startDate > today)
          entries.push(make(dated.startDate, "start"));
        if (dated.deadline && dated.deadline > today)
          entries.push(make(dated.deadline, "deadline"));
      };
      for (const toDo of store.all("toDos")) {
        if (toDo.outcome !== "active" || !ctx.isOpenInLists(toDo)) continue;
        add(toDo, (date, reason) => ({ kind: "toDo", date, reason, ...ctx.entry(toDo) }));
        for (const date of projectedDates(ctx, toDo, today)) {
          // A later occurrence is created from the series, without "this one" changes.
          const later = { ...toDo, ...seriesFieldsFor(ctx, toDo, date) };
          const tags = later.tagIds
            .map((t) => ctx.find("tags", t))
            .filter((t): t is Tag => Boolean(t));
          entries.push({ kind: "projected", date, reason: "start", tags, ...ctx.entry(later) });
        }
      }
      for (const project of store.all("projects")) {
        if (project.outcome !== "active" || !ctx.isProjectOpenInLists(project)) continue;
        add(project, (date, reason) => ({ kind: "project", date, reason, project }));
      }
      const record = (e: UpcomingEntry) => (e.kind === "project" ? e.project : e.toDo);
      // On the same day: Projects, then To-dos, then projected entries.
      const rank = { project: 0, toDo: 1, projected: 2 };
      entries.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          rank[a.kind] - rank[b.kind] ||
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
          (toDo) =>
            ctx.isOpenInLists(toDo) &&
            !toDo.someday &&
            !(toDo.startDate && toDo.startDate > today) &&
            !isInInbox(toDo) &&
            !ctx.isHeldBackByProject(toDo),
        )
        .sort(byPosition)
        .map(ctx.entry);
    },

    /** Someday: To-dos parked with no commitment to do them. */
    someday(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((toDo) => ctx.isOpenInLists(toDo) && toDo.someday)
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
