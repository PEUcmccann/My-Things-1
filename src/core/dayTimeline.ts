import type { Context, ToDoEntry } from "./context";
import type { TodayList } from "./lists";

/** Where a block sits across the timeline when it overlaps others. */
export interface Lane {
  /** Its column, from 0 at the left. */
  lane: number;
  /** How many columns its group of overlapping blocks shares the width between. */
  lanes: number;
}

/** A block's place in the day, in minutes from 00:00. */
interface Span {
  start: number;
  end: number;
}

/**
 * A block on the day timeline. Only Time slots for now; calendar events will
 * be a second kind (Milestone 4), with the same start, end and lane.
 */
export type TimelineEntry = { kind: "timeSlot" } & Span & Lane & ToDoEntry;

export interface DayTimeline {
  /** Where the timeline starts and ends, in minutes from 00:00, on the hour. */
  from: number;
  to: number;
  /** The current time, in minutes from 00:00. */
  now: number;
  /** In order of start time, then end time. */
  entries: TimelineEntry[];
}

/** The hours shown on an ordinary day: 06:00 to 23:00. */
export const timelineDay = { from: 6 * 60, to: 23 * 60 };

/**
 * Puts each block in the leftmost column that is free when it starts. Blocks that
 * overlap, directly or through a chain of others, share the width between the
 * columns their group needs. The blocks must be in order of start time.
 */
function placeInLanes<T extends Span>(spans: T[]): (T & Lane)[] {
  const placed: (T & Lane)[] = [];
  let group: (T & Lane)[] = [];
  let laneEnds: number[] = [];
  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const span of spans) {
    if (group.length > 0 && laneEnds.every((end) => end <= span.start)) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.end;
    const p = { ...span, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
  }
  closeGroup();
  return placed;
}

export function dayTimelineQueries(ctx: Context, lists: { today(): TodayList }) {
  return {
    /** The day timeline for today: the Time slots of the To-dos in Today. */
    dayTimeline(): DayTimeline {
      const today = ctx.clock.today();
      const { main, thisEvening } = lists.today();
      const slots: ({ kind: "timeSlot" } & Span & ToDoEntry)[] = [];
      for (const e of [...main, ...thisEvening]) {
        const slot = e.toDo.timeSlot;
        // A slot belongs to its Start date, so one on an earlier day is not today's.
        if (!slot || e.toDo.startDate !== today) continue;
        slots.push({ kind: "timeSlot", start: slot.start, end: slot.end, ...e });
      }
      // Ties keep Today's order (the sort is stable).
      slots.sort((a, b) => a.start - b.start || a.end - b.end);
      const entries = placeInLanes(slots);
      // Widened to the hour, so no slot is cut off.
      const from = Math.min(timelineDay.from, ...entries.map((e) => Math.floor(e.start / 60) * 60));
      const to = Math.max(timelineDay.to, ...entries.map((e) => Math.ceil(e.end / 60) * 60));
      const moment = ctx.clock.now();
      const now = moment.getHours() * 60 + moment.getMinutes();
      return { from, to, now, entries };
    },
  };
}
