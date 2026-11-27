import { beforeEach, describe, expect, it } from "vitest";
import { type fixedClock, type MyThings } from "./index";
import { setup, TODAY } from "./testSetup";

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

describe("a Repeat rule after completion", () => {
  it("starts the next occurrence the gap after the day it was completed", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 3 }, "afterCompletion");
    expect(app.getToDo(id).startDate).toBe(TODAY);
    clock.set("2026-11-28T18:00:00");
    const next = completeAndNext(id);
    // Three days after Saturday 28th, not three after the old Start date (29th).
    expect(app.getToDo(next).startDate).toBe("2026-12-01");
  });

  it("is kept as FREQ and INTERVAL only, with its mode", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 2 }, "afterCompletion");
    expect(app.getToDo(id).repeat).toMatchObject({
      mode: "afterCompletion",
      rrule: "FREQ=WEEKLY;INTERVAL=2",
      start: TODAY,
    });
    expect(app.repeatPatternOf(id)).toEqual({ freq: "weekly", interval: 2 });
  });

  it.each([
    ["weekdays", { freq: "weekly", interval: 1, byDay: ["MO"] }],
    ["days of the month", { freq: "monthly", interval: 1, byMonthDay: [1] }],
  ])("refuses %s", (_, pattern) => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    expect(() => app.setRepeat(id, pattern as never, "afterCompletion")).toThrow();
    expect(app.getToDo(id).repeat).toBeNull();
  });
});

describe("when the next occurrence starts", () => {
  /** The next Start date after completing a To-do that starts on `start`, on `doneOn`. */
  function nextAfter(
    pattern: Parameters<MyThings["setRepeat"]>[1],
    start: string,
    doneOn: string,
  ): string | null {
    const id = app.createToDo({ title: "Chore", when: { kind: "date", date: start } });
    app.setRepeat(id, pattern, "afterCompletion");
    clock.set(`${doneOn}T21:30:00`);
    app.complete(id);
    return app.currentOccurrence(id)?.startDate ?? null;
  }

  it.each([
    ["early", "2026-11-30", "2026-11-26", "2026-11-29"],
    ["on time", "2026-11-30", "2026-11-30", "2026-12-03"],
    ["late", "2026-11-30", "2026-12-05", "2026-12-08"],
  ])("completing %s counts from the completion day", (_, start, doneOn, next) => {
    expect(nextAfter({ freq: "daily", interval: 3 }, start, doneOn)).toBe(next);
  });

  it.each([
    [{ freq: "daily", interval: 1 }, "2026-12-11"],
    [{ freq: "weekly", interval: 2 }, "2026-12-24"],
    [{ freq: "monthly", interval: 1 }, "2027-01-10"],
    [{ freq: "monthly", interval: 14 }, "2028-02-10"],
    [{ freq: "yearly", interval: 3 }, "2029-12-10"],
  ] as const)("a gap of %o after 10 Dec 2026 lands on %s", (pattern, next) => {
    expect(nextAfter(pattern, TODAY, "2026-12-10")).toBe(next);
  });

  it.each([
    ["1 month after 31 Jan", { freq: "monthly", interval: 1 }, "2027-01-31", "2027-02-28"],
    [
      "1 month after 31 Jan, leap year",
      { freq: "monthly", interval: 1 },
      "2028-01-31",
      "2028-02-29",
    ],
    ["3 months after 31 Jan", { freq: "monthly", interval: 3 }, "2027-01-31", "2027-04-30"],
    ["1 month after 30 Dec", { freq: "monthly", interval: 1 }, "2026-12-30", "2027-01-30"],
    ["1 year after 29 Feb", { freq: "yearly", interval: 1 }, "2028-02-29", "2029-02-28"],
    ["4 years after 29 Feb", { freq: "yearly", interval: 4 }, "2028-02-29", "2032-02-29"],
  ] as const)("%s lands on the month's last day if it must", (_, pattern, doneOn, next) => {
    expect(nextAfter(pattern, TODAY, doneOn)).toBe(next);
  });

  it("cancelling counts the gap from the day it was Cancelled", () => {
    const id = app.createToDo({ title: "Chore", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 1 }, "afterCompletion");
    clock.set("2026-11-28T08:00:00");
    app.cancel(id);
    expect(app.getToDo(id).outcome).toBe("cancelled");
    expect(app.currentOccurrence(id)?.startDate).toBe("2026-12-05");
  });

  it("the next occurrence keeps the rule", () => {
    const id = app.createToDo({ title: "Chore", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 2 }, "afterCompletion");
    const second = completeAndNext(id);
    clock.set("2026-11-29T08:00:00");
    const third = completeAndNext(second);
    expect(app.getToDo(third).startDate).toBe("2026-12-01");
    expect(app.getToDo(third).repeat?.mode).toBe("afterCompletion");
  });
});

describe("what the next occurrence copies", () => {
  it("the same as a rule on schedule, with dates shifted by the gap from the old Start date", () => {
    const areaId = app.createArea("Home");
    const id = app.createToDo({ title: "Clean", areaId, when: { kind: "today" } });
    app.editToDo(id, { notes: "Use the green cloth" });
    const tag = app.createTag("Chores");
    app.addTag({ kind: "toDo", id }, tag);
    app.setPriority(id, "high");
    app.setEnergy(id, "low");
    app.setEstimate(id, 45);
    app.setTimeSlot(id, { start: 600, end: 645 });
    app.setDeadline(id, "2026-11-28");
    app.tickChecklistItem(app.addChecklistItem(id, "Kitchen"), true);
    const pack = app.createToDo({ title: "Sweep", parentId: id });
    app.setWhen(pack, { kind: "date", date: "2026-11-27" });
    app.complete(pack);
    app.setRepeat(id, { freq: "weekly", interval: 1 }, "afterCompletion");

    clock.set("2026-11-29T10:00:00");
    const next = completeAndNext(id);
    // Completed on Sunday 29th: a week later is 6 Dec, 10 days after the old Start date.
    expect(app.getToDo(next)).toMatchObject({
      title: "Clean",
      notes: "Use the green cloth",
      tagIds: [tag],
      priority: "high",
      energy: "low",
      estimate: 45,
      areaId,
      startDate: "2026-12-06",
      deadline: "2026-12-08",
      timeSlot: { start: 600, end: 645 },
    });
    expect(app.checklist(next).map((c) => [c.title, c.ticked])).toEqual([["Kitchen", false]]);
    expect(app.subToDos(next)).toMatchObject([
      { title: "Sweep", outcome: "active", startDate: "2026-12-07" },
    ]);
  });
});

describe("switching between the two modes", () => {
  it("keeps the To-do and its Start date, and changes only how the next date is worked out", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "date", date: "2026-11-30" } });
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["MO", "FR"] });
    expect(app.getToDo(id).startDate).toBe("2026-11-30");
    app.setRepeat(id, { freq: "weekly", interval: 1 }, "afterCompletion");
    expect(app.getToDo(id)).toMatchObject({
      startDate: "2026-11-30",
      repeat: { mode: "afterCompletion", start: "2026-11-30" },
    });
    expect(app.currentOccurrence(id)?.id).toBe(id);
    clock.set("2026-12-02T10:00:00");
    expect(app.getToDo(completeAndNext(id)).startDate).toBe("2026-12-09");
  });

  it("switching to on schedule takes the Start date as the rule's start", () => {
    const id = app.createToDo({ title: "Gym", when: { kind: "date", date: "2026-12-02" } });
    app.setRepeat(id, { freq: "daily", interval: 5 }, "afterCompletion");
    // Wednesday 2 Dec isn't a Friday, but the current occurrence doesn't jump.
    app.setRepeat(id, { freq: "weekly", interval: 2, byDay: ["FR"] }, "onSchedule");
    expect(app.getToDo(id)).toMatchObject({
      startDate: "2026-12-02",
      repeat: { mode: "onSchedule", start: "2026-12-02" },
    });
    // Its week counts as week 0: Friday 4 Dec, then every other Friday.
    clock.set("2026-12-02T10:00:00");
    const second = completeAndNext(id);
    expect(app.getToDo(second).startDate).toBe("2026-12-04");
    clock.set("2026-12-04T10:00:00");
    expect(app.getToDo(completeAndNext(second)).startDate).toBe("2026-12-18");
  });
});

describe("Upcoming", () => {
  it("shows only the existing occurrence, with no projected dates", () => {
    const id = app.createToDo({
      title: "Water plants",
      when: { kind: "date", date: "2026-11-28" },
    });
    app.setRepeat(id, { freq: "daily", interval: 1 }, "afterCompletion");
    expect(
      app
        .upcoming()
        .flatMap((g) => g.entries.map((e) => [e.date, e.kind === "toDo" && e.toDo.id, e.reason])),
    ).toEqual([["2026-11-28", id, "start"]]);
  });
});
