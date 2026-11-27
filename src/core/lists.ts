import { byCreation, type Context, type ToDoEntry } from "./context";
import type { LocalDate, ToDo } from "./types";

export interface TodayList {
  main: ToDoEntry[];
  thisEvening: ToDoEntry[];
}

function isDue(item: ToDo, today: LocalDate): boolean {
  const started = item.startDate !== null && item.startDate <= today;
  const deadlineReached = item.deadline !== null && item.deadline <= today;
  return started || deadlineReached;
}

export function listQueries(ctx: Context) {
  const { store, clock } = ctx;

  return {
    /**
     * Inbox: To-dos that have not been organised yet. Filing a To-do in an Area or
     * Project, giving it a Start date, or moving it to Someday all organise it.
     */
    inbox(): ToDoEntry[] {
      return store
        .all("toDos")
        .filter(
          (item) =>
            ctx.isOpenInLists(item) &&
            !item.areaId &&
            !item.projectId &&
            !item.startDate &&
            !item.someday,
        )
        .sort(byCreation)
        .map(ctx.entry);
    },

    /**
     * Today: every active To-do whose Start date or Deadline is today or earlier.
     * To-dos finished today stay visible until they move to the Logbook.
     */
    today(): TodayList {
      const today = clock.today();
      const list: TodayList = { main: [], thisEvening: [] };
      for (const item of store.all("toDos")) {
        if (!ctx.isOpenInLists(item)) continue;
        if (!isDue(item, today)) continue;
        (item.evening ? list.thisEvening : list.main).push(ctx.entry(item));
      }
      return list;
    },
  };
}
