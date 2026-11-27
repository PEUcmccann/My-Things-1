import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

/** Upcoming as "group start: entries", with projected entries marked by "~". */
const upcoming = () =>
  app.upcoming().map((g) => ({
    group: `${g.kind} ${g.start}`,
    entries: g.entries.map((e) =>
      e.kind === "project"
        ? `Project: ${e.project.title} ${e.date}`
        : `${e.kind === "projected" ? "~" : ""}${e.toDo.title} ${e.date}`,
    ),
  }));

/** Projected dates only, in order. */
const projectedDates = () =>
  app
    .upcoming()
    .flatMap((g) => g.entries)
    .filter((e) => e.kind === "projected")
    .map((e) => e.date);

describe("Repeating To-dos in Upcoming", () => {
  it("shows the next dates of a weekly rule as projected entries", () => {
    // Thursday 26 November: a weekly rule from today repeats every Thursday.
    const id = app.createToDo({ title: "Bins out" });
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    expect(upcoming().slice(0, 4)).toEqual([
      { group: "day 2026-12-03", entries: ["~Bins out 2026-12-03"] },
      { group: "week 2026-12-07", entries: ["~Bins out 2026-12-10"] },
      { group: "week 2026-12-14", entries: ["~Bins out 2026-12-17"] },
      { group: "week 2026-12-21", entries: ["~Bins out 2026-12-24"] },
    ]);
  });

  it("shows every date in the next 7 days, then a rule once per week or month", () => {
    const id = app.createToDo({ title: "Stretch" });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(projectedDates().slice(0, 14)).toEqual([
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      // Weeks: the rest of the first week, then from each Monday to day 28.
      "2026-12-04",
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      // Months: the rest of December, then the first of each month.
      "2026-12-25",
      "2027-01-01",
      "2027-02-01",
    ]);
  });

  it("projects from after a future current occurrence, which counts for its week", () => {
    const id = app.createToDo({ title: "Stretch" });
    app.setWhen(id, { kind: "date", date: "2026-12-10" });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(upcoming().slice(0, 3)).toEqual([
      { group: "week 2026-12-07", entries: ["Stretch 2026-12-10"] },
      { group: "week 2026-12-14", entries: ["~Stretch 2026-12-14"] },
      { group: "week 2026-12-21", entries: ["~Stretch 2026-12-21"] },
    ]);
  });

  it("projects up to 365 days ahead, so a yearly rule shows its next date", () => {
    const id = app.createToDo({ title: "Renew insurance" });
    app.setRepeat(id, { freq: "yearly", interval: 1 });
    expect(projectedDates()).toEqual(["2027-11-26"]);
    const later = app.createToDo({ title: "Birthday card" });
    app.setWhen(later, { kind: "date", date: "2026-11-27" });
    app.setRepeat(later, { freq: "yearly", interval: 1 });
    // 27 November 2027 is 366 days ahead.
    expect(projectedDates()).toEqual(["2027-11-26"]);
  });

  it("follows month-end rules, skipping months without the day", () => {
    const last = app.createToDo({ title: "Pay rent" });
    app.setRepeat(last, { freq: "monthly", interval: 1, byMonthDay: [-1] });
    expect(projectedDates().slice(0, 4)).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
    app.setRepeat(last, { freq: "monthly", interval: 1, byMonthDay: [31] });
    expect(projectedDates().slice(0, 4)).toEqual([
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
      "2027-07-31",
    ]);
  });

  it("changes at once when the rule changes, and goes when it's removed", () => {
    const id = app.createToDo({ title: "Bins out" });
    app.setRepeat(id, { freq: "weekly", interval: 2 });
    expect(projectedDates().slice(0, 2)).toEqual(["2026-12-10", "2026-12-24"]);
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["MO"] });
    // The current occurrence moves to Monday 30 November.
    expect(projectedDates().slice(0, 2)).toEqual(["2026-12-07", "2026-12-14"]);
    app.setRepeat(id, null);
    expect(projectedDates()).toEqual([]);
  });

  it("follows the current occurrence once one is finished", () => {
    const id = app.createToDo({ title: "Bins out" });
    app.setWhen(id, { kind: "date", date: "2026-12-03" });
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    // Completing early brings on 10 December; the finished one leaves Upcoming.
    app.complete(id);
    expect(upcoming().slice(0, 2)).toEqual([
      { group: "week 2026-12-07", entries: ["Bins out 2026-12-10"] },
      { group: "week 2026-12-14", entries: ["~Bins out 2026-12-17"] },
    ]);
  });

  it("leaves projected entries out when the current occurrence is in the Trash", () => {
    const id = app.createToDo({ title: "Bins out" });
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    app.delete(id);
    expect(projectedDates()).toEqual([]);
  });

  it("follows the current occurrence's Tags for the Tag filter", () => {
    const home = app.createTag("Home");
    const work = app.createTag("Work");
    const id = app.createToDo({ title: "Bins out" });
    app.addTag({ kind: "toDo", id }, home);
    app.setRepeat(id, { freq: "weekly", interval: 1 });
    const projected = app
      .upcoming()
      .flatMap((g) => g.entries)
      .filter((e) => e.kind === "projected");
    expect(projected.every((e) => app.entryHasTags(e, [home]))).toBe(true);
    expect(projected.some((e) => app.entryHasTags(e, [work]))).toBe(false);
  });

  it("stops after a rule's last occurrence when it ends after a number of times", () => {
    const id = app.createToDo({ title: "Physio" });
    app.setRepeat(id, { freq: "daily", interval: 1, count: 3 });
    // The current occurrence (26th) is the first of three.
    expect(projectedDates()).toEqual(["2026-11-27", "2026-11-28"]);
    app.complete(id);
    expect(projectedDates()).toEqual(["2026-11-28"]);
  });

  it("stops on a rule's end date, which can still have an occurrence", () => {
    const id = app.createToDo({ title: "Bins out" });
    app.setRepeat(id, { freq: "weekly", interval: 1, until: "2026-12-10" });
    expect(projectedDates()).toEqual(["2026-12-03", "2026-12-10"]);
  });

  it("projects nothing for a rule after completion", () => {
    const id = app.createToDo({
      title: "Water plants",
      when: { kind: "date", date: "2026-11-28" },
    });
    app.setRepeat(id, { freq: "daily", interval: 3 }, "afterCompletion");
    expect(projectedDates()).toEqual([]);
    expect(upcoming()).toEqual([{ group: "day 2026-11-28", entries: ["Water plants 2026-11-28"] }]);
  });

  it("leaves Today to the current occurrence", () => {
    const id = app.createToDo({ title: "Stretch" });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Stretch"]);
  });
});
