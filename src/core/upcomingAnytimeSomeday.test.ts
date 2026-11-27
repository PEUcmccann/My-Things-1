import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { NEXT_WEEK, setup, TODAY, TOMORROW, YESTERDAY } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const upcoming = () =>
  app.upcoming().map((g) => ({
    kind: g.kind,
    start: g.start,
    entries: g.entries.map(
      (e) =>
        `${e.kind === "project" ? `Project: ${e.project.title}` : e.toDo.title} (${e.reason} ${e.date})`,
    ),
  }));

/** A To-do filed in an Area, so it has left the Inbox. */
function organised(title: string): string {
  const area = app.areas()[0]?.id ?? app.createArea("Home");
  return app.createToDo({ title, areaId: area });
}

describe("Upcoming", () => {
  it("shows a To-do on its future Start date", () => {
    const id = app.createToDo({ title: "Water plants" });
    app.setWhen(id, { kind: "date", date: TOMORROW });
    expect(upcoming()).toEqual([
      { kind: "day", start: TOMORROW, entries: [`Water plants (start ${TOMORROW})`] },
    ]);
  });

  it("shows a future Deadline on its own day", () => {
    const id = app.createToDo({ title: "Renew passport" });
    app.setWhen(id, { kind: "date", date: TOMORROW });
    app.setDeadline(id, NEXT_WEEK);
    expect(upcoming()).toEqual([
      { kind: "day", start: TOMORROW, entries: [`Renew passport (start ${TOMORROW})`] },
      { kind: "day", start: NEXT_WEEK, entries: [`Renew passport (deadline ${NEXT_WEEK})`] },
    ]);
  });

  it("leaves out To-dos starting today or with a Deadline today", () => {
    const a = app.createToDo({ title: "Pay rent" });
    app.setWhen(a, { kind: "today" });
    const b = app.createToDo({ title: "Submit tax return" });
    app.setDeadline(b, TODAY);
    expect(upcoming()).toEqual([]);
  });

  it("groups the next 7 days one by one, then by week, then by month", () => {
    const dates = [
      "2026-11-27",
      "2026-12-03",
      "2026-12-04",
      "2026-12-08",
      "2026-12-24",
      "2027-01-15",
    ];
    for (const date of dates) {
      const id = app.createToDo({ title: date });
      app.setWhen(id, { kind: "date", date });
    }
    expect(app.upcoming().map((g) => [g.kind, g.start, g.entries.length])).toEqual([
      ["day", "2026-11-27", 1],
      ["day", "2026-12-03", 1],
      // Day 8 is Friday 4 December: the rest of that week is one group.
      ["week", "2026-12-04", 1],
      ["week", "2026-12-07", 1],
      // Four weeks out (after 24 December) groups by month.
      ["week", "2026-12-21", 1],
      ["month", "2027-01-01", 1],
    ]);
  });

  it("starts the first month group after the weeks end", () => {
    const id = app.createToDo({ title: "Late December" });
    app.setWhen(id, { kind: "date", date: "2026-12-30" });
    expect(app.upcoming().map((g) => [g.kind, g.start])).toEqual([["month", "2026-12-25"]]);
  });

  it("leaves out finished To-dos and the Trash", () => {
    const a = app.createToDo({ title: "Done early" });
    app.setWhen(a, { kind: "date", date: TOMORROW });
    app.complete(a);
    const b = app.createToDo({ title: "Deleted" });
    app.setWhen(b, { kind: "date", date: TOMORROW });
    app.delete(b);
    expect(upcoming()).toEqual([]);
  });
});

describe("Anytime", () => {
  it("lists organised To-dos with no Start date", () => {
    organised("Read a book");
    expect(titles(app.anytime())).toEqual(["Read a book"]);
  });

  it("includes To-dos also shown in Today", () => {
    const id = organised("Pay rent");
    app.setWhen(id, { kind: "today" });
    const past = app.createToDo({ title: "Call the bank" });
    app.setWhen(past, { kind: "date", date: YESTERDAY });
    expect(titles(app.anytime())).toEqual(["Pay rent", "Call the bank"]);
  });

  it("leaves out To-dos with a future Start date", () => {
    const id = organised("Water plants");
    app.setWhen(id, { kind: "date", date: TOMORROW });
    expect(titles(app.anytime())).toEqual([]);
  });

  it("leaves out To-dos in Someday", () => {
    const id = organised("Learn the cello");
    app.setWhen(id, { kind: "someday" });
    expect(titles(app.anytime())).toEqual([]);
  });

  it("leaves out To-dos still in the Inbox", () => {
    app.createToDo({ title: "Unsorted" });
    expect(titles(app.anytime())).toEqual([]);
  });

  it("leaves out the Logbook and the Trash", () => {
    app.setLogbookMode("immediately");
    const a = organised("Done");
    app.complete(a);
    const b = organised("Deleted");
    app.delete(b);
    expect(titles(app.anytime())).toEqual([]);
  });
});

describe("Someday", () => {
  it("lists To-dos moved to Someday", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setWhen(id, { kind: "someday" });
    organised("Not parked");
    expect(titles(app.someday())).toEqual(["Learn the cello"]);
  });

  it("drops a To-do once it is given a Start date", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setWhen(id, { kind: "someday" });
    app.setWhen(id, { kind: "date", date: TOMORROW });
    expect(titles(app.someday())).toEqual([]);
  });

  it("leaves out the Logbook and the Trash", () => {
    app.setLogbookMode("immediately");
    const a = app.createToDo({ title: "Done", when: { kind: "someday" } });
    app.complete(a);
    const b = app.createToDo({ title: "Deleted", when: { kind: "someday" } });
    app.delete(b);
    expect(titles(app.someday())).toEqual([]);
  });
});
