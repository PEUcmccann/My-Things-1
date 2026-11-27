import { beforeEach, describe, expect, it } from "vitest";
import {
  createMyThings,
  fixedClock,
  memoryStore,
  type MyThings,
  type RepeatPattern,
} from "./index";
import { NEXT_WEEK, NOW, setup, TODAY, TOMORROW } from "./testSetup";

// The fixed clock says Thursday 26 November 2026.
let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

/** Completes the current occurrence and returns the next one's id. */
function completeAndNext(id: string): string {
  app.complete(id);
  const next = app.currentOccurrence(id);
  if (!next) throw new Error("No next occurrence");
  return next.id;
}

describe("a daily Repeat rule", () => {
  it("completing creates the next occurrence on the next day", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    const next = completeAndNext(id);
    expect(next).not.toBe(id);
    expect(app.getToDo(next)).toMatchObject({
      title: "Water plants",
      outcome: "active",
      startDate: TOMORROW,
    });
    expect(app.getToDo(id).outcome).toBe("completed");
  });
});

/** The Start dates of `count` occurrences in a row, completing each on its own day. */
function startDates(id: string, count: number): string[] {
  const dates = [app.getToDo(id).startDate!];
  let current = id;
  for (let i = 1; i < count; i++) {
    clock.set(`${app.getToDo(current).startDate}T09:00:00`);
    current = completeAndNext(current);
    dates.push(app.getToDo(current).startDate!);
  }
  return dates;
}

describe("each frequency, with intervals", () => {
  it("daily, every 3 days", () => {
    const id = app.createToDo({ title: "Stretch", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3 });
    expect(startDates(id, 3)).toEqual(["2026-11-26", "2026-11-29", "2026-12-02"]);
  });

  it("weekly on chosen weekdays", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["MO", "TH"] });
    // Thursday, then Monday, Thursday, Monday.
    expect(startDates(id, 4)).toEqual(["2026-11-26", "2026-11-30", "2026-12-03", "2026-12-07"]);
  });

  it("every 2 weeks on Monday and Friday, counting weeks from the first date", () => {
    const id = app.createToDo({ title: "Payroll", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 2, byDay: ["MO", "FR"] });
    // First date: Friday 27 Nov. Its week is week 0, so the next week is skipped.
    expect(startDates(id, 4)).toEqual(["2026-11-27", "2026-12-07", "2026-12-11", "2026-12-21"]);
  });

  it("weekly with no weekdays chosen repeats on the first date's weekday", () => {
    const id = app.createToDo({ title: "Bins", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    expect(startDates(id, 2)).toEqual(["2026-11-26", "2026-12-03"]);
  });

  it("monthly on a day of the month, every 2 months", () => {
    const id = app.createToDo({ title: "Pay rent", when: { kind: "today" } });
    app.setRepeat(id, { freq: "monthly", interval: 2, byMonthDay: [1] });
    expect(startDates(id, 3)).toEqual(["2026-12-01", "2027-02-01", "2027-04-01"]);
  });

  it("yearly on the first date's day and month, every 2 years", () => {
    const id = app.createToDo({ title: "Renew passport", when: { kind: "today" } });
    app.setRepeat(id, { freq: "yearly", interval: 2 });
    expect(startDates(id, 3)).toEqual(["2026-11-26", "2028-11-26", "2030-11-26"]);
  });
});

describe("month-end days", () => {
  it("a monthly rule on the 31st skips months without one", () => {
    const id = app.createToDo({ title: "Invoice", when: { kind: "today" } });
    app.setRepeat(id, { freq: "monthly", interval: 1, byMonthDay: [31] });
    expect(startDates(id, 4)).toEqual(["2026-12-31", "2027-01-31", "2027-03-31", "2027-05-31"]);
  });

  it("the last day of the month follows each month's length", () => {
    const id = app.createToDo({ title: "Accounts", when: { kind: "today" } });
    app.setRepeat(id, { freq: "monthly", interval: 1, byMonthDay: [-1] });
    expect(startDates(id, 4)).toEqual(["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
    expect(app.repeatPatternOf(app.currentOccurrence(id)!.id)).toEqual({
      freq: "monthly",
      interval: 1,
      byMonthDay: [-1],
    });
  });

  it("a yearly rule on 29 February skips years without one", () => {
    const id = app.createToDo({ title: "Leap party", when: { kind: "date", date: "2028-02-29" } });
    app.setRepeat(id, { freq: "yearly", interval: 1 });
    expect(startDates(id, 2)).toEqual(["2028-02-29", "2032-02-29"]);
  });
});

describe("setting a Repeat rule", () => {
  it("keeps the rule with its mode and start", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 2, byDay: ["TH", "MO"] });
    expect(app.getToDo(id).repeat).toMatchObject({ mode: "onSchedule", start: TODAY });
    expect(app.repeatPatternOf(id)).toEqual({ freq: "weekly", interval: 2, byDay: ["MO", "TH"] });
  });

  it("moves the Start date to the first rule date on or after it", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "date", date: "2026-12-01" } });
    app.setRepeat(id, { freq: "weekly", interval: 3, byDay: ["FR"] });
    expect(app.getToDo(id).startDate).toBe("2026-12-04");
    expect(app.getToDo(id).repeat?.start).toBe("2026-12-04");
  });

  it("gives a To-do with no Start date the first rule date from today", () => {
    const id = app.createToDo({ title: "Pay rent" });
    app.setRepeat(id, { freq: "monthly", interval: 1, byMonthDay: [1] });
    expect(app.getToDo(id).startDate).toBe("2026-12-01");
  });

  it("starts from today when the Start date has passed", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "date", date: "2026-11-02" } });
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["FR"] });
    expect(app.getToDo(id).startDate).toBe(TOMORROW);
  });

  it("takes a To-do out of Someday", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "someday" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(app.getToDo(id)).toMatchObject({ startDate: TODAY, someday: false });
  });

  it("can be changed, and then follows the new rule", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["SA"] });
    expect(app.getToDo(id).startDate).toBe("2026-11-28");
    clock.set("2026-11-28T09:00:00");
    expect(app.getToDo(completeAndNext(id)).startDate).toBe("2026-12-05");
  });

  it("can be removed, and then completing creates nothing", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.setRepeat(id, null);
    expect(app.getToDo(id)).toMatchObject({ repeat: null, startDate: TODAY });
    app.complete(id);
    expect(app.currentOccurrence(id)).toBeUndefined();
    expect(app.upcoming()).toEqual([]);
  });

  it.each([
    ["an interval of 0", { freq: "daily", interval: 0 }],
    ["a fractional interval", { freq: "daily", interval: 1.5 }],
    ["weekdays on a daily rule", { freq: "daily", interval: 1, byDay: ["MO"] }],
    ["an nth weekday on a weekly rule", { freq: "weekly", interval: 1, byDay: ["2MO"] }],
    ["a day of the month on a weekly rule", { freq: "weekly", interval: 1, byMonthDay: [3] }],
    ["day 32", { freq: "monthly", interval: 1, byMonthDay: [32] }],
    ["an unknown frequency", { freq: "hourly", interval: 1 }],
  ])("refuses %s", (_, pattern) => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    expect(() => app.setRepeat(id, pattern as never)).toThrow();
    expect(app.getToDo(id).repeat).toBeNull();
  });

  it("refuses a Repeat rule on a Sub-to-do", () => {
    const parent = app.createToDo({ title: "Trip", when: { kind: "today" } });
    const child = app.createToDo({ title: "Pack", parentId: parent });
    expect(() => app.setRepeat(child, { freq: "daily", interval: 1 })).toThrow();
    expect(app.getToDo(child).repeat).toBeNull();
  });
});

describe("changing the rule's start date", () => {
  it("moves the current occurrence to the first rule date on or after it", () => {
    const id = app.createToDo({ title: "Bins out", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 2, byDay: ["MO"] });
    expect(app.getToDo(id).startDate).toBe("2026-11-30");
    // Wednesday 2 December: the first Monday on or after it is the 7th.
    app.setRepeatStart(id, "2026-12-02");
    expect(app.getToDo(id).startDate).toBe("2026-12-07");
    // The schedule now counts its fortnights from there.
    expect(startDates(id, 3)).toEqual(["2026-12-07", "2026-12-21", "2027-01-04"]);
  });

  it("can move the schedule earlier, but not before today", () => {
    const id = app.createToDo({ title: "Bins out", when: { kind: "date", date: NEXT_WEEK } });
    app.setRepeat(id, { freq: "daily", interval: 2 });
    app.setRepeatStart(id, TOMORROW);
    expect(app.getToDo(id).startDate).toBe(TOMORROW);
    expect(() => app.setRepeatStart(id, "2026-11-20")).toThrow();
    expect(app.getToDo(id).startDate).toBe(TOMORROW);
  });

  it("previews the dates from a chosen start", () => {
    const id = app.createToDo({ title: "Bins out", when: { kind: "today" } });
    const pattern: RepeatPattern = { freq: "weekly", interval: 2, byDay: ["MO"] };
    expect(app.repeatPreview(id, pattern, "onSchedule", { start: "2026-12-02" })).toEqual([
      "2026-12-07",
      "2026-12-21",
      "2027-01-04",
      "2027-01-18",
      "2027-02-01",
    ]);
  });

  it("is the Start date itself after completion", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3 }, "afterCompletion");
    app.setRepeatStart(id, NEXT_WEEK);
    expect(app.getToDo(id).startDate).toBe(NEXT_WEEK);
  });

  it("refuses a start after the rule's end, and a To-do that doesn't repeat", () => {
    const id = app.createToDo({ title: "Bins out", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1, until: "2026-12-01" });
    expect(() => app.setRepeatStart(id, "2026-12-05")).toThrow();
    expect(app.getToDo(id).startDate).toBe(TODAY);
    const plain = app.createToDo({ title: "Buy soil" });
    expect(() => app.setRepeatStart(plain, TOMORROW)).toThrow();
  });

  it('keeps the series\' occurrence count and "this one" changes', () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1, count: 2 });
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Gym (legs)" }));
    app.setRepeatStart(id, NEXT_WEEK);
    clock.set(`${NEXT_WEEK}T09:00:00`);
    const next = completeAndNext(id);
    expect(app.getToDo(next).title).toBe("Gym");
    clock.set("2026-12-04T09:00:00");
    app.complete(next);
    expect(app.currentOccurrence(next)).toBeUndefined();
  });
});

describe("a repeating To-do always has a Start date", () => {
  let id: string;
  beforeEach(() => {
    id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
  });

  it.each([
    ["Someday", () => app.setWhen(id, { kind: "someday" })],
    ["no date", () => app.setWhen(id, { kind: "none" })],
    ["a cleared Start date", () => app.setStartDate(id, null)],
    ["Someday, for several To-dos", () => app.setWhenMany([id], { kind: "someday" })],
    ["a drop on Someday", () => app.dropToDo(id, { kind: "someday" })],
  ])("refuses %s", (_, act) => {
    expect(act).toThrow();
    expect(app.getToDo(id)).toMatchObject({ startDate: TODAY, someday: false });
  });

  it("refuses Someday for a whole selection before changing any of it", () => {
    const other = app.createToDo({ title: "Read", when: { kind: "today" } });
    expect(() => app.setWhenMany([other, id], { kind: "someday" })).toThrow();
    expect(app.getToDo(other).someday).toBe(false);
  });

  it("can still move to another date", () => {
    app.setWhen(id, { kind: "date", date: "2026-12-10" });
    expect(app.getToDo(id).startDate).toBe("2026-12-10");
  });

  it("keeps its Start date when moved to the Inbox", () => {
    app.moveToDo(id, { kind: "inbox" });
    expect(app.getToDo(id).startDate).toBe(TODAY);
  });
});

describe("when the next occurrence starts", () => {
  it("completing late skips the missed dates", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    clock.set("2026-11-30T09:00:00");
    expect(app.getToDo(completeAndNext(id)).startDate).toBe("2026-12-01");
  });

  it("completing early doesn't produce a second occurrence on the same date", () => {
    const id = app.createToDo({ title: "Pay rent", when: { kind: "today" } });
    app.setRepeat(id, { freq: "monthly", interval: 1, byMonthDay: [1] });
    // The current one starts on 1 December; it is completed on 26 November.
    expect(app.getToDo(completeAndNext(id)).startDate).toBe("2027-01-01");
  });

  it("keeps the rule's start as the anchor when one occurrence is moved", () => {
    const id = app.createToDo({ title: "Stretch", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3 });
    app.setWhen(id, { kind: "date", date: "2026-11-27" });
    clock.set("2026-11-27T09:00:00");
    expect(app.getToDo(completeAndNext(id)).startDate).toBe("2026-11-29");
  });
});

describe("what the next occurrence copies", () => {
  it("copies the Checklist unticked, Tags, planning attributes, Time slot and notes", () => {
    const projectId = app.createProject({ title: "Home" });
    const headingId = app.createHeading(projectId, "Weekly");
    const id = app.createToDo({ title: "Clean", headingId, when: { kind: "today" } });
    app.editToDo(id, { notes: "Use the **green** cloth" });
    const tag = app.createTag("Chores");
    app.addTag({ kind: "toDo", id }, tag);
    app.setPriority(id, "high");
    app.setEnergy(id, "low");
    app.setEstimate(id, 45);
    app.setTimeSlot(id, { start: 600, end: 645 });
    const step = app.addChecklistItem(id, "Kitchen");
    app.addChecklistItem(id, "Bathroom");
    app.tickChecklistItem(step, true);
    app.setRepeat(id, { freq: "weekly", interval: 1 });

    const next = completeAndNext(id);
    expect(app.getToDo(next)).toMatchObject({
      title: "Clean",
      notes: "Use the **green** cloth",
      tagIds: [tag],
      priority: "high",
      energy: "low",
      estimate: 45,
      startDate: NEXT_WEEK,
      timeSlot: { start: 600, end: 645 },
      projectId,
      headingId,
      areaId: null,
    });
    expect(app.checklist(next).map((c) => [c.title, c.ticked])).toEqual([
      ["Kitchen", false],
      ["Bathroom", false],
    ]);
    // The finished occurrence keeps its own Checklist.
    expect(app.checklistProgress(id)).toEqual({ ticked: 1, total: 2 });
  });

  it("stays in the same Area", () => {
    const areaId = app.createArea("Health");
    const id = app.createToDo({ title: "Run", areaId, when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(app.getToDo(completeAndNext(id)).areaId).toBe(areaId);
  });

  it("gives the next one a Deadline the same number of days after its Start date", () => {
    const id = app.createToDo({ title: "Report", when: { kind: "today" } });
    app.setDeadline(id, "2026-11-28");
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    expect(app.getToDo(completeAndNext(id))).toMatchObject({
      startDate: NEXT_WEEK,
      deadline: "2026-12-05",
    });
  });

  it("copies every Sub-to-do not in the Trash, reopened, with dates shifted", () => {
    const id = app.createToDo({ title: "Trip", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    const pack = app.createToDo({ title: "Pack", parentId: id });
    app.setWhen(pack, { kind: "date", date: TOMORROW });
    app.setDeadline(pack, "2026-11-28");
    const step = app.addChecklistItem(pack, "Socks");
    app.tickChecklistItem(step, true);
    const tickets = app.createToDo({ title: "Tickets", parentId: id });
    app.complete(tickets);
    const visa = app.createToDo({ title: "Visa", parentId: id });
    app.cancel(visa);
    const dropped = app.createToDo({ title: "Dropped", parentId: id });
    app.delete(dropped);

    app.complete(id, { remaining: "complete" });
    const next = app.currentOccurrence(id)!.id;
    const children = app.subToDos(next);
    expect(children.map((t) => [t.title, t.outcome])).toEqual([
      ["Pack", "active"],
      ["Tickets", "active"],
      ["Visa", "active"],
    ]);
    expect(children[0]).toMatchObject({ startDate: "2026-12-04", deadline: "2026-12-05" });
    expect(app.checklist(children[0].id).map((c) => c.ticked)).toEqual([false]);
    // The finished occurrence keeps its own Sub-to-dos.
    expect(app.subToDos(id).map((t) => t.outcome)).toEqual(["completed", "completed", "cancelled"]);
  });
});

describe("only one occurrence exists", () => {
  const titles = () => [
    ...app.today().main.map((e) => `${e.toDo.title} ${e.toDo.outcome}`),
    // Projected dates (#28) aren't occurrences.
    ...app
      .upcoming()
      .flatMap((g) => g.entries.filter((e) => e.kind !== "projected"))
      .map((e) => `${e.date} ${e.reason}`),
  ];

  it("completing creates exactly one next occurrence", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.complete(id);
    expect(titles()).toEqual(["Water plants completed", `${TOMORROW} start`]);
    // The finished one no longer carries the rule.
    expect(app.getToDo(id).repeat).toBeNull();
  });

  it("the completed one goes to the Logbook as usual", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.complete(id);
    clock.set("2026-11-27T09:00:00");
    expect(
      app.logbook().flatMap((d) => d.entries.map((e) => e.kind === "toDo" && e.toDo.id)),
    ).toEqual([id]);
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Water plants"]);
  });

  it("cancelling also creates the next occurrence", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.cancel(id);
    expect(app.getToDo(id).outcome).toBe("cancelled");
    expect(app.currentOccurrence(id)?.startDate).toBe(TOMORROW);
  });

  it("completing several selected To-dos creates each next occurrence once", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.completeMany([id, id]);
    expect(titles()).toEqual(["Water plants completed", `${TOMORROW} start`]);
  });
});

describe("deleting and restoring", () => {
  it("deleting the current occurrence stops the series; restoring brings it back", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.delete(id);
    expect(app.currentOccurrence(id)).toBeUndefined();
    expect(app.today().main).toEqual([]);
    app.restore(id);
    expect(app.currentOccurrence(id)?.id).toBe(id);
    expect(app.getToDo(completeAndNext(id)).startDate).toBe(TOMORROW);
  });
});

describe("reopening a finished occurrence", () => {
  let first: string;
  beforeEach(() => {
    first = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(first, { freq: "daily", interval: 1 });
  });

  it("the latest one acts as an undo: the next one goes and the rule comes back", () => {
    const next = completeAndNext(first);
    app.addChecklistItem(next, "Ferns");
    app.reopen(first);
    expect(app.findToDo(next)).toBeUndefined();
    expect(app.getToDo(first)).toMatchObject({ outcome: "active", startDate: TODAY });
    expect(app.repeatPatternOf(first)).toEqual({ freq: "daily", interval: 1 });
    expect(app.currentOccurrence(first)?.id).toBe(first);
    // No occurrence waits in Upcoming, only the rule's projected dates.
    expect(
      app
        .upcoming()
        .flatMap((g) => g.entries)
        .filter((e) => e.kind !== "projected"),
    ).toEqual([]);
    // Completing it again works as before.
    expect(app.getToDo(completeAndNext(first)).startDate).toBe(TOMORROW);
  });

  it("an older one reopens as a normal To-do without a rule", () => {
    const second = completeAndNext(first);
    clock.set("2026-11-27T09:00:00");
    const third = completeAndNext(second);
    app.reopen(first);
    expect(app.getToDo(first)).toMatchObject({ outcome: "active", repeat: null });
    expect(app.currentOccurrence(third)?.id).toBe(third);
    expect(app.findToDo(third)).toBeDefined();
    // Completing it again creates nothing new.
    app.complete(first);
    expect(app.currentOccurrence(third)?.id).toBe(third);
  });

  it("reopens as a normal To-do once the series has stopped", () => {
    const next = completeAndNext(first);
    app.delete(next);
    app.reopen(first);
    expect(app.getToDo(first)).toMatchObject({ outcome: "active", repeat: null });
    expect(app.isInTrash(next)).toBe(true);
  });

  it("undoes step by step, never leaving two open occurrences", () => {
    const second = completeAndNext(first);
    clock.set("2026-11-27T09:00:00");
    completeAndNext(second);
    app.reopen(second);
    // The first is now the latest finished one, and the second its open next one.
    app.reopen(first);
    expect(app.findToDo(second)).toBeUndefined();
    const open = app
      .today()
      .main.concat(
        app.upcoming().flatMap((g) => g.entries.flatMap((e) => (e.kind === "toDo" ? [e] : []))),
      )
      .filter((e) => e.toDo.repeat);
    expect(open.map((e) => e.toDo.id)).toEqual([first]);
  });
});

describe("restarting", () => {
  it("rules and occurrences survive a restart", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const before = createMyThings({ clock, store });
    const id = before.createToDo({ title: "Gym", when: { kind: "today" } });
    before.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["TH"] });
    before.complete(id);

    const after = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    const next = after.currentOccurrence(id)!;
    expect(next.startDate).toBe(NEXT_WEEK);
    expect(after.repeatPatternOf(next.id)).toEqual({ freq: "weekly", interval: 1, byDay: ["TH"] });
  });

  it("a snapshot saved before Repeat rules still loads", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    createMyThings({ clock, store }).createToDo({ title: "Buy milk" });
    const snapshot = store.snapshot();
    const legacy = snapshot.records.toDos.map(({ repeat: _r, seriesId: _s, ...rest }) => rest);
    const loaded = createMyThings({
      clock,
      store: memoryStore({ ...snapshot, records: { ...snapshot.records, toDos: legacy as never } }),
    });
    const [entry] = loaded.inbox();
    expect(entry.toDo).toMatchObject({ repeat: null, seriesId: null });
    loaded.complete(entry.toDo.id);
    expect(loaded.currentOccurrence(entry.toDo.id)).toBeUndefined();
  });
});

describe("Projects", () => {
  it("have no Repeat rule", () => {
    const projectId = app.createProject({ title: "Move house" });
    expect(() => app.setRepeat(projectId, { freq: "daily", interval: 1 })).toThrow();
  });
});

describe("reading rules", () => {
  it.each([
    ["an hourly rule", { freq: "hourly" as never, interval: 1 }],
    ["an interval that isn't a whole number", { freq: "daily", interval: 1.5 }],
    ["an interval of 0", { freq: "daily", interval: 0 }],
    ["an ordinal weekday on a weekly rule", { freq: "weekly", interval: 1, byDay: ["1MO"] }],
    ["an end date that isn't a date", { freq: "daily", interval: 1, until: "next year" }],
  ] as [string, RepeatPattern][])("refuses %s", (_, pattern) => {
    const id = app.createToDo({ title: "Gym", when: { kind: "today" } });
    expect(() => app.setRepeat(id, pattern)).toThrow();
    expect(app.repeatPatternOf(id)).toBeNull();
  });

  it("reads back what it keeps, after a restart too", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const before = createMyThings({ clock, store });
    const id = before.createToDo({ title: "Pay bills", when: { kind: "today" } });
    const pattern: RepeatPattern = { freq: "monthly", interval: 3, byMonthDay: [-1, 15] };
    before.setRepeat(id, pattern);
    const after = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(after.repeatPatternOf(id)).toEqual(pattern);
    expect(after.repeatPreview(id, pattern, "onSchedule", { limit: 3 })).toEqual([
      "2026-11-30",
      "2027-02-15",
      "2027-02-28",
    ]);
  });
});
