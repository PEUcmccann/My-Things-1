import type { Context } from "./context";
import type { FinishOptions } from "./logbook";
import type { Destination, When } from "./toDos";
import type { LocalDate } from "./types";

interface Actions {
  moveToDo(id: string, to: Destination): void;
  setWhen(id: string, when: When): void;
  setDeadline(id: string, date: LocalDate | null): void;
  addTag(target: { kind: "toDo"; id: string }, tagId: string): void;
  complete(id: string, opts?: FinishOptions): void;
  cancel(id: string, opts?: FinishOptions): void;
  delete(id: string): void;
}

/** The same action applied to several selected To-dos at once. */
export function bulkActions(ctx: Context, a: Actions) {
  const { store } = ctx;
  const live = (ids: string[]) => [...new Set(ids)].filter((id) => store.get("toDos", id));

  /** Sub-to-dos first, so a parent sees which of its children are already finished. */
  function childrenFirst(ids: string[]): string[] {
    const isChild = (id: string) => ctx.require("toDos", id).parentId !== null;
    return [...ids.filter(isChild), ...ids.filter((id) => !isChild(id))];
  }

  function needsChoice(ids: string[]): boolean {
    const selected = new Set(ids);
    return ids.some((id) =>
      store
        .all("toDos")
        .some(
          (t) => t.parentId === id && t.outcome === "active" && !t.deletedAt && !selected.has(t.id),
        ),
    );
  }

  function finishAll(ids: string[], outcome: "complete" | "cancel", opts: FinishOptions) {
    const list = live(ids);
    if (needsChoice(list) && !opts.remaining) {
      throw new Error(
        "Some selected To-dos have open Sub-to-dos: choose to complete or cancel them",
      );
    }
    for (const id of childrenFirst(list)) {
      if (ctx.require("toDos", id).outcome !== "active") continue;
      if (outcome === "complete") a.complete(id, opts);
      else a.cancel(id, opts);
    }
  }

  return {
    /**
     * Whether finishing these To-dos together leaves open Sub-to-dos behind, so
     * the user must choose to complete or cancel them.
     */
    bulkNeedsRemainingChoice(ids: string[]): boolean {
      return needsChoice(live(ids));
    },

    /** Files the selected To-dos. Sub-to-dos stay with their parent and are skipped. */
    moveMany(ids: string[], to: Destination): void {
      for (const id of live(ids)) {
        if (ctx.require("toDos", id).parentId === null) a.moveToDo(id, to);
      }
    },

    setWhenMany(ids: string[], when: When): void {
      for (const id of live(ids)) a.setWhen(id, when);
    },

    setDeadlineMany(ids: string[], date: LocalDate | null): void {
      for (const id of live(ids)) a.setDeadline(id, date);
    },

    addTagsMany(ids: string[], tagIds: string[]): void {
      for (const id of live(ids)) for (const tag of tagIds) a.addTag({ kind: "toDo", id }, tag);
    },

    completeMany(ids: string[], opts: FinishOptions = {}): void {
      finishAll(ids, "complete", opts);
    },

    cancelMany(ids: string[], opts: FinishOptions = {}): void {
      finishAll(ids, "cancel", opts);
    },

    /** Moves the selected To-dos to the Trash. */
    deleteMany(ids: string[]): void {
      for (const id of live(ids)) {
        if (!ctx.isTrashed(ctx.require("toDos", id))) a.delete(id);
      }
    },
  };
}
