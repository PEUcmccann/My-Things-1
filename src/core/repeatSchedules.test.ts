import { beforeEach, describe, expect, it } from "vitest";
import {
  createMyThings,
  memoryStore,
  type fixedClock,
  type MyThings,
  type RepeatPattern,
} from "./index";
import { setup } from "./testSetup";

// The fixed clock says Thursday 26 November 2026.
let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const workdays: RepeatPattern["byDay"] = ["MO", "TU", "WE", "TH", "FR"];
const lastWeekday: RepeatPattern = {
  freq: "monthly",
  interval: 1,
  byDay: workdays,
  bySetPos: [-1],
};

/** Completes the current occurrence and returns the next one's id, if any. */
function completeAndNext(id: string): string | undefined {
  app.complete(id);
  return app.currentOccurrence(id)?.id;
}

/**
 * The Start dates of up to `count` occurrences in a row, setting `pattern` on a
 * To-do that starts on `from` and completing each on its own day.
 */
function startDates(pattern: RepeatPattern, count: number, from = "2026-11-26"): string[] {
  let current: string | undefined = app.createToDo({
    title: "Chore",
    when: { kind: "date", date: from },
  });
  app.setRepeat(current, pattern);
  const dates: string[] = [];
  while (current && dates.length < count) {
    const date = app.getToDo(current).startDate!;
    dates.push(date);
    clock.set(`${date}T09:00:00`);
    current = completeAndNext(current);
  }
  return dates;
}

describe("unusual monthly patterns", () => {
  it("the last weekday of the month", () => {
    // Mon 30 Nov, Thu 31 Dec, Fri 29 Jan (31st is a Sunday), Fri 26 Feb, Wed 31 Mar.
    expect(startDates(lastWeekday, 5)).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-29",
      "2027-02-26",
      "2027-03-31",
    ]);
  });

  it("the first weekday of the month", () => {
    const pattern: RepeatPattern = { ...lastWeekday, bySetPos: [1] };
    // Tue 1 Dec, Fri 1 Jan, Mon 1 Feb, Mon 1 Mar; 1 May 2027 is a Saturday.
    expect(startDates(pattern, 6)).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
      "2027-04-01",
      "2027-05-03",
    ]);
  });

  it("every 2nd Tuesday", () => {
    expect(startDates({ freq: "monthly", interval: 1, byDay: ["2TU"] }, 4)).toEqual([
      "2026-12-08",
      "2027-01-12",
      "2027-02-09",
      "2027-03-09",
    ]);
  });

  it("the 2nd Tuesday of every other month counts months from the first date", () => {
    expect(startDates({ freq: "monthly", interval: 2, byDay: ["2TU"] }, 3)).toEqual([
      "2026-12-08",
      "2027-02-09",
      "2027-04-13",
    ]);
  });

  it("the last Friday, in months with four and with five Fridays", () => {
    // January 2027 has five Fridays (1st to 29th); February has four (5th to 26th).
    expect(startDates({ freq: "monthly", interval: 1, byDay: ["-1FR"] }, 3, "2027-01-01")).toEqual([
      "2027-01-29",
      "2027-02-26",
      "2027-03-26",
    ]);
  });

  it("the last Monday, in months with five and with four Mondays", () => {
    // November 2026 has five Mondays (2nd to 30th); December has four (7th to 28th).
    expect(startDates({ freq: "monthly", interval: 1, byDay: ["-1MO"] }, 2, "2026-11-02")).toEqual([
      "2026-11-30",
      "2026-12-28",
    ]);
  });
});

describe("weekly and yearly patterns", () => {
  it("every other Monday and Thursday", () => {
    expect(startDates({ freq: "weekly", interval: 2, byDay: ["TH", "MO"] }, 5)).toEqual([
      "2026-11-26",
      "2026-12-07",
      "2026-12-10",
      "2026-12-21",
      "2026-12-24",
    ]);
  });

  it("the first Monday of March each year", () => {
    const pattern: RepeatPattern = { freq: "yearly", interval: 1, byMonth: [3], byDay: ["1MO"] };
    expect(startDates(pattern, 3)).toEqual(["2027-03-01", "2028-03-06", "2029-03-05"]);
  });

  it("a month for a yearly rule, on the start's day", () => {
    expect(startDates({ freq: "yearly", interval: 1, byMonth: [6] }, 2)).toEqual([
      "2027-06-26",
      "2028-06-26",
    ]);
  });

  it("the last day of February follows leap years", () => {
    const pattern: RepeatPattern = { freq: "yearly", interval: 1, byMonth: [2], byMonthDay: [-1] };
    expect(startDates(pattern, 3)).toEqual(["2027-02-28", "2028-02-29", "2029-02-28"]);
  });

  it("the last weekday of February in a leap year", () => {
    const pattern: RepeatPattern = { ...lastWeekday, freq: "yearly", byMonth: [2] };
    // 29 Feb 2028 is a Tuesday; 28 Feb 2027 is a Sunday.
    expect(startDates(pattern, 2)).toEqual(["2027-02-26", "2028-02-29"]);
  });
});

describe("a rule that ends after a number of occurrences", () => {
  it("counts the To-do the rule was set on as the first, and creates no more after the last", () => {
    const dates = startDates({ freq: "daily", interval: 1, count: 3 }, 10);
    expect(dates).toEqual(["2026-11-26", "2026-11-27", "2026-11-28"]);
  });

  it("doesn't count dates skipped by completing late", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1, count: 2 });
    clock.set("2026-11-30T09:00:00");
    const second = completeAndNext(id)!;
    expect(app.getToDo(second).startDate).toBe("2026-12-01");
    expect(completeAndNext(second)).toBeUndefined();
  });

  it("counts the occurrences the series already has when the rule changes", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    const second = completeAndNext(id)!;
    // The current occurrence is the 2nd, so "3 times" leaves one more.
    app.setRepeat(second, { freq: "daily", interval: 1, count: 3 });
    clock.set("2026-11-27T09:00:00");
    const third = completeAndNext(second)!;
    expect(third).toBeDefined();
    clock.set("2026-11-28T09:00:00");
    expect(completeAndNext(third)).toBeUndefined();
  });

  it("counts an older occurrence that was reopened", () => {
    const first = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(first, { freq: "daily", interval: 1, count: 3 });
    const second = completeAndNext(first)!;
    clock.set("2026-11-27T09:00:00");
    const third = completeAndNext(second)!;
    // Reopening the 1st makes it a normal To-do, but the series still created it.
    app.reopen(first);
    clock.set("2026-11-28T09:00:00");
    expect(completeAndNext(third)).toBeUndefined();
  });

  it("counts occurrences that were deleted and erased from the Trash", () => {
    const first = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(first, { freq: "daily", interval: 1, count: 3 });
    const second = completeAndNext(first)!;
    app.delete(first);
    app.emptyTrash();
    expect(app.repeatPreview(second, { freq: "daily", interval: 1, count: 3 })).toEqual([
      "2026-11-27",
      "2026-11-28",
    ]);
    clock.set("2026-11-27T09:00:00");
    const third = completeAndNext(second)!;
    clock.set("2026-11-28T09:00:00");
    expect(completeAndNext(third)).toBeUndefined();
  });

  it("Upcoming projects no more than the rule's end, after an older one is reopened", () => {
    const first = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(first, { freq: "daily", interval: 1, count: 4 });
    const second = completeAndNext(first)!;
    clock.set("2026-11-27T09:00:00");
    const third = completeAndNext(second)!;
    app.reopen(first);
    const projected = app
      .upcoming()
      .flatMap((g) => g.entries)
      .filter((e) => e.kind === "projected" && e.toDo.id === third)
      .map((e) => e.date);
    // The current one is the 3rd of 4.
    expect(projected).toEqual(["2026-11-29"]);
  });

  it("undoing the latest completion takes its occurrence back off the count", () => {
    const first = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(first, { freq: "daily", interval: 1, count: 2 });
    completeAndNext(first);
    app.reopen(first);
    expect(app.repeatPreview(first, { freq: "daily", interval: 1, count: 2 })).toEqual([
      "2026-11-26",
      "2026-11-27",
    ]);
  });

  it("applies to a rule after completion too", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3, count: 2 }, "afterCompletion");
    expect(app.repeatPatternOf(id)).toEqual({ freq: "daily", interval: 3, count: 2 });
    const second = completeAndNext(id)!;
    expect(app.getToDo(second).startDate).toBe("2026-11-29");
    expect(completeAndNext(second)).toBeUndefined();
  });

  it("cancelling the last one ends the series too", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1, count: 1 });
    app.cancel(id);
    expect(app.currentOccurrence(id)).toBeUndefined();
  });
});

describe("a rule that ends on a date", () => {
  it("is inclusive: an occurrence may start on that date, none after it", () => {
    const pattern: RepeatPattern = { freq: "weekly", interval: 1, until: "2026-12-10" };
    expect(startDates(pattern, 10)).toEqual(["2026-11-26", "2026-12-03", "2026-12-10"]);
  });

  it("compares the date with the next Start date after completion", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3, until: "2026-11-29" }, "afterCompletion");
    const second = completeAndNext(id)!;
    expect(app.getToDo(second).startDate).toBe("2026-11-29");
    clock.set("2026-11-27T09:00:00");
    // Completed early, the next would be 30 Nov: after the end date.
    expect(completeAndNext(second)).toBeUndefined();
  });

  it("refuses a rule that ends before its first date", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    expect(() =>
      app.setRepeat(id, { freq: "monthly", interval: 1, byMonthDay: [1], until: "2026-11-30" }),
    ).toThrow();
    expect(app.getToDo(id).repeat).toBeNull();
  });
});

describe("the stored rule", () => {
  it.each([
    [lastWeekday, ["2026-11-30", "2026-12-31"]],
    [{ freq: "yearly", interval: 1, byMonth: [3], byDay: ["1MO"] }, ["2027-03-01", "2028-03-06"]],
    [{ freq: "daily", interval: 2, count: 5 }, ["2026-11-26", "2026-11-28"]],
    [{ freq: "daily", interval: 1, until: "2027-01-31" }, ["2026-11-26", "2026-11-27"]],
  ] as [RepeatPattern, string[]][])(
    "%o is kept and read back after a restart",
    (pattern, dates) => {
      const store = memoryStore();
      const before = createMyThings({ clock, store });
      const id = before.createToDo({ title: "Chore", when: { kind: "today" } });
      before.setRepeat(id, pattern);
      const after = createMyThings({ clock, store: memoryStore(store.snapshot()) });
      expect(after.repeatPatternOf(id)).toEqual(pattern);
      const kept = after.repeatPatternOf(id)!;
      expect(after.repeatPreview(id, kept, "onSchedule", { limit: 2 })).toEqual(dates);
    },
  );

  it("orders weekdays Monday first, plain before ordinals", () => {
    const id = app.createToDo({ title: "Chore", when: { kind: "today" } });
    app.setRepeat(id, { freq: "monthly", interval: 1, byDay: ["-1FR", "2TU", "1TU"] });
    expect(app.repeatPatternOf(id)?.byDay).toEqual(["1TU", "2TU", "-1FR"]);
  });

  it.each([
    [
      "an nth weekday with a position",
      { freq: "monthly", interval: 1, byDay: ["2MO"], bySetPos: [1] },
    ],
    ["a 6th weekday", { freq: "monthly", interval: 1, byDay: ["6MO"] }],
    ["a month on a monthly rule", { freq: "monthly", interval: 1, byMonth: [3] }],
    ["a yearly weekday without its month", { freq: "yearly", interval: 1, byDay: ["1MO"] }],
    ["both a count and an end date", { freq: "daily", interval: 1, count: 2, until: "2027-01-01" }],
    ["a count of 0", { freq: "daily", interval: 1, count: 0 }],
    [
      "days of the month and weekdays",
      { freq: "monthly", interval: 1, byDay: ["MO"], byMonthDay: [1] },
    ],
    ["a gap that picks days", { freq: "monthly", interval: 1, byDay: ["-1FR"] }, "afterCompletion"],
  ] as [string, RepeatPattern, "afterCompletion"?][])("refuses %s", (_, pattern, mode) => {
    const id = app.createToDo({ title: "Chore", when: { kind: "today" } });
    expect(() => app.setRepeat(id, pattern, mode)).toThrow();
    expect(app.getToDo(id).repeat).toBeNull();
  });
});

describe("the preview of a rule's dates", () => {
  it("shows the next 5 dates, starting with the To-do's own", () => {
    const id = app.createToDo({ title: "Accounts", when: { kind: "today" } });
    expect(app.repeatPreview(id, lastWeekday)).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-29",
      "2027-02-26",
      "2027-03-31",
    ]);
    // Nothing is set by looking.
    expect(app.getToDo(id)).toMatchObject({ repeat: null, startDate: "2026-11-26" });
  });

  it("shows fewer if the rule ends sooner", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    expect(app.repeatPreview(id, { freq: "daily", interval: 1, count: 3 })).toEqual([
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
    ]);
    expect(app.repeatPreview(id, { freq: "weekly", interval: 1, until: "2026-12-04" })).toEqual([
      "2026-11-26",
      "2026-12-03",
    ]);
  });

  it("counts the occurrences the series already has", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1, count: 3 });
    const second = completeAndNext(id)!;
    expect(app.repeatPreview(second, { freq: "daily", interval: 1, count: 3 })).toEqual([
      "2026-11-27",
      "2026-11-28",
    ]);
  });

  it("matches what completing each one on its day gives", () => {
    const pattern: RepeatPattern = { freq: "monthly", interval: 1, byDay: ["2TU"] };
    const id = app.createToDo({ title: "Chore", when: { kind: "today" } });
    const preview = app.repeatPreview(id, pattern);
    expect(startDates(pattern, 5)).toEqual(preview);
  });

  it("is empty after completion, and for a rule with no dates", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    expect(app.repeatPreview(id, { freq: "daily", interval: 3 }, "afterCompletion")).toEqual([]);
    expect(app.repeatPreview(id, { freq: "daily", interval: 1, until: "2026-11-01" })).toEqual([]);
  });
});
