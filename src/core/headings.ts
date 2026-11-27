import { byCreation, type Context, type ToDoEntry } from "./context";
import type { Heading } from "./types";

export interface HeadingSection {
  heading: Heading;
  toDos: ToDoEntry[];
}

/** A Project's screen: To-dos without a Heading first, then each Heading in order. */
export interface ProjectContents {
  toDos: ToDoEntry[];
  headings: HeadingSection[];
}

export function headingActions(ctx: Context) {
  const { store } = ctx;

  const toDosUnder = (headingId: string) =>
    store.all("toDos").filter((t) => t.headingId === headingId && !ctx.isTrashed(t));

  function canArchive(id: string): boolean {
    return toDosUnder(id).every((t) => t.outcome !== "active");
  }

  return {
    createHeading(projectId: string, title: string): string {
      ctx.require("projects", projectId);
      const meta = ctx.meta();
      store.put("headings", {
        ...meta,
        projectId,
        title: title.trim() || "New Heading",
        archivedAt: null,
      });
      return meta.id;
    },

    renameHeading(id: string, title: string): void {
      if (title.trim()) ctx.update("headings", id, { title: title.trim() });
    },

    getHeading(id: string): Heading {
      return ctx.require("headings", id);
    },

    /** Whether every To-do under the Heading is Completed or Cancelled. */
    canArchiveHeading: canArchive,

    /**
     * Archives a Heading whose To-dos are all finished. It leaves the Project
     * screen, and its To-dos move to the Logbook.
     */
    archiveHeading(id: string): void {
      if (!canArchive(id)) throw new Error("Only a Heading whose To-dos are all finished");
      const now = ctx.now();
      for (const t of toDosUnder(id)) {
        if (!t.loggedAt) ctx.update("toDos", t.id, { loggedAt: now });
      }
      ctx.update("headings", id, { archivedAt: now });
    },

    unarchiveHeading(id: string): void {
      ctx.update("headings", id, { archivedAt: null });
    },

    /**
     * Deletes a Heading. Its To-dos either go to the Trash or stay in the Project
     * without a Heading.
     */
    deleteHeading(id: string, opts: { toDos: "delete" | "keep" }): void {
      ctx.require("headings", id);
      const now = ctx.now();
      for (const t of store.all("toDos")) {
        if (t.headingId !== id) continue;
        const trash = opts.toDos === "delete" && !t.parentId && !t.deletedAt;
        ctx.update("toDos", t.id, { headingId: null, ...(trash ? { deletedAt: now } : {}) });
      }
      store.remove("headings", id);
    },

    /** A Project's Headings that are not archived, in order. */
    headings(projectId: string): Heading[] {
      return store
        .all("headings")
        .filter((h) => h.projectId === projectId && !h.archivedAt)
        .sort(byCreation);
    },

    /** What a Project's screen shows: loose To-dos, then each open Heading's To-dos. */
    projectContents(projectId: string): ProjectContents {
      const open = store
        .all("toDos")
        .filter((t) => t.projectId === projectId && ctx.isOpenInLists(t))
        .sort(byCreation);
      const headings = store
        .all("headings")
        .filter((h) => h.projectId === projectId && !h.archivedAt)
        .sort(byCreation);
      const known = new Set(headings.map((h) => h.id));
      return {
        toDos: open.filter((t) => !t.headingId || !known.has(t.headingId)).map(ctx.entry),
        headings: headings.map((heading) => ({
          heading,
          toDos: open.filter((t) => t.headingId === heading.id).map(ctx.entry),
        })),
      };
    },
  };
}
