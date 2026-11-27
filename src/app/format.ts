import {
  addDays,
  daysBetween,
  type Energy,
  type LocalDate,
  type Priority,
  type ToDo,
} from "../core";
import type { IconName } from "./components/Icon";

/** Names for each Priority, as the pickers show them. */
export const priorityNames: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** The badge for a set Priority: ! low, !! medium, !!! high. */
export const priorityMarks: Record<Exclude<Priority, "none">, string> = {
  low: "!",
  medium: "!!",
  high: "!!!",
};

/** What a row and the detail show for a set Energy. */
export const energyNames: Record<Energy, string> = {
  high: "High energy",
  low: "Low energy",
};

/** The icon shown before a set Energy's name, if any. */
export const energyIcons: Record<Energy, IconName | undefined> = {
  high: "energy",
  low: undefined,
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dateParts(date: LocalDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** "Fri 27 Nov", or "Today"/"Tomorrow"/"Yesterday" when close. */
export function formatDate(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const { y, m, d } = dateParts(date);
  const weekday = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = dateParts(today).y === y ? "" : ` ${y}`;
  return `${weekday} ${d} ${months[m - 1]}${year}`;
}

export function monthName(m: number): string {
  return months[m - 1];
}

export function formatMonth(date: LocalDate): string {
  const { y, m } = dateParts(date);
  return `${monthName(m)} ${y}`;
}

/** "27 Nov – 3 Dec" */
export function formatRange(start: LocalDate, days: number): string {
  const a = dateParts(start);
  const b = dateParts(addDays(start, days - 1));
  return `${a.d} ${monthName(a.m)} – ${b.d} ${monthName(b.m)}`;
}

/** What "When" shows for a To-do or Project. */
export function whenText(
  toDo: Pick<ToDo, "someday" | "startDate"> & { evening?: boolean },
  today: string,
): string {
  if (toDo.someday) return "Someday";
  if (!toDo.startDate) return "No Start date";
  if (toDo.startDate <= today) return toDo.evening ? "This Evening" : "Today";
  return formatDate(toDo.startDate, today);
}

/** The icon shown beside whenText, if any. */
export function whenIcon(
  toDo: Pick<ToDo, "someday" | "startDate"> & { evening?: boolean },
  today: string,
): IconName | undefined {
  if (toDo.someday) return "someday";
  if (!toDo.startDate || toDo.startDate > today) return undefined;
  return toDo.evening ? "evening" : "today";
}

/** "14:05", from minutes after 00:00 (24:00 for the end of the day). */
export function formatTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * A To-do's Time slot, such as "14:00–14:30". With `withDay`, a slot on another day
 * than today starts with that day, as in "Yesterday 14:00–14:30".
 */
export function timeSlotText(
  toDo: Pick<ToDo, "startDate" | "timeSlot">,
  today: LocalDate,
  withDay = true,
): string | null {
  if (!toDo.timeSlot) return null;
  const times = `${formatTime(toDo.timeSlot.start)}–${formatTime(toDo.timeSlot.end)}`;
  if (!withDay || !toDo.startDate || toDo.startDate === today) return times;
  return `${formatDate(toDo.startDate, today)} ${times}`;
}
