import { toLocalDate, type LocalDate, type Moment, type RestoreProblem } from "../core";
import { dateParts, longMonthName } from "./format";

/** The JSON export's file name, e.g. "mythings-2026-11-27.json". */
export function exportFileName(today: LocalDate): string {
  return `mythings-${today}.json`;
}

/** The CSV of To-dos' file name, e.g. "mythings-todos-2026-11-27.csv". */
export function csvFileName(today: LocalDate): string {
  return `mythings-todos-${today}.csv`;
}

/** When an export was made, as "27 November 2026" in local time. */
export function exportDateText(exportedAt: Moment): string {
  const { y, m, d } = dateParts(toLocalDate(new Date(exportedAt)));
  return `${d} ${longMonthName(m)} ${y}`;
}

/** What to tell the user when a file can't be restored. */
export function restoreProblemText(problem: RestoreProblem): string {
  return problem === "newerVersion"
    ? "This export is from a newer version of MyThings"
    : "This isn't a MyThings export";
}
