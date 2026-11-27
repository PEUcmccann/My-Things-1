import type { Context } from "./context";
import { addDays, daysBetween } from "./dates";
import {
  afterGap,
  checkPattern,
  formatRrule,
  isGap,
  nextRepeatDate,
  parseRrule,
  repeatDates,
  type RepeatPattern,
} from "./rrule";
import { seriesChecklist, seriesFieldsFor, seriesSubToDos } from "./seriesEdits";
import { eraseToDoFrom } from "./trash";
import type { LocalDate, RepeatMode, RepeatRule, ToDo } from "./types";

/**
 * Repeat rules. Only the current occurrence of a repeating To-do carries the rule.
 * Finishing it (Completed or Cancelled) creates the next occurrence, which takes
 * the rule over; every occurrence shares a series id.
 */

function later(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

function shifted(date: LocalDate | null, days: number): LocalDate | null {
  return date && addDays(date, days);
}

/**
 * Which occurrence of its series a To-do is, counting from 1: how many occurrences
 * the series has created, this one included (see `RepeatRule.occurrence`). A To-do
 * without a rule would start a series, so it is 1.
 */
function occurrenceNumber(ctx: Context, toDo: ToDo): number {
  const rule = toDo.repeat;
  if (!rule) return 1;
  if (rule.occurrence !== undefined) return rule.occurrence;
  // A rule saved before the count was kept: count the series' records instead.
  return ctx.store.all("toDos").filter((t) => t.seriesId === toDo.seriesId).length;
}

/** How many more occurrences a rule allows after the current one; Infinity with no COUNT. */
export function occurrencesLeft(ctx: Context, toDo: ToDo, pattern: RepeatPattern): number {
  if (pattern.count === undefined) return Infinity;
  return Math.max(0, pattern.count - occurrenceNumber(ctx, toDo));
}

/** The next occurrence's Start date, or null when the series ends. */
function nextOccurrenceDate(ctx: Context, rule: RepeatRule, current: ToDo): LocalDate | null {
  const today = ctx.clock.today();
  const pattern = parseRrule(rule.rrule);
  if (occurrencesLeft(ctx, current, pattern) === 0) return null;
  switch (rule.mode) {
    case "onSchedule": {
      // Completing late skips missed dates; completing early never lands on the same date.
      const after = later(current.startDate ?? today, today);
      return nextRepeatDate(pattern, rule.start, after);
    }
    case "afterCompletion":
      // The gap counts from the day this one was finished, early, on time or late.
      return afterGap(pattern, today);
  }
}

/** A copy of a To-do as a fresh, active record with `changes` applied. */
function copyToDo(ctx: Context, from: ToDo, changes: Partial<ToDo>): string {
  const meta = ctx.meta();
  ctx.store.put("toDos", {
    ...from,
    ...meta,
    outcome: "active",
    finishedAt: null,
    loggedAt: null,
    todayPosition: null,
    deletedAt: null,
    tagIds: [...from.tagIds],
    timeSlot: from.timeSlot && { ...from.timeSlot },
    seriesValues: null,
    ...changes,
  });
  return meta.id;
}

/**
 * One step of copying a finished occurrence to the next one, which is `days` later.
 * Reminders (Milestone 4) add a step here that shifts them by `days`; attachments
 * (Milestone 3) are left out.
 */
type CopyStep = (ctx: Context, from: ToDo, toId: string, days: number) => void;

const copyChecklist: CopyStep = (ctx, from, toId) => {
  for (const { title, position } of seriesChecklist(ctx, from)) {
    ctx.store.put("checklistItems", {
      ...ctx.meta(),
      toDoId: toId,
      title,
      position,
      ticked: false,
    });
  }
};

/** What a Sub-to-do's copy takes along. */
const subToDoSteps: CopyStep[] = [copyChecklist];

/** Every Sub-to-do not in the Trash, reopened (even Cancelled ones), with its dates shifted. */
const copySubToDos: CopyStep = (ctx, from, toId, days) => {
  const parent = ctx.require("toDos", toId);
  for (const child of seriesSubToDos(ctx, from)) {
    const copyId = copyToDo(ctx, child, {
      parentId: toId,
      areaId: parent.areaId,
      projectId: parent.projectId,
      headingId: parent.headingId,
      startDate: shifted(child.startDate, days),
      deadline: shifted(child.deadline, days),
      timeSlot: child.startDate ? child.timeSlot && { ...child.timeSlot } : null,
    });
    for (const step of subToDoSteps) step(ctx, child, copyId, days);
  }
};

/** What the next occurrence takes along, beyond the To-do's own fields. */
const occurrenceSteps: CopyStep[] = [copyChecklist, copySubToDos];

/**
 * Creates the next occurrence of a repeating To-do that has just been finished. It
 * copies the Checklist (unticked), Sub-to-dos (reopened), Tags, planning
 * attributes, Time slot and notes, in the same place, and takes the rule over.
 */
export function createNextOccurrence(ctx: Context, id: string): string | null {
  const current = ctx.require("toDos", id);
  const rule = current.repeat;
  if (!rule) return null;
  const today = ctx.clock.today();
  const date = nextOccurrenceDate(ctx, rule, current);
  ctx.update("toDos", id, { repeat: null });
  if (!date) return null;
  const days = daysBetween(current.startDate ?? today, date);
  const nextId = copyToDo(ctx, current, {
    startDate: date,
    deadline: shifted(current.deadline, days),
    someday: false,
    repeat: { ...rule, occurrence: occurrenceNumber(ctx, current) + 1 },
    ...seriesFieldsFor(ctx, current, date),
  });
  for (const step of occurrenceSteps) step(ctx, current, nextId, days);
  return nextId;
}

/** The open occurrence of a series: active, carrying the rule, not in the Trash. */
function openOccurrence(ctx: Context, seriesId: string): ToDo | undefined {
  return ctx.store
    .all("toDos")
    .find(
      (t) => t.seriesId === seriesId && t.repeat && t.outcome === "active" && !ctx.isTrashed(t),
    );
}

/** The most recently finished occurrence of a series. */
function latestFinished(ctx: Context, seriesId: string): ToDo | undefined {
  const finished = ctx.store
    .all("toDos")
    .filter((t) => t.seriesId === seriesId && t.outcome !== "active" && !t.deletedAt);
  finished.sort(
    (a, b) =>
      (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "") ||
      b.createdAt.localeCompare(a.createdAt),
  );
  return finished[0];
}

/**
 * The rule-side of reopening a finished occurrence, before it becomes active. The
 * latest one acts as an undo: the open next occurrence is removed for good and the
 * reopened To-do carries the rule again. Any other becomes a normal To-do.
 */
export function reopenOccurrence(ctx: Context, id: string): void {
  const toDo = ctx.require("toDos", id);
  if (!toDo.seriesId || toDo.repeat || toDo.outcome === "active") return;
  const open = openOccurrence(ctx, toDo.seriesId);
  if (open && latestFinished(ctx, toDo.seriesId)?.id === id) {
    // The erased occurrence no longer counts as created.
    const occurrence = Math.max(1, occurrenceNumber(ctx, open) - 1);
    ctx.update("toDos", id, { repeat: open.repeat && { ...open.repeat, occurrence } });
    eraseToDoFrom(ctx.store, open.id);
  } else {
    ctx.update("toDos", id, { seriesId: null });
  }
}

/** Whether "When" can clear a To-do's Start date: not while it has a Repeat rule. */
export function checkCanBeUndated(toDo: ToDo): void {
  if (toDo.repeat) throw new Error("A repeating To-do always has a Start date");
}

/**
 * The Start date a To-do gets when `pattern` is set on it in `mode`: the rule's start.
 * A `chosen` start (from the repeat picker) replaces the To-do's own Start date: on
 * schedule the rule starts on its first date on or after it, after completion on it.
 */
function firstDate(
  toDo: ToDo,
  pattern: RepeatPattern,
  mode: RepeatMode,
  today: LocalDate,
  chosen?: LocalDate,
): LocalDate {
  if (mode === "afterCompletion" && !isGap(pattern)) {
    throw new Error("A Repeat rule after completion is a gap: it can't choose days");
  }
  if (chosen !== undefined && chosen < today) {
    throw new Error("A Repeat rule can't start before today");
  }
  let start: LocalDate | null;
  if (chosen !== undefined && mode === "afterCompletion") {
    start = chosen;
  } else if (chosen !== undefined) {
    start = nextRepeatDate({ ...pattern, interval: 1 }, chosen, addDays(chosen, -1));
  } else if (toDo.repeat && toDo.repeat.mode !== mode && toDo.startDate) {
    // Switching modes: nothing about the current occurrence moves.
    start = toDo.startDate;
  } else if (mode === "afterCompletion") {
    start = toDo.startDate ?? today;
  } else {
    const from = later(toDo.startDate ?? today, today);
    // The first date matches the rule's days; the interval counts from there.
    start = nextRepeatDate({ ...pattern, interval: 1 }, from, addDays(from, -1));
  }
  if (!start || (pattern.until && start > pattern.until)) {
    throw new Error("This Repeat rule has no dates");
  }
  return start;
}

/** How many dates the repeat picker's preview shows. */
export const previewLength = 5;

/** Choices for setting a rule or previewing it. */
export interface RepeatOptions {
  /** The rule's start, as chosen in the repeat picker (see `setRepeat`). */
  start?: LocalDate;
}

export function repeatActions(ctx: Context) {
  const { clock } = ctx;

  /**
   * Sets, changes or removes (null) a To-do's Repeat rule.
   *
   * On schedule, its Start date moves to the rule's first date on or after its
   * Start date (or today, if it has none or it has passed), which becomes the
   * rule's start. After completion, the rule is a gap (FREQ and INTERVAL only) and
   * the To-do keeps its Start date (today if it has none). Switching an existing
   * rule from one mode to the other keeps the Start date, which becomes the
   * rule's start. A chosen `start` (today or later) takes the Start date's place.
   */
  function setRepeat(
    id: string,
    pattern: RepeatPattern | null,
    mode: RepeatMode = "onSchedule",
    opts: RepeatOptions = {},
  ): void {
    const toDo = ctx.require("toDos", id);
    if (pattern === null) {
      ctx.update("toDos", id, { repeat: null, seriesId: null, seriesValues: null });
      return;
    }
    if (toDo.parentId) throw new Error("A Sub-to-do can't have a Repeat rule of its own");
    checkPattern(pattern);
    const start = firstDate(toDo, pattern, mode, clock.today(), opts.start);
    ctx.update("toDos", id, {
      repeat: {
        mode,
        rrule: formatRrule(pattern, { gap: mode === "afterCompletion" }),
        start,
        // A changed rule keeps the series' count; a new rule starts it at 1.
        occurrence: occurrenceNumber(ctx, toDo),
      },
      seriesId: toDo.seriesId ?? ctx.meta().id,
      // A changed rule keeps "this one" changes; a new series starts without them.
      seriesValues: toDo.repeat ? toDo.seriesValues : null,
      startDate: start,
      someday: false,
      evening: start === toDo.startDate && toDo.evening,
    });
  }

  return {
    setRepeat,

    /**
     * Changes the start (DTSTART) of a To-do's Repeat rule, which shifts the whole
     * schedule, so it applies to all future occurrences. The current occurrence moves
     * to the rule's first date on or after `date` (after completion, to `date`).
     * `date` can't be before today.
     */
    setRepeatStart(id: string, date: LocalDate): void {
      const rule = ctx.require("toDos", id).repeat;
      if (!rule) throw new Error("This To-do doesn't repeat");
      setRepeat(id, parseRrule(rule.rrule), rule.mode, { start: date });
    },

    /**
     * The Start dates the series would have if `pattern` were set on this To-do in
     * `mode`, from the To-do's own: up to `limit`, fewer if the rule ends sooner,
     * completing each occurrence on its Start date (or today, if that has passed).
     * Empty for a rule after completion, whose dates aren't known until each one is
     * done, and for a rule with no dates.
     */
    repeatPreview(
      id: string,
      pattern: RepeatPattern,
      mode: RepeatMode = "onSchedule",
      { start: chosen, limit = previewLength }: RepeatOptions & { limit?: number } = {},
    ): LocalDate[] {
      if (mode === "afterCompletion") return [];
      const toDo = ctx.require("toDos", id);
      let start: LocalDate;
      try {
        checkPattern(pattern);
        start = firstDate(toDo, pattern, mode, clock.today(), chosen);
      } catch {
        return [];
      }
      const dates = [start];
      const length = Math.min(limit, 1 + occurrencesLeft(ctx, toDo, pattern));
      for (const date of repeatDates(pattern, start, later(start, clock.today()))) {
        if (dates.length >= length) break;
        dates.push(date);
      }
      return dates.slice(0, length);
    },

    /** A To-do's Repeat rule as its parts, or null if it doesn't repeat. */
    repeatPatternOf(id: string): RepeatPattern | null {
      const rule = ctx.require("toDos", id).repeat;
      return rule ? parseRrule(rule.rrule) : null;
    },

    /** The open occurrence of the series this To-do belongs to, if there is one. */
    currentOccurrence(id: string): ToDo | undefined {
      const toDo = ctx.require("toDos", id);
      if (!toDo.seriesId) return undefined;
      return openOccurrence(ctx, toDo.seriesId);
    },
  };
}
