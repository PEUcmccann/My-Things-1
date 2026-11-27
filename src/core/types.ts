/** A calendar day in the user's time zone, written as YYYY-MM-DD. */
export type LocalDate = string;

export type Outcome = "active" | "completed" | "cancelled";

export type LogbookMode = "immediately" | "endOfDay" | "manually";

export interface Area {
  id: string;
  title: string;
}

export interface Project {
  id: string;
  title: string;
  areaId: string | null;
  outcome: Outcome;
  startDate: LocalDate | null;
  someday: boolean;
  deadline: LocalDate | null;
  deletedAt: string | null;
}

export interface ToDo {
  id: string;
  title: string;
  outcome: Outcome;
  /** When the To-do was Completed or Cancelled. */
  finishedAt: string | null;
  /** Set once the To-do has moved to the Logbook. */
  loggedAt: string | null;
  startDate: LocalDate | null;
  evening: boolean;
  someday: boolean;
  deadline: LocalDate | null;
  areaId: string | null;
  projectId: string | null;
  headingId: string | null;
  /** The parent To-do of a Sub-to-do. */
  parentId: string | null;
  deletedAt: string | null;
}

export interface Settings {
  logbookMode: LogbookMode;
}
