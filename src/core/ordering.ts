import { byPosition, todayKey, type Context, type ToDoEntry } from "./context";
import type { HeadingSection } from "./headings";
import type { TodayList } from "./lists";
import type { Destination, When } from "./toDos";
import type { Ordered, RecordMeta, ToDo } from "./types";

/** A list of To-dos that keeps its own order. */
export type ListRef =
  | { kind: "inbox" }
  | { kind: "today"; part: "main" | "thisEvening" }
  | { kind: "anytime" }
  | { kind: "someday" }
  | { kind: "area"; id: string }
  /** The To-dos in a Project that are not under a Heading. */
  | { kind: "project"; id: string }
  | { kind: "heading"; id: string };

/** Somewhere a To-do can be dropped to file or schedule it. */
export type DropTarget =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "someday" }
  | { kind: "area"; id: string }
  | { kind: "project"; id: string }
  | { kind: "heading"; id: string };

interface Queries {
  inbox(): ToDoEntry[];
  today(): TodayList;
  anytime(): ToDoEntry[];
  someday(): ToDoEntry[];
  areaContents(id: string): { toDos: ToDoEntry[] };
  projectContents(id: string): { toDos: ToDoEntry[]; headings: HeadingSection[] };
  moveToDo(id: string, to: Destination): void;
  setWhen(id: string, when: When): void;
}

/** The smallest gap between neighbours before a list is renumbered. */
const minGap = 1e-6;

/**
 * Works out a sort key between two neighbours. When they are too close, the list
 * is renumbered first, so keys never run out.
 */
function keyBetween<T>(
  ordered: T[],
  index: number,
  key: (neighbour: T) => number,
  renumber: (ordered: T[]) => void,
): number {
  const prev = ordered[index - 1];
  const next = ordered[index];
  if (prev !== undefined && next !== undefined) {
    if (key(next) - key(prev) < minGap) {
      renumber(ordered);
      return index - 0.5;
    }
    return (key(prev) + key(next)) / 2;
  }
  if (prev !== undefined) return key(prev) + 1;
  if (next !== undefined) return key(next) - 1;
  return 0;
}

export function orderingActions(ctx: Context, q: Queries) {
  const { store, clock } = ctx;

  function idsIn(list: ListRef): ToDo[] {
    const pick = (entries: ToDoEntry[]) => entries.map((e) => e.toDo);
    switch (list.kind) {
      case "inbox":
        return pick(q.inbox());
      case "today":
        return pick(q.today()[list.part]);
      case "anytime":
        return pick(q.anytime());
      case "someday":
        return pick(q.someday());
      case "area":
        return pick(q.areaContents(list.id).toDos);
      case "project":
        return pick(q.projectContents(list.id).toDos);
      case "heading": {
        const heading = ctx.require("headings", list.id);
        const section = q
          .projectContents(heading.projectId)
          .headings.find((h) => h.heading.id === list.id);
        return pick(section?.toDos ?? []);
      }
    }
  }

  /** Makes a To-do a member of a list it is being dropped into. */
  function join(id: string, list: ListRef): void {
    const toDo = ctx.require("toDos", id);
    const contained = !toDo.parentId;
    switch (list.kind) {
      case "inbox":
        if (contained) q.moveToDo(id, { kind: "inbox" });
        return;
      case "today": {
        const evening = list.part === "thisEvening";
        const due = toDo.startDate !== null && toDo.startDate <= clock.today();
        if (!due || toDo.evening !== evening) {
          q.setWhen(id, { kind: evening ? "thisEvening" : "today" });
        }
        return;
      }
      case "someday":
        if (!toDo.someday) q.setWhen(id, { kind: "someday" });
        return;
      case "anytime":
        return;
      case "area":
        if (contained && (toDo.areaId !== list.id || toDo.projectId)) {
          q.moveToDo(id, { kind: "area", id: list.id });
        }
        return;
      case "project":
        if (contained && (toDo.projectId !== list.id || toDo.headingId)) {
          q.moveToDo(id, { kind: "project", id: list.id });
        }
        return;
      case "heading":
        if (contained && toDo.headingId !== list.id) {
          q.moveToDo(id, { kind: "heading", id: list.id });
        }
        return;
    }
  }

  function placeIn<T extends RecordMeta & Ordered>(
    collection: "areas" | "projects",
    siblings: T[],
    id: string,
    beforeId: string | null,
  ): void {
    const others = siblings.filter((s) => s.id !== id);
    const index = beforeId ? others.findIndex((s) => s.id === beforeId) : -1;
    const at = index === -1 ? others.length : index;
    const position = keyBetween(
      others,
      at,
      (s) => s.position ?? 0,
      // Both collections are Ordered, so either takes a position.
      (ordered) =>
        ordered.forEach((s, i) => ctx.update(collection as "areas", s.id, { position: i })),
    );
    ctx.update(collection as "areas", id, { position });
  }

  function placeToDo(list: ListRef, id: string, beforeId: string | null): void {
    join(id, list);
    const others = idsIn(list).filter((t) => t.id !== id);
    const index = beforeId ? others.findIndex((t) => t.id === beforeId) : -1;
    const at = index === -1 ? others.length : index;
    if (list.kind === "today") {
      const todayPosition = keyBetween(others, at, todayKey, (ordered) =>
        ordered.forEach((t, i) => ctx.update("toDos", t.id, { todayPosition: i })),
      );
      ctx.update("toDos", id, { todayPosition });
    } else {
      const position = keyBetween(
        others,
        at,
        (t) => t.position ?? 0,
        (ordered) => ordered.forEach((t, i) => ctx.update("toDos", t.id, { position: i })),
      );
      ctx.update("toDos", id, { position });
    }
  }

  return {
    /**
     * Puts a To-do in a list just before another one, or at the end with null.
     * Dropping a To-do into a list it is not in files or schedules it there
     * first (Sub-to-dos keep their parent's place and only change order).
     */
    placeToDo,

    /** Files or schedules a To-do by dropping it on a list, Area, Project or Heading. */
    dropToDo(id: string, target: DropTarget): void {
      const toDo = ctx.require("toDos", id);
      switch (target.kind) {
        case "today":
          q.setWhen(id, { kind: "today" });
          return;
        case "someday":
          q.setWhen(id, { kind: "someday" });
          return;
        default:
          if (toDo.parentId) throw new Error("A Sub-to-do moves with its parent");
          q.moveToDo(id, target);
          // It lands at the end of its new list.
          ctx.update("toDos", id, { position: ctx.nextPosition("toDos") });
      }
    },

    /** Reorders Areas in the sidebar. */
    placeArea(id: string, beforeId: string | null): void {
      placeIn("areas", store.all("areas").sort(byPosition), id, beforeId);
    },

    /**
     * Reorders a Project in the sidebar among the Projects of an Area (or those
     * with no Area), moving it into that Area if needed.
     */
    placeProject(id: string, areaId: string | null, beforeId: string | null): void {
      const project = ctx.require("projects", id);
      if (project.areaId !== areaId) ctx.update("projects", id, { areaId });
      const siblings = store
        .all("projects")
        .filter((p) => p.areaId === areaId && !p.deletedAt)
        .sort(byPosition);
      placeIn("projects", siblings, id, beforeId);
    },
  };
}
