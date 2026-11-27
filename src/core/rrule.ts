import { addDays, daysBetween, startOfWeek, weekday } from "./dates";
import type { LocalDate } from "./types";

/**
 * A hand-written subset of iCalendar RRULE (RFC 5545) for date-only rules: FREQ
 * (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY (plain weekdays), BYMONTHDAY
 * (1 to 31, or -1 for the last day) and WKST=MO. The rule's start (DTSTART) is kept
 * beside it as a LocalDate. Anything else is refused when parsing.
 */

export const frequencies = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof frequencies)[number];

/** RRULE's weekday codes, Monday first (WKST=MO). */
export const weekdayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof weekdayCodes)[number];

/** BYMONTHDAY's value for the last day of the month. */
export const lastDayOfMonth = -1;

/** The parts of a rule, named after RRULE's. */
export interface RepeatPattern {
  freq: Frequency;
  /** Every N days, weeks, months or years. */
  interval: number;
  /** Weekly only: the weekdays. Empty means the start date's weekday. */
  byDay?: WeekdayCode[];
  /** Monthly only: days of the month, or -1 for the last day. Empty means the start date's day. */
  byMonthDay?: number[];
}

/** The largest INTERVAL the subset accepts. */
export const maxInterval = 999;

function isValidMonthDay(day: number): boolean {
  return Number.isInteger(day) && ((day >= 1 && day <= 31) || day === lastDayOfMonth);
}

/** Throws if a pattern is outside the subset. */
export function checkPattern(p: RepeatPattern): void {
  if (!frequencies.includes(p.freq)) throw new Error(`Unknown frequency ${p.freq}`);
  if (!Number.isInteger(p.interval) || p.interval < 1 || p.interval > maxInterval) {
    throw new Error(`The interval must be a whole number from 1 to ${maxInterval}`);
  }
  const byDay = p.byDay ?? [];
  const byMonthDay = p.byMonthDay ?? [];
  if (byDay.length && p.freq !== "weekly") throw new Error("Weekdays need a weekly rule");
  if (byMonthDay.length && p.freq !== "monthly")
    throw new Error("Days of the month need a monthly rule");
  for (const d of byDay) if (!weekdayCodes.includes(d)) throw new Error(`Unknown weekday ${d}`);
  for (const d of byMonthDay) if (!isValidMonthDay(d)) throw new Error(`No day of the month ${d}`);
}

/** Writes a pattern as an RRULE value, e.g. "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;WKST=MO". */
export function formatRrule(p: RepeatPattern): string {
  checkPattern(p);
  const parts = [`FREQ=${p.freq.toUpperCase()}`, `INTERVAL=${p.interval}`];
  const byDay = weekdayCodes.filter((d) => p.byDay?.includes(d));
  if (byDay.length) parts.push(`BYDAY=${byDay.join(",")}`);
  const byMonthDay = [...new Set(p.byMonthDay ?? [])].sort((a, b) => a - b);
  if (byMonthDay.length) parts.push(`BYMONTHDAY=${byMonthDay.join(",")}`);
  parts.push("WKST=MO");
  return parts.join(";");
}

/** Reads an RRULE value written in the subset; anything else is refused. */
export function parseRrule(rrule: string): RepeatPattern {
  const fields = new Map<string, string>();
  for (const part of rrule.replace(/^RRULE:/, "").split(";")) {
    const [key, value, ...rest] = part.split("=");
    if (!key || value === undefined || rest.length || fields.has(key)) {
      throw new Error(`Can't read the rule part "${part}"`);
    }
    fields.set(key, value);
  }
  const freq = fields.get("FREQ")?.toLowerCase() as Frequency | undefined;
  if (!freq || !frequencies.includes(freq)) throw new Error("A rule needs a FREQ we support");
  const pattern: RepeatPattern = { freq, interval: 1 };
  for (const [key, value] of fields) {
    switch (key) {
      case "FREQ":
        break;
      case "INTERVAL":
        if (!/^\d+$/.test(value)) throw new Error(`Bad INTERVAL ${value}`);
        pattern.interval = Number(value);
        break;
      case "BYDAY":
        pattern.byDay = value.split(",") as WeekdayCode[];
        break;
      case "BYMONTHDAY":
        if (!value.split(",").every((d) => /^-?\d+$/.test(d))) {
          throw new Error(`Bad BYMONTHDAY ${value}`);
        }
        pattern.byMonthDay = value.split(",").map(Number);
        break;
      case "WKST":
        if (value !== "MO") throw new Error("Only WKST=MO is supported");
        break;
      default:
        throw new Error(`The rule part ${key} isn't supported`);
    }
  }
  checkPattern(pattern);
  return pattern;
}

function ymd(date: LocalDate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whether `date` is one of the rule's dates, for a rule starting on `start`. */
function matches(p: RepeatPattern, start: LocalDate, date: LocalDate): boolean {
  if (date < start) return false;
  const [sy, sm, sd] = ymd(start);
  const [y, m, d] = ymd(date);
  switch (p.freq) {
    case "daily":
      return daysBetween(start, date) % p.interval === 0;
    case "weekly": {
      const weeks = daysBetween(startOfWeek(start), startOfWeek(date)) / 7;
      const days = p.byDay?.length ? p.byDay : [weekdayCodes[weekday(start)]];
      return weeks % p.interval === 0 && days.includes(weekdayCodes[weekday(date)]);
    }
    case "monthly": {
      const months = (y - sy) * 12 + (m - sm);
      const length = daysInMonth(y, m);
      // A negative day counts back from the month's end; a day the month lacks is skipped.
      const days = (p.byMonthDay?.length ? p.byMonthDay : [sd]).map((n) =>
        n < 0 ? length + 1 + n : n,
      );
      return months % p.interval === 0 && days.includes(d);
    }
    case "yearly":
      // On the start's month and day; 29 February skips years without one.
      return (y - sy) % p.interval === 0 && m === sm && d === sd;
  }
}

/** How far ahead to look for a rule's next date before giving up. */
function horizonDays(p: RepeatPattern): number {
  const period = { daily: 1, weekly: 7, monthly: 31, yearly: 366 }[p.freq];
  // Eight periods covers the rarest case: 29 February, every year (2096 to 2104).
  return period * p.interval * 8 + 366;
}

/**
 * The rule's dates after `after`, in order, for a rule starting on `start`. It ends
 * if no date is found within a few periods; later rules (COUNT, UNTIL) can end sooner.
 */
export function* repeatDates(
  p: RepeatPattern,
  start: LocalDate,
  after: LocalDate,
): Generator<LocalDate> {
  let date = addDays(after < start ? addDays(start, -1) : after, 1);
  let gap = 0;
  const horizon = horizonDays(p);
  while (gap <= horizon) {
    if (matches(p, start, date)) {
      yield date;
      gap = 0;
    } else gap++;
    date = addDays(date, 1);
  }
}

/** The rule's first date after `after`, or null if there is none. */
export function nextRepeatDate(
  p: RepeatPattern,
  start: LocalDate,
  after: LocalDate,
): LocalDate | null {
  for (const date of repeatDates(p, start, after)) return date;
  return null;
}
