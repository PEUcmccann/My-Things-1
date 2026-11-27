import { byCreation, byPosition, type Context, type ToDoEntry } from "./context";
import { addDays, startOfMonth, startOfWeek } from "./dates";
import { isValidEstimate } from "./planning";
import {
  dateRanges,
  energies,
  priorities,
  type ContainerRef,
  type DateRange,
  type EstimateChoice,
  type LocalDate,
  type SmartList,
  type SmartListFilters,
  type ToDo,
} from "./types";

export const noFilters: SmartListFilters = {
  tagIds: [],
  containers: [],
  startDate: [],
  deadline: [],
  priority: [],
  energy: [],
  estimate: [],
};

/** Whether a Start date or Deadline falls in a range, as of today. */
export function inDateRange(date: LocalDate | null, range: DateRange, today: LocalDate): boolean {
  if (range === "noDate") return date === null;
  if (date === null) return false;
  switch (range) {
    case "hasDate":
      return true;
    case "todayOrEarlier":
      return date <= today;
    case "today":
      return date === today;
    case "tomorrow":
      return date === addDays(today, 1);
    case "thisWeek": {
      const monday = startOfWeek(today);
      return date >= monday && date <= addDays(monday, 6);
    }
    case "next7Days":
      return date >= today && date <= addDays(today, 6);
    case "thisMonth":
      return startOfMonth(date) === startOfMonth(today);
  }
}

function estimateMatches(estimate: number | null, choice: EstimateChoice): boolean {
  switch (choice.kind) {
    case "notSet":
      return estimate === null;
    case "upTo":
      return estimate !== null && estimate <= choice.minutes;
    case "moreThan":
      return estimate !== null && estimate > choice.minutes;
  }
}

/** Fills in missing kinds and checks every value, so a Smart List is always well formed. */
function checkedFilters(filters: Partial<SmartListFilters>): SmartListFilters {
  const all = { ...noFilters, ...filters };
  const check = <V>(values: V[], ok: (v: V) => boolean, what: string) => {
    for (const v of values) if (!ok(v)) throw new Error(`Unknown ${what} ${JSON.stringify(v)}`);
  };
  check(all.startDate, (r) => dateRanges.includes(r), "date range");
  check(all.deadline, (r) => dateRanges.includes(r), "date range");
  check(all.priority, (p) => priorities.includes(p), "Priority");
  check(all.energy, (e) => e === null || energies.includes(e), "Energy");
  check(all.containers, (c) => c.kind === "area" || c.kind === "project", "Area or Project");
  check(
    all.estimate,
    (e) =>
      e.kind === "notSet" ||
      ((e.kind === "upTo" || e.kind === "moreThan") && isValidEstimate(e.minutes)),
    "Estimate choice",
  );
  return {
    tagIds: [...new Set(all.tagIds)],
    containers: all.containers.map(({ kind, id }) => ({ kind, id })),
    startDate: [...new Set(all.startDate)],
    deadline: [...new Set(all.deadline)],
    priority: [...new Set(all.priority)],
    energy: [...new Set(all.energy)],
    estimate: all.estimate.map((e) => ({ ...e })),
  };
}

/** What Smart Lists use from the rest of the core. */
interface Deps {
  /** Whether a To-do has any of the Tags, counting nested and inherited Tags. */
  entryHasTags(entry: { toDo: ToDo }, tagIds: string[]): boolean;
}

/**
 * One kind of filter: an empty kind matches everything, otherwise a To-do matches
 * when any of its values does (OR).
 */
function anyOf<V>(values: V[], matches: (value: V) => boolean): boolean {
  return values.length === 0 || values.some(matches);
}

export function smartListActions(ctx: Context, deps: Deps) {
  const { store } = ctx;

  /** To-dos a Smart List can show: open in lists, not parked in Someday or held back. */
  function isEligible(toDo: ToDo): boolean {
    return ctx.isOpenInLists(toDo) && !toDo.someday && !ctx.isHeldBackByProject(toDo);
  }

  /** Whether a To-do passes every kind of filter (AND). */
  function matches(toDo: ToDo, filters: SmartListFilters, today: LocalDate): boolean {
    return (
      // Deleted values are skipped, so a kind left with only those matches nothing.
      anyOf(filters.tagIds, (t) => !isTagGone(t) && deps.entryHasTags({ toDo }, [t])) &&
      anyOf(filters.containers, (c) => !isContainerGone(c) && isIn(toDo, c)) &&
      anyOf(filters.startDate, (r) => inDateRange(toDo.startDate, r, today)) &&
      anyOf(filters.deadline, (r) => inDateRange(toDo.deadline, r, today)) &&
      anyOf(filters.priority, (p) => toDo.priority === p) &&
      anyOf(filters.energy, (e) => toDo.energy === e) &&
      anyOf(filters.estimate, (e) => estimateMatches(toDo.estimate, e))
    );
  }

  const isTagGone = (id: string) => !ctx.find("tags", id);

  /** A deleted Area, or a Project deleted for good or in the Trash. */
  function isContainerGone(container: ContainerRef): boolean {
    if (container.kind === "area") return !ctx.find("areas", container.id);
    const project = ctx.find("projects", container.id);
    return !project || Boolean(project.deletedAt);
  }

  /** Whether a To-do is in a Project, or in an Area directly or through its Project. */
  function isIn(toDo: ToDo, container: ContainerRef): boolean {
    if (container.kind === "project") return toDo.projectId === container.id;
    if (toDo.areaId === container.id) return true;
    return ctx.find("projects", toDo.projectId)?.areaId === container.id;
  }

  return {
    createSmartList(title: string, filters: Partial<SmartListFilters> = {}): string {
      const meta = ctx.meta();
      store.put("smartLists", {
        ...meta,
        title: title.trim() || "New Smart List",
        filters: checkedFilters(filters),
      });
      return meta.id;
    },

    renameSmartList(id: string, title: string): void {
      if (title.trim()) ctx.update("smartLists", id, { title: title.trim() });
    },

    /** Replaces a Smart List's filters; kinds left out match everything. */
    setSmartListFilters(id: string, filters: Partial<SmartListFilters>): void {
      ctx.update("smartLists", id, { filters: checkedFilters(filters) });
    },

    /** Deletes a Smart List. Its To-dos are not touched. */
    deleteSmartList(id: string): void {
      ctx.require("smartLists", id);
      store.remove("smartLists", id);
    },

    getSmartList(id: string): SmartList {
      return ctx.require("smartLists", id);
    },

    findSmartList(id: string): SmartList | undefined {
      return ctx.find("smartLists", id);
    },

    /** Every Smart List, oldest first. */
    smartLists(): SmartList[] {
      return store.all("smartLists").sort(byCreation);
    },

    /** The To-dos a Smart List matches, in the shared list order. */
    smartListToDos(id: string): ToDoEntry[] {
      const { filters } = ctx.require("smartLists", id);
      const today = ctx.clock.today();
      return store
        .all("toDos")
        .filter((toDo) => isEligible(toDo) && matches(toDo, filters, today))
        .sort(byPosition)
        .map(ctx.entry);
    },

    /**
     * The Tags, Areas and Projects a Smart List picks that have since been deleted (a
     * Project in the Trash counts), so the editor can show them as gone.
     */
    goneFromSmartList(id: string): Pick<SmartListFilters, "tagIds" | "containers"> {
      const { filters } = ctx.require("smartLists", id);
      return {
        tagIds: filters.tagIds.filter(isTagGone),
        containers: filters.containers.filter(isContainerGone),
      };
    },
  };
}
