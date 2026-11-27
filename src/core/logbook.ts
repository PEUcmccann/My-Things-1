import { toLocalDate } from "./clock";
import type { Context, ToDoEntry } from "./context";
import type { LocalDate, LogbookMode } from "./types";

export type LogbookEntry = { kind: "toDo" } & ToDoEntry;

export interface LogbookDay {
  date: LocalDate;
  entries: LogbookEntry[];
}

export function logbookActions(ctx: Context) {
  const { store } = ctx;

  function finish(id: string, outcome: "completed" | "cancelled"): void {
    const now = ctx.now();
    const logNow = store.settings().logbookMode === "immediately";
    ctx.update("toDos", id, { outcome, finishedAt: now, loggedAt: logNow ? now : null });
  }

  return {
    complete(id: string): void {
      finish(id, "completed");
    },

    cancel(id: string): void {
      finish(id, "cancelled");
    },

    /** Makes a Completed or Cancelled To-do active again, in its original place. */
    reopen(id: string): void {
      ctx.update("toDos", id, { outcome: "active", finishedAt: null, loggedAt: null });
    },

    setLogbookMode(mode: LogbookMode): void {
      // Whatever has reached the Logbook under the old mode stays there.
      const now = ctx.now();
      for (const item of store.all("toDos")) {
        if (!item.loggedAt && ctx.isInLogbook(item)) {
          ctx.update("toDos", item.id, { loggedAt: now });
        }
      }
      store.saveSettings({ ...store.settings(), logbookMode: mode });
    },

    logbookMode(): LogbookMode {
      return store.settings().logbookMode;
    },

    /** Moves every finished To-do to the Logbook now, as in the "manually" mode. */
    moveFinishedToLogbook(): void {
      const now = ctx.now();
      for (const item of store.all("toDos")) {
        if (item.outcome !== "active" && !item.loggedAt) {
          ctx.update("toDos", item.id, { loggedAt: now });
        }
      }
    },

    /** Whether there are finished To-dos still waiting to move to the Logbook. */
    hasFinishedOutsideLogbook(): boolean {
      return store
        .all("toDos")
        .some((item) => !item.deletedAt && item.outcome !== "active" && !ctx.isInLogbook(item));
    },

    /** The Logbook: finished To-dos grouped by the day they were finished, newest first. */
    logbook(): LogbookDay[] {
      const finished = store
        .all("toDos")
        .filter((item) => !item.deletedAt && ctx.isInLogbook(item))
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
      const days: LogbookDay[] = [];
      for (const item of finished) {
        const date = toLocalDate(new Date(item.finishedAt ?? item.updatedAt));
        let day = days[days.length - 1];
        if (!day || day.date !== date) {
          day = { date, entries: [] };
          days.push(day);
        }
        day.entries.push({ kind: "toDo", ...ctx.entry(item) });
      }
      return days;
    },
  };
}
