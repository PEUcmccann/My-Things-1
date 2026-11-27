import type { LocalDate } from "./types";

function parse(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** The day `days` after `date` (or before, if negative). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const next = parse(date);
  next.setUTCDate(next.getUTCDate() + days);
  return format(next);
}

/**
 * The same day `months` months after `date`, or that month's last day if the day doesn't
 * exist there (31 January plus one month is 28 or 29 February).
 */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

/** Whether year, month (1 to 12) and day make a real date. */
export function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Day of the week, 0 = Monday … 6 = Sunday. */
export function weekday(date: LocalDate): number {
  return (parse(date).getUTCDay() + 6) % 7;
}

/** The Monday on or before `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekday(date));
}

/** The first day of `date`'s month. */
export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** How many days ahead a Deadline counts as close. */
export const deadlineSoonDays = 3;

export type DeadlineFlag = "overdue" | "soon" | null;

/**
 * The warning shown next to a Deadline: "overdue" once it has passed, "soon" from
 * three days before it up to the day itself, otherwise none.
 */
export function deadlineFlag(deadline: LocalDate | null, today: LocalDate): DeadlineFlag {
  if (!deadline) return null;
  if (deadline < today) return "overdue";
  if (daysBetween(today, deadline) <= deadlineSoonDays) return "soon";
  return null;
}
