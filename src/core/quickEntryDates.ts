import { addDays, addMonths, isRealDate, localDate, weekday, ymd } from "./dates";
import type { QuickEntryValue, Recogniser } from "./quickEntry";
import type { LocalDate } from "./types";

type Phrase = { words: number; value: QuickEntryValue } | null;

const onDate = (date: LocalDate): QuickEntryValue => ({
  kind: "when",
  when: { kind: "date", date },
});

/** Words for days relative to today. */
const relativeDays: Record<string, number> = { today: 0, tomorrow: 1, tom: 1 };

/** Weekday names in full and as three letters, plus "tues" and "thurs"; 0 = Monday. */
const weekdayNames: Record<string, number> = {};
["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach(
  (name, day) => {
    weekdayNames[name] = day;
    weekdayNames[name.slice(0, 3)] = day;
  },
);
weekdayNames.tues = 1;
weekdayNames.thurs = 3;

/** The next such weekday after today: 1 to 7 days on, so today's weekday is a week away. */
function nextWeekday(today: LocalDate, day: number): LocalDate {
  return addDays(today, ((day - weekday(today) + 6) % 7) + 1);
}

const lower = (words: string[], index: number) => words[index]?.toLowerCase();

/** "fri", "friday" or "next fri" (the same day). */
function weekdayPhrase(words: string[], index: number, today: LocalDate): Phrase {
  const hasNext = lower(words, index) === "next";
  const name = lower(words, index + (hasNext ? 1 : 0));
  if (name === undefined || !Object.hasOwn(weekdayNames, name)) return null;
  return { words: hasNext ? 2 : 1, value: onDate(nextWeekday(today, weekdayNames[name])) };
}

const units: Record<string, (today: LocalDate, n: number) => LocalDate> = {
  day: (today, n) => addDays(today, n),
  week: (today, n) => addDays(today, 7 * n),
  month: (today, n) => addMonths(today, n),
};

/** "in 3 days", "in 1 week", "in 2 months". */
function inPhrase(words: string[], index: number, today: LocalDate): Phrase {
  if (lower(words, index) !== "in") return null;
  const n = /^\d+$/.test(words[index + 1] ?? "") ? Number(words[index + 1]) : 0;
  const unit = lower(words, index + 2)?.replace(/s$/, "");
  if (n < 1 || unit === undefined || !Object.hasOwn(units, unit)) return null;
  return { words: 3, value: onDate(units[unit](today, n)) };
}

/** Month names in full and as three letters, plus "sept"; 1 = January. */
const monthNames: Record<string, number> = { sept: 9 };
[
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
].forEach((name, i) => {
  monthNames[name] = i + 1;
  monthNames[name.slice(0, 3)] = i + 1;
});

const monthOf = (word: string | undefined) =>
  word !== undefined && Object.hasOwn(monthNames, word) ? monthNames[word] : null;
const dayOf = (word: string | undefined) =>
  word !== undefined && /^\d{1,2}$/.test(word) ? Number(word) : null;

/** A day and month on or after today: this year's, or next year's once it has passed. */
function nextDayMonth(today: LocalDate, month: number, day: number): LocalDate | null {
  const [year] = ymd(today);
  const y = localDate(year, month, day) < today ? year + 1 : year;
  return isRealDate(y, month, day) ? localDate(y, month, day) : null;
}

/** "12 Dec", "12 December", "Dec 12", "December 12", or ISO "2026-12-12". */
function calendarDate(words: string[], index: number, today: LocalDate): Phrase {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(words[index]);
  if (iso) {
    const [y, m, d] = iso.slice(1).map(Number);
    return isRealDate(y, m, d) ? { words: 1, value: onDate(words[index]) } : null;
  }
  const first = lower(words, index);
  const second = lower(words, index + 1);
  const dayFirst = dayOf(first) !== null && monthOf(second) !== null;
  const monthFirst = monthOf(first) !== null && dayOf(second) !== null;
  if (!dayFirst && !monthFirst) return null;
  const date = dayFirst
    ? nextDayMonth(today, monthOf(second)!, dayOf(first)!)
    : nextDayMonth(today, monthOf(first)!, dayOf(second)!);
  return date ? { words: 2, value: onDate(date) } : null;
}

/** A weekday or calendar date, the phrases a preceding "on" can go with. */
const dayPhrase = (words: string[], index: number, today: LocalDate): Phrase =>
  weekdayPhrase(words, index, today) ?? calendarDate(words, index, today);

const thisEvening: QuickEntryValue = { kind: "when", when: { kind: "thisEvening" } };
const someday: QuickEntryValue = { kind: "when", when: { kind: "someday" } };

/**
 * Date phrases in quick entry, which set the Start date, This Evening or Someday: whole
 * words, any case, English only. A preceding "on" ("on fri", "on 12 Dec") goes with them.
 */
export const dateWords: Recogniser = (wordList, index, today) => {
  const words = wordList.map((w) => w.text);
  const word = lower(words, index);
  if (Object.hasOwn(relativeDays, word)) {
    return { words: 1, value: onDate(addDays(today, relativeDays[word])) };
  }
  if (word === "tonight") return { words: 1, value: thisEvening };
  if (word === "this" && lower(words, index + 1) === "evening") {
    return { words: 2, value: thisEvening };
  }
  if (word === "someday") return { words: 1, value: someday };
  if (word === "on") {
    const after = dayPhrase(words, index + 1, today);
    return after && { words: after.words + 1, value: after.value };
  }
  return inPhrase(words, index, today) ?? dayPhrase(words, index, today);
};
