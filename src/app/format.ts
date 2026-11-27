import {
  addDays,
  byDayParts,
  daysBetween,
  weekday,
  weekdayCodes,
  workdayCodes,
  type Energy,
  type LocalDate,
  type Priority,
  type RepeatMode,
  type RepeatPattern,
  type ToDo,
  type WeekdayCode,
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

/** Full weekday names, Monday first. */
export const weekdayLongNames: Record<WeekdayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

const longMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "January"…"December" for 1 to 12. */
export function longMonthName(m: number): string {
  return longMonths[m - 1];
}

/** An ordinal in words, as the picker offers them: "first"…"fifth", "last", "second-last"… */
export function nthWord(n: number): string {
  const words = ["first", "second", "third", "fourth", "fifth"];
  if (n === -1) return "last";
  return n > 0 ? (words[n - 1] ?? ordinal(n)) : `${words[-n - 1] ?? ordinal(-n)}-last`;
}

const units = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;

function sameDays(codes: WeekdayCode[], set: WeekdayCode[]): boolean {
  return codes.length === set.length && set.every((c) => codes.includes(c));
}

/** BYDAY (with BYSETPOS) in words, e.g. "the last weekday", "the first and third Monday". */
function byDayText(p: RepeatPattern): string {
  const parts = (p.byDay ?? []).map(byDayParts);
  if (p.bySetPos?.length) {
    const codes = parts.map((d) => d.code);
    const set = sameDays(codes, workdayCodes)
      ? "weekday"
      : sameDays(codes, ["SA", "SU"])
        ? "weekend day"
        : `day of ${weekdayCodes
            .filter((c) => codes.includes(c))
            .map((c) => weekdayNames[c])
            .join(", ")}`;
    return `the ${p.bySetPos.map(nthWord).join(" and ")} ${set}`;
  }
  // One group per weekday, Monday first: "first and third Monday", "every Tuesday".
  const groups = weekdayCodes.flatMap((code) => {
    const nths = parts.filter((d) => d.code === code).map((d) => d.nth);
    if (!nths.length) return [];
    if (nths.includes(null)) return [`every ${weekdayLongNames[code]}`];
    const words = (nths as number[]).map(nthWord);
    return [`${words.join(" and ")} ${weekdayLongNames[code]}`];
  });
  const text = groups.join(" and ");
  return parts.some((d) => d.nth !== null) && !text.startsWith("every") ? `the ${text}` : text;
}

/** BYMONTHDAY in words, e.g. "the 3rd, 22nd" or "the last day". */
function monthDaysText(days: number[]): string {
  // The last day reads last.
  const sorted = [...days].sort((a, b) => (a < 0 ? 99 : a) - (b < 0 ? 99 : b));
  return `the ${sorted.map((n) => (n === -1 ? "last day" : ordinal(n))).join(", ")}`;
}

/** How a rule ends, as a tail to its summary: ", 5 times", ", until 31 Jan 2027". */
function endText(p: RepeatPattern): string {
  if (p.count !== undefined) return p.count === 1 ? ", once" : `, ${p.count} times`;
  if (p.until !== undefined) {
    const { y, m, d } = dateParts(p.until);
    return `, until ${d} ${monthName(m)} ${y}`;
  }
  return "";
}

/** The part of a summary after "Every N units", e.g. " on the last weekday". */
function daysText(p: RepeatPattern, start: LocalDate): string {
  const { m, d } = dateParts(start);
  switch (p.freq) {
    case "daily":
      return "";
    case "weekly": {
      const codes = (p.byDay ?? []).map((v) => byDayParts(v).code);
      const days = codes.length ? codes : [weekdayCodes[weekday(start)]];
      const sorted = weekdayCodes.filter((c) => days.includes(c));
      return ` on ${sorted.map((c) => weekdayNames[c]).join(", ")}`;
    }
    case "monthly": {
      if (p.byDay?.length) return ` on ${byDayText(p)}`;
      return ` on ${monthDaysText(p.byMonthDay?.length ? p.byMonthDay : [d])}`;
    }
    case "yearly": {
      const months = p.byMonth?.length ? [...p.byMonth].sort((a, b) => a - b) : [m];
      const inMonths = months.map(longMonthName).join(" and ");
      if (p.byDay?.length) return ` on ${byDayText(p)} of ${inMonths}`;
      const days = p.byMonthDay?.length ? p.byMonthDay : [d];
      if (days.some((n) => n < 0)) return ` on ${monthDaysText(days)} of ${inMonths}`;
      const dates = months.flatMap((month) => days.map((day) => `${day} ${monthName(month)}`));
      return ` on ${dates.join(", ")}`;
    }
  }
}

/**
 * A Repeat rule in words, e.g. "Every 2 weeks on Mon, Thu", "Every month on the last
 * weekday, 5 times" or "Every 3 days after completion", for a rule starting on `start`.
 */
export function repeatText(
  p: RepeatPattern,
  start: LocalDate,
  mode: RepeatMode = "onSchedule",
): string {
  const unit = units[p.freq];
  const every = p.interval === 1 ? `Every ${unit}` : `Every ${p.interval} ${unit}s`;
  const days = mode === "afterCompletion" ? " after completion" : daysText(p, start);
  return `${every}${days}${endText(p)}`;
}
