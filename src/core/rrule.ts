import { addDays, addMonths, daysBetween, startOfWeek, weekday } from "./dates";
import type { LocalDate } from "./types";

/**
 * A hand-written subset of iCalendar RRULE (RFC 5545) for date-only rules, covering
 * what the repeat picker builds: FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL,
 * BYDAY (weekdays; in monthly and yearly rules also with an ordinal, e.g. 2TU or
 * -1FR), BYMONTHDAY (1 to 31, or -1 for the last day), BYMONTH (yearly), BYSETPOS
 * (which of the matching days in a month, e.g. -1 for the last), COUNT, UNTIL (a
 * date) and WKST=MO. The rule's start (DTSTART) is kept beside it as a LocalDate.
 * Anything else is refused when parsing.
 */

export const frequencies = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof frequencies)[number];

/** RRULE's weekday codes, Monday first (WKST=MO). */
export const weekdayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof weekdayCodes)[number];

/** The weekday codes of a weekday: Monday to Friday. */
export const workdayCodes: WeekdayCode[] = ["MO", "TU", "WE", "TH", "FR"];

/**
 * A BYDAY value: a weekday ("TU"), or the nth of that weekday in a month ("2TU" is
 * the second Tuesday, "-1FR" the last Friday).
 */
export type ByDay = WeekdayCode | `${number}${WeekdayCode}`;

/** BYMONTHDAY's value for the last day of the month. */
export const lastDayOfMonth = -1;

/** The parts of a rule, named after RRULE's. */
export interface RepeatPattern {
  freq: Frequency;
  /** Every N days, weeks, months or years. */
  interval: number;
  /**
   * Weekdays. Weekly: plain weekdays; empty means the start date's weekday. Monthly
   * and yearly: also with an ordinal, counted within the month.
   */
  byDay?: ByDay[];
  /** Monthly and yearly: days of the month, or -1 for the last day. */
  byMonthDay?: number[];
  /** Yearly only: the months, 1 to 12. Empty means the start date's month. */
  byMonth?: number[];
  /** With plain weekdays in a month: which of that month's matching days, e.g. -1 for the last. */
  bySetPos?: number[];
  /**
   * Ends the rule after this many occurrences. The core counts the occurrences the
   * series has created, not RRULE's dates.
   */
  count?: number;
  /** Ends the rule on this date: an occurrence may start on it, none after it. */
  until?: LocalDate;
}

/** The largest INTERVAL (and COUNT) the subset accepts. */
export const maxInterval = 999;

/** The furthest ordinal for a weekday in a month, either way. */
const maxNth = 5;

/** A BYDAY value's parts: the ordinal (null if none) and the weekday. */
export function byDayParts(value: ByDay): { nth: number | null; code: WeekdayCode } {
  const match = /^([+-]?\d+)?([A-Z]{2})$/.exec(value);
  const code = match?.[2] as WeekdayCode | undefined;
  if (!match || !code || !weekdayCodes.includes(code)) throw new Error(`Unknown weekday ${value}`);
  return { nth: match[1] === undefined ? null : Number(match[1]), code };
}

function isValidMonthDay(day: number): boolean {
  return Number.isInteger(day) && ((day >= 1 && day <= 31) || day === lastDayOfMonth);
}

function isWhole(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

/** Whether a pattern is a plain gap: FREQ and INTERVAL, with no parts that pick days. */
export function isGap(p: RepeatPattern): boolean {
  return !p.byDay?.length && !p.byMonthDay?.length && !p.byMonth?.length && !p.bySetPos?.length;
}

/** Throws if a pattern is outside the subset. */
export function checkPattern(p: RepeatPattern): void {
  if (!frequencies.includes(p.freq)) throw new Error(`Unknown frequency ${p.freq}`);
  if (!isWhole(p.interval, 1, maxInterval)) {
    throw new Error(`The interval must be a whole number from 1 to ${maxInterval}`);
  }
  const byDay = (p.byDay ?? []).map(byDayParts);
  const byMonthDay = p.byMonthDay ?? [];
  const byMonth = p.byMonth ?? [];
  const bySetPos = p.bySetPos ?? [];
  const inMonth = p.freq === "monthly" || p.freq === "yearly";
  if (byDay.length && !inMonth && p.freq !== "weekly") {
    throw new Error("Weekdays need a weekly, monthly or yearly rule");
  }
  for (const { nth } of byDay) {
    if (nth === null) continue;
    if (!inMonth) throw new Error("The nth weekday needs a monthly or yearly rule");
    if (nth === 0 || !isWhole(Math.abs(nth), 1, maxNth)) throw new Error(`No ${nth}th weekday`);
  }
  if (byMonthDay.length && !inMonth) throw new Error("Days of the month need a monthly rule");
  for (const d of byMonthDay) if (!isValidMonthDay(d)) throw new Error(`No day of the month ${d}`);
  if (byMonthDay.length && byDay.length) {
    throw new Error("Choose days of the month or weekdays, not both");
  }
  if (byMonth.length && p.freq !== "yearly") throw new Error("Months need a yearly rule");
  for (const m of byMonth) if (!isWhole(m, 1, 12)) throw new Error(`No month ${m}`);
  // Yearly days are counted within a month, so the month must be given, as RRULE reads it.
  if (p.freq === "yearly" && (byDay.length || byMonthDay.length) && !byMonth.length) {
    throw new Error("Days in a yearly rule need its month");
  }
  if (bySetPos.length) {
    if (!inMonth || !byDay.length || byDay.some((d) => d.nth !== null)) {
      throw new Error("A position needs plain weekdays in a monthly or yearly rule");
    }
    if (p.freq === "yearly" && byMonth.length !== 1) {
      throw new Error("A position in a yearly rule needs exactly one month");
    }
    for (const n of bySetPos) {
      if (n === 0 || !isWhole(Math.abs(n), 1, 31)) throw new Error(`No position ${n}`);
    }
  }
  if (p.count !== undefined && !isWhole(p.count, 1, maxInterval)) {
    throw new Error(`The count must be a whole number from 1 to ${maxInterval}`);
  }
  if (p.until !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.until)) {
    throw new Error(`Bad end date ${p.until}`);
  }
  if (p.count !== undefined && p.until !== undefined) {
    throw new Error("A rule ends after a number of times or on a date, not both");
  }
}

function sortedByDay(values: ByDay[]): ByDay[] {
  const key = (v: ByDay) => {
    const { nth, code } = byDayParts(v);
    // Plain first, then 1st to 5th, then last to 5th-last.
    const order = nth === null ? 0 : nth > 0 ? nth : 10 - nth;
    return weekdayCodes.indexOf(code) * 100 + order;
  };
  const normal = values.map((v) => {
    const { nth, code } = byDayParts(v);
    return (nth === null ? code : `${nth}${code}`) as ByDay;
  });
  return [...new Set(normal)].sort((a, b) => key(a) - key(b));
}

function sortedNumbers(values: number[] | undefined): number[] {
  return [...new Set(values ?? [])].sort((a, b) => a - b);
}

/**
 * Writes a pattern as an RRULE value, e.g. "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;WKST=MO".
 * A gap (a rule after completion) has no weeks to start, so it leaves out WKST.
 */
export function formatRrule(p: RepeatPattern, { gap = false }: { gap?: boolean } = {}): string {
  checkPattern(p);
  const parts = [`FREQ=${p.freq.toUpperCase()}`, `INTERVAL=${p.interval}`];
  const list = (key: string, values: (string | number)[]) => {
    if (values.length) parts.push(`${key}=${values.join(",")}`);
  };
  list("BYMONTH", sortedNumbers(p.byMonth));
  list("BYDAY", sortedByDay(p.byDay ?? []));
  list("BYMONTHDAY", sortedNumbers(p.byMonthDay));
  list("BYSETPOS", sortedNumbers(p.bySetPos));
  if (p.count !== undefined) parts.push(`COUNT=${p.count}`);
  if (p.until !== undefined) parts.push(`UNTIL=${p.until.replace(/-/g, "")}`);
  if (!gap) parts.push("WKST=MO");
  return parts.join(";");
}

function numbers(key: string, value: string): number[] {
  if (!value.split(",").every((d) => /^[+-]?\d+$/.test(d))) throw new Error(`Bad ${key} ${value}`);
  return value.split(",").map(Number);
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
        pattern.byDay = sortedByDay(value.split(",") as ByDay[]);
        break;
      case "BYMONTHDAY":
        pattern.byMonthDay = numbers(key, value);
        break;
      case "BYMONTH":
        pattern.byMonth = numbers(key, value);
        break;
      case "BYSETPOS":
        pattern.bySetPos = numbers(key, value);
        break;
      case "COUNT":
        if (!/^\d+$/.test(value)) throw new Error(`Bad COUNT ${value}`);
        pattern.count = Number(value);
        break;
      case "UNTIL": {
        const date = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
        if (!date) throw new Error(`Only a date UNTIL is supported, not ${value}`);
        pattern.until = `${date[1]}-${date[2]}-${date[3]}`;
        break;
      }
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

/** The `n`th item (1-based), or counting back from the end if negative. */
function nthOf<T>(items: T[], n: number): T | undefined {
  return n > 0 ? items[n - 1] : items[items.length + n];
}

/** The days of a month that are rule dates, before the interval is applied. */
function daysInMonthMatching(p: RepeatPattern, startDay: number, y: number, m: number): number[] {
  const length = daysInMonth(y, m);
  // A negative day counts back from the month's end; a day the month lacks is skipped.
  if (p.byMonthDay?.length) return p.byMonthDay.map((n) => (n < 0 ? length + 1 + n : n));
  if (!p.byDay?.length) return [startDay];
  const first = weekday(`${y}-${String(m).padStart(2, "0")}-01`);
  const daysOn = (code: WeekdayCode) => {
    const offset = (weekdayCodes.indexOf(code) - first + 7) % 7;
    const days: number[] = [];
    for (let d = 1 + offset; d <= length; d += 7) days.push(d);
    return days;
  };
  const days = new Set<number>();
  for (const value of p.byDay) {
    const { nth, code } = byDayParts(value);
    const all = daysOn(code);
    const picked = nth === null ? all : [nthOf(all, nth)];
    for (const d of picked) if (d !== undefined) days.add(d);
  }
  const sorted = [...days].sort((a, b) => a - b);
  if (!p.bySetPos?.length) return sorted;
  return p.bySetPos.map((n) => nthOf(sorted, n)).filter((d): d is number => d !== undefined);
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
      return months % p.interval === 0 && daysInMonthMatching(p, sd, y, m).includes(d);
    }
    case "yearly": {
      // In the start's month unless BYMONTH says otherwise; 29 February skips years without one.
      const months = p.byMonth?.length ? p.byMonth : [sm];
      return (
        (y - sy) % p.interval === 0 &&
        months.includes(m) &&
        daysInMonthMatching(p, sd, y, m).includes(d)
      );
    }
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
 * after UNTIL, or if no date is found within a few periods. COUNT is left to the
 * caller, which counts occurrences rather than dates.
 */
export function* repeatDates(
  p: RepeatPattern,
  start: LocalDate,
  after: LocalDate,
): Generator<LocalDate> {
  let date = addDays(after < start ? addDays(start, -1) : after, 1);
  let gap = 0;
  const horizon = horizonDays(p);
  while (gap <= horizon && (!p.until || date <= p.until)) {
    if (matches(p, start, date)) {
      yield date;
      gap = 0;
    } else gap++;
    date = addDays(date, 1);
  }
}

/**
 * The date one gap (INTERVAL × FREQ) after `date`, for a rule after completion, or
 * null once that is after UNTIL. A month or year gap from a day the target month
 * lacks lands on its last day.
 */
export function afterGap(p: RepeatPattern, date: LocalDate): LocalDate | null {
  const next = {
    daily: () => addDays(date, p.interval),
    weekly: () => addDays(date, 7 * p.interval),
    monthly: () => addMonths(date, p.interval),
    yearly: () => addMonths(date, 12 * p.interval),
  }[p.freq]();
  return p.until && next > p.until ? null : next;
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
