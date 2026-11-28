import type { Context, ToDoEntry } from "./context";
import type { Store } from "./store";
import type { Attachment, Project, ToDo } from "./types";

/** How long deleted items stay in the Trash. */
export const trashDays = 30;

export type TrashEntry =
  ({ kind: "toDo" } & ToDoEntry) | { kind: "project"; project: Project; toDoCount: number };

/**
 * Removes a To-do for good, with its Sub-to-dos, Checklist and Attachments. Returns
 * the Attachments removed, so the app can delete their files.
 */
export function eraseToDoFrom(store: Store, id: string): Attachment[] {
  const removed: Attachment[] = [];
  for (const child of store.all("toDos")) {
    if (child.parentId === id) removed.push(...eraseToDoFrom(store, child.id));
  }
  for (const c of store.all("checklistItems")) {
    if (c.toDoId === id) store.remove("checklistItems", c.id);
  }
  for (const a of store.all("attachments")) {
    if (a.toDoId === id) {
      store.remove("attachments", a.id);
      removed.push(a);
    }
  }
  store.remove("toDos", id);
  return removed;
}

export function trashActions(ctx: Context) {
  const { store } = ctx;

  const eraseToDo = (id: string) => eraseToDoFrom(store, id);

  /** Removes a Project for good, with everything in it. Returns the Attachments removed. */
  function eraseProject(id: string): Attachment[] {
    const removed: Attachment[] = [];
    for (const t of store.all("toDos")) {
      if (t.projectId === id && store.get("toDos", t.id)) removed.push(...eraseToDo(t.id));
    }
    for (const h of store.all("headings")) {
      if (h.projectId === id) store.remove("headings", h.id);
    }
    store.remove("projects", id);
    return removed;
  }

  function trashContents(): { toDos: ToDo[]; projects: Project[] } {
    return {
      toDos: store.all("toDos").filter((t) => t.deletedAt),
      projects: store.all("projects").filter((p) => p.deletedAt),
    };
  }

  return {
    /** Moves a To-do, with its Sub-to-dos, to the Trash. */
    delete(id: string): void {
      ctx.update("toDos", id, { deletedAt: ctx.now() });
    },

    /** Moves a Project, with its To-dos, to the Trash. */
    deleteProject(id: string): void {
      ctx.update("projects", id, { deletedAt: ctx.now() });
    },

    /**
     * Takes a To-do out of the Trash and puts it back where it was. If its Project,
     * Area or parent To-do has gone (or is itself in the Trash), it goes to the
     * Inbox, or becomes a normal To-do in its parent's place.
     */
    restore(id: string): void {
      const toDo = ctx.require("toDos", id);
      const live = <T extends { deletedAt?: string | null }>(r: T | undefined) =>
        r && !r.deletedAt ? r : undefined;
      const parent = live(ctx.find("toDos", toDo.parentId));
      const project = live(ctx.find("projects", toDo.projectId));
      const area = ctx.find("areas", toDo.areaId);
      const heading = ctx.find("headings", toDo.headingId);
      ctx.update("toDos", id, {
        deletedAt: null,
        parentId: parent ? parent.id : null,
        projectId: project ? project.id : null,
        areaId: project ? null : (area?.id ?? null),
        headingId: project && heading?.projectId === project.id ? heading.id : null,
      });
    },

    /** Takes a Project out of the Trash, with the To-dos that were deleted with it. */
    restoreProject(id: string): void {
      const project = ctx.require("projects", id);
      const area = ctx.find("areas", project.areaId);
      ctx.update("projects", id, { deletedAt: null, areaId: area?.id ?? null });
    },

    /** Whether a To-do is in the Trash, itself or with its parent or Project. */
    isInTrash(id: string): boolean {
      return ctx.isTrashed(ctx.require("toDos", id));
    },

    /** Everything deleted, most recently deleted first. */
    trash(): TrashEntry[] {
      const { toDos, projects } = trashContents();
      const entries: (TrashEntry & { at: string })[] = [
        ...toDos.map((t) => ({ kind: "toDo" as const, ...ctx.entry(t), at: t.deletedAt! })),
        ...projects.map((p) => ({
          kind: "project" as const,
          project: p,
          toDoCount: store.all("toDos").filter((t) => t.projectId === p.id && !t.deletedAt).length,
          at: p.deletedAt!,
        })),
      ];
      return entries.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...e }) => e);
    },

    /**
     * Removes everything deleted more than 30 days ago. Returns the Attachments removed
     * with it, whose files the app deletes from Storage.
     */
    purgeExpiredTrash(): Attachment[] {
      const cutoff = new Date(ctx.clock.now().getTime() - trashDays * 86_400_000).toISOString();
      const { toDos, projects } = trashContents();
      const removed: Attachment[] = [];
      for (const p of projects) if (p.deletedAt! < cutoff) removed.push(...eraseProject(p.id));
      for (const t of toDos) {
        if (t.deletedAt! < cutoff && store.get("toDos", t.id)) removed.push(...eraseToDo(t.id));
      }
      return removed;
    },

    /**
     * Removes everything in the Trash for good. Returns the Attachments removed with it,
     * whose files the app deletes from Storage.
     */
    emptyTrash(): Attachment[] {
      const { toDos, projects } = trashContents();
      const removed: Attachment[] = [];
      for (const p of projects) removed.push(...eraseProject(p.id));
      for (const t of toDos) if (store.get("toDos", t.id)) removed.push(...eraseToDo(t.id));
      return removed;
    },
  };
}
