/** A calendar day in the user's time zone, written as YYYY-MM-DD. */
export type LocalDate = string;

/** A moment in time, written as an ISO 8601 string. */
export type Moment = string;

export type Outcome = "active" | "completed" | "cancelled";

export type LogbookMode = "immediately" | "endOfDay" | "manually";

/** Fields every record carries, so sync and sharing can be added later (ADR 0002). */
export interface RecordMeta {
  id: string;
  /** The user the record belongs to. */
  owner: string;
  createdAt: Moment;
  updatedAt: Moment;
}

export interface Area extends RecordMeta {
  title: string;
}

export interface Project extends RecordMeta {
  title: string;
  areaId: string | null;
  outcome: Outcome;
  /** When the Project was Completed or Cancelled. */
  finishedAt: Moment | null;
  /** Set once the Project has moved to the Logbook. */
  loggedAt: Moment | null;
  startDate: LocalDate | null;
  someday: boolean;
  deadline: LocalDate | null;
  deletedAt: Moment | null;
}

export interface ToDo extends RecordMeta {
  title: string;
  outcome: Outcome;
  /** When the To-do was Completed or Cancelled. */
  finishedAt: Moment | null;
  /** Set once the To-do has moved to the Logbook. */
  loggedAt: Moment | null;
  startDate: LocalDate | null;
  evening: boolean;
  someday: boolean;
  deadline: LocalDate | null;
  areaId: string | null;
  projectId: string | null;
  headingId: string | null;
  /** The parent To-do of a Sub-to-do. */
  parentId: string | null;
  deletedAt: Moment | null;
}

export interface Settings {
  logbookMode: LogbookMode;
}
