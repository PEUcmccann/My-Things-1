import {
  addDays,
  daysBetween,
  weekday,
  weekdayCodes,
  type Energy,
  type LocalDate,
  type Priority,
  type RepeatPattern,
  type ToDo,
  type WeekdayCode,
} from "../core";

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
  high: "⚡ High energy",
  low: "Low energy",
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
  if (toDo.someday) return "📦 Someday";
  if (!toDo.startDate) return "No Start date";
  if (toDo.startDate <= today) return toDo.evening ? "🌙 This Evening" : "☀️ Today";
  return formatDate(toDo.startDate, today);
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

/** Short weekday names, Monday first, as RRULE orders them. */
export const weekdayNames: Record<WeekdayCode, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

/** "1st", "2nd", "3rd", "11th", "22nd"… */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? "th"}`;
}

const units = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;

/** A Repeat rule in words, e.g. "Every 2 weeks on Mon, Thu", for a rule starting on `start`. */
export function repeatText(p: RepeatPattern, start: LocalDate): string {
  const unit = units[p.freq];
  const every = p.interval === 1 ? `Every ${unit}` : `Every ${p.interval} ${unit}s`;
  const { m, d } = dateParts(start);
  switch (p.freq) {
    case "daily":
      return every;
    case "weekly": {
      const codes = p.byDay?.length ? p.byDay : [weekdayCodes[weekday(start)]];
      const sorted = weekdayCodes.filter((c) => codes.includes(c));
      return `${every} on ${sorted.map((c) => weekdayNames[c]).join(", ")}`;
    }
    case "monthly": {
      const monthDays = [...(p.byMonthDay?.length ? p.byMonthDay : [d])];
      // The last day reads last.
      monthDays.sort((a, b) => (a < 0 ? 99 : a) - (b < 0 ? 99 : b));
      const names = monthDays.map((n) => (n === -1 ? "last day" : ordinal(n)));
      return `${every} on the ${names.join(", ")}`;
    }
    case "yearly":
      return `${every} on ${d} ${monthName(m)}`;
  }
}
