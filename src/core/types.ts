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

/**
 * A range of days a Smart List's Start date or Deadline filter picks, worked out from
 * today so a saved list stays useful as the days pass. "thisWeek" runs Monday to
 * Sunday; "next7Days" is today and the 6 days after.
 */
export const dateRanges = [
  "todayOrEarlier",
  "today",
  "tomorrow",
  "thisWeek",
  "next7Days",
  "thisMonth",
  "hasDate",
  "noDate",
] as const;
export type DateRange = (typeof dateRanges)[number];

/** A choice in a Smart List's Estimate filter. */
export type EstimateChoice =
  { kind: "upTo"; minutes: number } | { kind: "moreThan"; minutes: number } | { kind: "notSet" };

/** An Area or Project a Smart List picks: one kind of filter, so they combine with OR. */
export interface ContainerRef {
  kind: "area" | "project";
  id: string;
}

/**
 * What a Smart List matches. Each kind left empty matches everything; values of one
 * kind combine with OR, and the kinds combine with AND.
 */
export interface SmartListFilters {
  tagIds: string[];
  containers: ContainerRef[];
  startDate: DateRange[];
  deadline: DateRange[];
  priority: Priority[];
  /** null picks To-dos with no Energy set. */
  energy: (Energy | null)[];
  estimate: EstimateChoice[];
}

/** A saved, named combination of filters, shown in the sidebar. */
export interface SmartList extends RecordMeta {
  title: string;
  filters: SmartListFilters;
}

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
