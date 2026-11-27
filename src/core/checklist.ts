import type { Context } from "./context";
import type { ChecklistItem } from "./types";

export interface ChecklistProgress {
  ticked: number;
  total: number;
}

export function checklistActions(ctx: Context) {
  const { store } = ctx;

  function itemsOf(toDoId: string): ChecklistItem[] {
    return store
      .all("checklistItems")
      .filter((c) => c.toDoId === toDoId)
      .sort((a, b) => a.position - b.position);
  }

  return {
    /** Adds a Checklist item at the end of a To-do's Checklist. */
    addChecklistItem(toDoId: string, title: string): string {
      ctx.require("toDos", toDoId);
      const items = itemsOf(toDoId);
      const meta = ctx.meta();
      store.put("checklistItems", {
        ...meta,
        toDoId,
        title: title.trim(),
        ticked: false,
        position: items.length ? items[items.length - 1].position + 1 : 0,
      });
      return meta.id;
    },

    renameChecklistItem(id: string, title: string): void {
      if (title.trim()) ctx.update("checklistItems", id, { title: title.trim() });
    },

    /** Ticks or unticks a Checklist item. */
    tickChecklistItem(id: string, ticked: boolean): void {
      ctx.update("checklistItems", id, { ticked });
    },

    /** Moves a Checklist item to `index` within its To-do's Checklist. */
    moveChecklistItem(id: string, index: number): void {
      const item = ctx.require("checklistItems", id);
      const others = itemsOf(item.toDoId).filter((c) => c.id !== id);
      const at = Math.max(0, Math.min(index, others.length));
      others.splice(at, 0, item);
      others.forEach((c, i) => {
        if (c.position !== i || c.id === id) ctx.update("checklistItems", c.id, { position: i });
      });
    },

    deleteChecklistItem(id: string): void {
      ctx.require("checklistItems", id);
      store.remove("checklistItems", id);
    },

    /** A To-do's Checklist, in order. */
    checklist(toDoId: string): ChecklistItem[] {
      return itemsOf(toDoId);
    },

    checklistProgress(toDoId: string): ChecklistProgress {
      const items = itemsOf(toDoId);
      return { ticked: items.filter((c) => c.ticked).length, total: items.length };
    },
  };
}
