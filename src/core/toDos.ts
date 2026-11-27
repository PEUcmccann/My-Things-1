import { byPosition, type Context } from "./context";
import type { LocalDate, TimeSlot, ToDo } from "./types";

/** A choice of "When" for a To-do: what the Start date picker offers. */
export type When =
  | { kind: "today" }
  | { kind: "thisEvening" }
  | { kind: "date"; date: LocalDate }
  | { kind: "someday" }
  | { kind: "none" };

export interface NewToDo {
  title: string;
  areaId?: string;
  projectId?: string;
  /** Files the new To-do under this Heading, in the Heading's Project. */
  headingId?: string;
  parentId?: string;
  /** "When" for the new To-do, as when it is created from Today or Someday. */
  when?: When;
}

/** Where a To-do can be filed. */
export type Destination =
  | { kind: "inbox" }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string }
  | { kind: "heading"; id: string };

/** The Start date fields for a choice of "When". */
export function whenFields(
  when: When,
  today: LocalDate,
): Pick<ToDo, "startDate" | "evening" | "someday"> {
  switch (when.kind) {
    case "today":
      return { startDate: today, evening: false, someday: false };
    case "thisEvening":
      return { startDate: today, evening: true, someday: false };
    case "date":
      return { startDate: when.date, evening: false, someday: false };
    case "someday":
      return { startDate: null, evening: false, someday: true };
    case "none":
      return { startDate: null, evening: false, someday: false };
  }
}

/** Minutes in a day: a Time slot can end at 24:00 but not later. */
export const endOfDay = 24 * 60;

/** Whole minutes from 00:00, the end after the start and no later than 24:00. */
export function isValidTimeSlot({ start, end }: TimeSlot): boolean {
  return (
    Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= endOfDay
  );
}

/** How long a Time slot is by default, when the To-do has no Estimate. */
export const defaultSlotMinutes = 30;

/**
 * How long a new Time slot for this To-do should be: its Estimate, or 30 minutes.
 * Estimates arrive with #22; until then every To-do gets the default.
 */
function slotLengthFor(_toDo: ToDo): number {
  return defaultSlotMinutes;
}

export function toDoActions(ctx: Context) {
  const { store, clock } = ctx;

  /**
   * Updates a To-do's Start date fields. Its Time slot moves with the Start date (same
   * times, new day) and is cleared along with it, since a slot needs a Start date.
   */
  function updateDated(id: string, changes: Partial<ToDo>) {
    ctx.update("toDos", id, changes.startDate === null ? { ...changes, timeSlot: null } : changes);
  }

  function setStartDate(id: string, date: LocalDate | null, opts: { evening?: boolean } = {}) {
    updateDated(id, {
      startDate: date,
      evening: date !== null && (opts.evening ?? false),
      someday: false,
    });
  }

  function setWhen(id: string, when: When): void {
    updateDated(id, whenFields(when, clock.today()));
  }

  return {
    createToDo(input: NewToDo): string {
      const parent = input.parentId ? ctx.require("toDos", input.parentId) : null;
      if (parent?.parentId) throw new Error("Sub-to-dos are only one level deep");
      const heading = input.headingId ? ctx.require("headings", input.headingId) : null;
      const projectId = parent ? parent.projectId : (heading?.projectId ?? input.projectId ?? null);
      const meta = ctx.meta();
      store.put("toDos", {
        ...meta,
        position: ctx.nextPosition("toDos"),
        todayPosition: null,
        title: input.title,
        notes: "",
        tagIds: [],
        outcome: "active",
        finishedAt: null,
        loggedAt: null,
        startDate: null,
        evening: false,
        someday: false,
        deadline: null,
        timeSlot: null,
        // A Sub-to-do always sits where its parent sits. A To-do in a Project takes
        // its Area from the Project.
        areaId: parent ? parent.areaId : projectId ? null : (input.areaId ?? null),
        projectId,
        headingId: parent ? parent.headingId : (heading?.id ?? null),
        parentId: parent ? parent.id : null,
        deletedAt: null,
        priority: "none",
        energy: null,
        estimate: null,
      });
      if (input.when) setWhen(meta.id, input.when);
      return meta.id;
    },

    /** Changes a To-do's title (a blank title is ignored) or its notes. */
    editToDo(id: string, changes: { title?: string; notes?: string }): void {
      const next: Partial<ToDo> = {};
      if (changes.title !== undefined) {
        next.title = changes.title.trim() || ctx.require("toDos", id).title;
      }
      if (changes.notes !== undefined) next.notes = changes.notes;
      ctx.update("toDos", id, next);
    },

    /** Sets "When": Today, This Evening, a date, Someday, or nothing. */
    setWhen,

    /** Sets the Start date ("When"). `evening` puts it in This Evening. */
    setStartDate,

    /** Choosing "Today" just sets the Start date to today. */
    moveToToday(id: string, opts: { evening?: boolean } = {}): void {
      setStartDate(id, clock.today(), opts);
    },

    moveToSomeday(id: string): void {
      setWhen(id, { kind: "someday" });
    },

    /** Sets or clears the To-do's Time slot, on its Start date. */
    setTimeSlot(id: string, slot: TimeSlot | null): void {
      if (slot && !isValidTimeSlot(slot)) {
        throw new Error("A Time slot must end after it starts, within one day");
      }
      // A slot needs a Start date: without one (or in Someday) it goes on today.
      const dated =
        slot && !ctx.require("toDos", id).startDate
          ? whenFields({ kind: "today" }, clock.today())
          : {};
      ctx.update("toDos", id, { ...dated, timeSlot: slot && { start: slot.start, end: slot.end } });
    },

    /** The end to pre-fill once a start time is picked: start plus the slot length, by 24:00. */
    suggestedSlotEnd(id: string, start: number): number {
      return Math.min(start + slotLengthFor(ctx.require("toDos", id)), endOfDay);
    },

    setDeadline(id: string, date: LocalDate | null): void {
      ctx.update("toDos", id, { deadline: date });
    },

    /**
     * Files a To-do in the Inbox, an Area, a Project or under a Heading. Its
     * Sub-to-dos move with it. Moving to the Inbox also clears "When", since a
     * To-do with a Start date has already been organised.
     */
    moveToDo(id: string, to: Destination): void {
      const item = ctx.require("toDos", id);
      if (item.parentId) throw new Error("A Sub-to-do moves with its parent");
      const heading = to.kind === "heading" ? ctx.require("headings", to.id) : null;
      const place: Pick<ToDo, "areaId" | "projectId" | "headingId"> = {
        areaId: to.kind === "area" ? ctx.require("areas", to.id).id : null,
        projectId:
          to.kind === "project" ? ctx.require("projects", to.id).id : (heading?.projectId ?? null),
        headingId: heading?.id ?? null,
      };
      const extra = to.kind === "inbox" ? whenFields({ kind: "none" }, clock.today()) : {};
      updateDated(id, { ...place, ...extra });
      for (const child of store.all("toDos")) {
        if (child.parentId === id) ctx.update("toDos", child.id, place);
      }
    },

    /** Turns a Sub-to-do into a normal To-do, in the same place. */
    promote(id: string): void {
      ctx.update("toDos", id, { parentId: null });
    },

    /** A To-do's Sub-to-dos, oldest first, including finished ones. */
    subToDos(parentId: string): ToDo[] {
      return store
        .all("toDos")
        .filter((t) => t.parentId === parentId && !t.deletedAt)
        .sort(byPosition);
    },

    getToDo(id: string): ToDo {
      return ctx.require("toDos", id);
    },

    /** The To-do with this id, or undefined once it has been removed for good. */
    findToDo(id: string): ToDo | undefined {
      return ctx.find("toDos", id);
    },
  };
}
