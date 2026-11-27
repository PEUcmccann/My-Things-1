import type { Clock } from "./clock";
import { checklistActions } from "./checklist";
import { containerActions } from "./containers";
import { createContext } from "./context";
import { addDays, deadlineFlag, type DeadlineFlag } from "./dates";
import { headingActions } from "./headings";
import { listQueries } from "./lists";
import { logbookActions } from "./logbook";
import type { Store } from "./store";
import { toDoActions } from "./toDos";
import { trashActions } from "./trash";
import type { LocalDate } from "./types";

export type { ChecklistProgress } from "./checklist";
export type { ToDoEntry } from "./context";
export type { AreaContents, NewProject, Progress, SidebarArea, SidebarTree } from "./containers";
export type { ProjectList, TodayList, UpcomingEntry, UpcomingGroup, UpcomingReason } from "./lists";
export type { FinishOptions, LogbookDay, LogbookEntry, Remaining } from "./logbook";
export type { Destination, NewToDo, When } from "./toDos";
export type { TrashEntry } from "./trash";
export type { HeadingSection, ProjectContents } from "./headings";

export interface Options {
  clock: Clock;
  store: Store;
  newId?: () => string;
  /** The user who owns new records. There is one user for now; sharing comes later. */
  owner?: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const localOwner = "me";

/** The core of MyThings: every rule, as actions and list queries. */
export function createMyThings({ clock, store, newId = randomId, owner = localOwner }: Options) {
  const ctx = createContext({ clock, store, newId, owner });
  return {
    ...toDoActions(ctx),
    ...containerActions(ctx),
    ...headingActions(ctx),
    ...checklistActions(ctx),
    ...logbookActions(ctx),
    ...listQueries(ctx),
    ...trashActions(ctx),

    /** Whether to flag a Deadline as close or passed, as of today. */
    deadlineFlag(deadline: LocalDate | null): DeadlineFlag {
      return deadlineFlag(deadline, clock.today());
    },

    /** Tomorrow's date, for the "When" picker. */
    tomorrow(): LocalDate {
      return addDays(clock.today(), 1);
    },

    /** Today's date, from the core's clock. */
    currentDate(): LocalDate {
      return clock.today();
    },
  };
}

export type MyThings = ReturnType<typeof createMyThings>;
