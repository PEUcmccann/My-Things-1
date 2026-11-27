import { toLocalDate } from "./clock";
import type { Context, Finishable, ToDoEntry } from "./context";
import { createNextOccurrence, reopenOccurrence } from "./repeat";
import type { LocalDate, LogbookMode, Project } from "./types";

export type LogbookEntry = ({ kind: "toDo" } & ToDoEntry) | { kind: "project"; project: Project };

export interface LogbookDay {
  date: LocalDate;
  entries: LogbookEntry[];
}

/** What to do with the open To-dos left in a Project or parent To-do when it is finished. */
export type Remaining = "complete" | "cancel";

export interface FinishOptions {
  /** Required when there are open To-dos left: complete or cancel them too. */
  remaining?: Remaining;
}

const outcomeOf = { complete: "completed", cancel: "cancelled" } as const;

export function logbookActions(ctx: Context) {
  const { store } = ctx;

  function finishedFields(outcome: "completed" | "cancelled") {
    const now = ctx.now();
    const logNow = store.settings().logbookMode === "immediately";
    return { outcome, finishedAt: now, loggedAt: logNow ? now : null };
  }

  function finishToDo(id: string, outcome: "completed" | "cancelled"): void {
    ctx.update("toDos", id, finishedFields(outcome));
  }

  function openSubToDosOf(parentId: string) {
    return store
      .all("toDos")
      .filter((t) => t.parentId === parentId && t.outcome === "active" && !t.deletedAt);
  }

  /** Finishes a To-do. A parent with open Sub-to-dos needs a choice for them. */
  function finishWithChildren(
    id: string,
    outcome: "completed" | "cancelled",
    opts: FinishOptions,
  ): void {
    const open = openSubToDosOf(id);
    if (open.length > 0 && !opts.remaining) {
      throw new Error("This To-do has open Sub-to-dos: choose to complete or cancel them");
    }
    for (const t of open) finishToDo(t.id, outcomeOf[opts.remaining!]);
    finishToDo(id, outcome);
    // Completing or cancelling a repeating To-do brings on its next occurrence.
    createNextOccurrence(ctx, id);
  }

  function openToDosOf(projectId: string) {
    return store
      .all("toDos")
      .filter((t) => t.projectId === projectId && t.outcome === "active" && !ctx.isTrashed(t));
  }

  function finishProject(id: string, outcome: "completed" | "cancelled", opts: FinishOptions) {
    const open = openToDosOf(id);
    if (open.length > 0 && !opts.remaining) {
      throw new Error("This Project has open To-dos: choose to complete or cancel them");
    }
    for (const t of open) finishToDo(t.id, outcomeOf[opts.remaining!]);
    ctx.update("projects", id, finishedFields(outcome));
  }

  /** Stamps everything that has reached the Logbook, so it stays there. */
  function stampLogged(include: (finishable: Finishable) => boolean) {
    const now = ctx.now();
    for (const t of store.all("toDos")) {
      if (!t.loggedAt && include(t)) ctx.update("toDos", t.id, { loggedAt: now });
    }
    for (const p of store.all("projects")) {
      if (!p.loggedAt && include(p)) ctx.update("projects", p.id, { loggedAt: now });
    }
  }

  return {
    /**
     * Completes a To-do. If it has open Sub-to-dos, `remaining` says whether to
     * complete or cancel them too.
     */
    complete(id: string, opts: FinishOptions = {}): void {
      finishWithChildren(id, "completed", opts);
    },

    /** Cancels a To-do, with the same choice for its open Sub-to-dos. */
    cancel(id: string, opts: FinishOptions = {}): void {
      finishWithChildren(id, "cancelled", opts);
    },

    /** How many active Sub-to-dos a To-do still has. */
    openSubToDoCount(id: string): number {
      return openSubToDosOf(id).length;
    },

    /** Makes a Completed or Cancelled To-do active again, in its original place. */
    reopen(id: string): void {
      reopenOccurrence(ctx, id);
      ctx.update("toDos", id, { outcome: "active", finishedAt: null, loggedAt: null });
      // An open To-do brings its archived Heading back to the Project.
      const heading = ctx.find("headings", ctx.require("toDos", id).headingId);
      if (heading?.archivedAt) ctx.update("headings", heading.id, { archivedAt: null });
    },

    /** How many active To-dos a Project still has. */
    openToDoCount(projectId: string): number {
      return openToDosOf(projectId).length;
    },

    /**
     * Completes a Project. If it still has open To-dos, `remaining` says whether to
     * complete or cancel them.
     */
    completeProject(id: string, opts: FinishOptions = {}): void {
      finishProject(id, "completed", opts);
    },

    /** Cancels a Project, with the same choice for its open To-dos. */
    cancelProject(id: string, opts: FinishOptions = {}): void {
      finishProject(id, "cancelled", opts);
    },

    /** Makes a finished Project active again. Its To-dos keep their own outcomes. */
    reopenProject(id: string): void {
      ctx.update("projects", id, { outcome: "active", finishedAt: null, loggedAt: null });
    },

    setLogbookMode(mode: LogbookMode): void {
      // Whatever has reached the Logbook under the old mode stays there.
      stampLogged((finishable) => ctx.isInLogbook(finishable));
      store.saveSettings({ ...store.settings(), logbookMode: mode });
    },

    logbookMode(): LogbookMode {
      return store.settings().logbookMode;
    },

    /** Moves every finished To-do and Project to the Logbook now. */
    moveFinishedToLogbook(): void {
      stampLogged((finishable) => finishable.outcome !== "active");
    },

    /** Whether there are finished items still waiting to move to the Logbook. */
    hasFinishedOutsideLogbook(): boolean {
      const waiting = (finishable: Finishable) =>
        finishable.outcome !== "active" && !ctx.isInLogbook(finishable);
      return (
        store.all("toDos").some((t) => !ctx.isTrashed(t) && waiting(t)) ||
        store.all("projects").some((p) => !p.deletedAt && waiting(p))
      );
    },

    /** The Logbook: finished items grouped by the day they were finished, newest first. */
    logbook(): LogbookDay[] {
      const finished: { at: string; entry: LogbookEntry }[] = [
        ...store
          .all("toDos")
          .filter((t) => !ctx.isTrashed(t) && ctx.isInLogbook(t))
          .map((t) => ({
            at: t.finishedAt ?? t.updatedAt,
            entry: { kind: "toDo" as const, ...ctx.entry(t) },
          })),
        ...store
          .all("projects")
          .filter((p) => !p.deletedAt && ctx.isInLogbook(p))
          .map((p) => ({
            at: p.finishedAt ?? p.updatedAt,
            entry: { kind: "project" as const, project: p },
          })),
      ];
      finished.sort((a, b) => b.at.localeCompare(a.at));
      const days: LogbookDay[] = [];
      for (const { at, entry } of finished) {
        const date = toLocalDate(new Date(at));
        let day = days[days.length - 1];
        if (!day || day.date !== date) {
          day = { date, entries: [] };
          days.push(day);
        }
        day.entries.push(entry);
      }
      return days;
    },
  };
}
