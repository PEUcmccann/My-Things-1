import type { Context } from "./context";
import type { LocalDate, ToDo } from "./types";

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

export function toDoActions(ctx: Context) {
  const { store, clock } = ctx;

  function setStartDate(id: string, date: LocalDate | null, opts: { evening?: boolean } = {}) {
    ctx.update("toDos", id, {
      startDate: date,
      evening: date !== null && (opts.evening ?? false),
      someday: false,
    });
  }

  function setWhen(id: string, when: When): void {
    ctx.update("toDos", id, whenFields(when, clock.today()));
  }

  return {
    createToDo(input: NewToDo): string {
      const parent = input.parentId ? ctx.require("toDos", input.parentId) : null;
      const heading = input.headingId ? ctx.require("headings", input.headingId) : null;
      const projectId = parent ? parent.projectId : (heading?.projectId ?? input.projectId ?? null);
      const meta = ctx.meta();
      store.put("toDos", {
        ...meta,
        title: input.title,
        notes: "",
        outcome: "active",
        finishedAt: null,
        loggedAt: null,
        startDate: null,
        evening: false,
        someday: false,
        deadline: null,
        // A Sub-to-do always sits where its parent sits. A To-do in a Project takes
        // its Area from the Project.
        areaId: parent ? parent.areaId : projectId ? null : (input.areaId ?? null),
        projectId,
        headingId: parent ? parent.headingId : (heading?.id ?? null),
        parentId: parent ? parent.id : null,
        deletedAt: null,
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
      ctx.update("toDos", id, { ...place, ...extra });
      for (const child of store.all("toDos")) {
        if (child.parentId === id) ctx.update("toDos", child.id, place);
      }
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
