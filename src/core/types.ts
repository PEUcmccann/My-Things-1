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

/** Where an item sits in its list, lowest first. Positions only matter relative to each other. */
export interface Ordered {
  position: number;
}

export interface Area extends RecordMeta, Ordered {
  title: string;
  tagIds: string[];
}

/** A Tag, which can be nested under a parent Tag. */
export interface Tag extends RecordMeta {
  title: string;
  parentId: string | null;
}

export interface Project extends RecordMeta, Ordered {
  title: string;
  areaId: string | null;
  outcome: Outcome;
  /** When the Project was Completed or Cancelled. */
  finishedAt: Moment | null;
  /** Set once the Project has moved to the Logbook. */
  loggedAt: Moment | null;
  /** Notes in Markdown. */
  notes: string;
  tagIds: string[];
  startDate: LocalDate | null;
  someday: boolean;
  deadline: LocalDate | null;
  deletedAt: Moment | null;
}

/** A named section of a Project. */
export interface Heading extends RecordMeta, Ordered {
  projectId: string;
  title: string;
  /** Set once the Heading is archived: it and its To-dos leave the Project screen. */
  archivedAt: Moment | null;
}

/**
 * A start and end time on a To-do's Start date, in whole minutes from 00:00. The end
 * is after the start and no later than 24:00 (1440), so a slot never crosses midnight.
 */
export interface TimeSlot {
  start: number;
  end: number;
}

export interface ToDo extends RecordMeta, Ordered {
  /** Order within Today, which has its own order. Falls back to `position`. */
  todayPosition: number | null;
  title: string;
  /** Notes in Markdown. */
  notes: string;
  tagIds: string[];
  outcome: Outcome;
  /** When the To-do was Completed or Cancelled. */
  finishedAt: Moment | null;
  /** Set once the To-do has moved to the Logbook. */
  loggedAt: Moment | null;
  startDate: LocalDate | null;
  evening: boolean;
  someday: boolean;
  deadline: LocalDate | null;
  /** At most one, on the Start date; there is none without a Start date. */
  timeSlot: TimeSlot | null;
  areaId: string | null;
  projectId: string | null;
  headingId: string | null;
  /** The parent To-do of a Sub-to-do. */
  parentId: string | null;
  deletedAt: Moment | null;
  priority: Priority;
  /** Not set when null. */
  energy: Energy | null;
  /** Minutes, a whole positive number. Not set when null. */
  estimate: number | null;
}

/** How important a To-do is. "none" is the default. */
export const priorities = ["none", "low", "medium", "high"] as const;
export type Priority = (typeof priorities)[number];

/** How much focus a To-do needs. */
export const energies = ["low", "high"] as const;
export type Energy = (typeof energies)[number];

/** A small step inside a To-do that can only be ticked off. */
export interface ChecklistItem extends RecordMeta {
  toDoId: string;
  title: string;
  ticked: boolean;
  /** Order within the To-do's Checklist, lowest first. */
  position: number;
}

/** The accent colours to choose from. Teal is the default. */
export const accentColours = ["teal", "blue", "indigo", "orange", "rose", "green"] as const;
export type AccentColour = (typeof accentColours)[number];

export interface Settings {
  logbookMode: LogbookMode;
  accentColour: AccentColour;
}
