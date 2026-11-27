import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings, When } from "./index";
import { setup, TODAY, TOMORROW, YESTERDAY } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof setup>["clock"];

beforeEach(() => {
  ({ app, clock } = setup());
});

// Times are minutes from 00:00.
const at = (hours: number, minutes = 0) => hours * 60 + minutes;

function slotted(title: string, start: number, end: number, when: When = { kind: "today" }) {
  const id = app.createToDo({ title, when });
  app.setTimeSlot(id, { start, end });
  return id;
}

const blocks = () =>
  app.dayTimeline().entries.map((e) => ({ title: e.toDo.title, start: e.start, end: e.end }));

describe("the day timeline", () => {
  it("shows a Time slot of a To-do in Today, as a Time slot block", () => {
    slotted("Dentist", at(14), at(14, 30));
    const [entry] = app.dayTimeline().entries;
    expect(entry).toMatchObject({ kind: "timeSlot", start: 840, end: 870, parentTitle: null });
    expect(entry.toDo).toMatchObject({ title: "Dentist", startDate: TODAY });
  });

  it("leaves out a slot on a past Start date, though the To-do is in Today", () => {
    slotted("Dentist", at(14), at(14, 30), { kind: "date", date: YESTERDAY });
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Dentist"]);
    expect(blocks()).toEqual([]);
  });

  it("lists blocks by start time, then end time", () => {
    slotted("Lunch", at(12), at(13));
    slotted("Stand-up", at(9), at(9, 15));
    slotted("Review", at(9), at(9, 10));
    expect(blocks().map((b) => b.title)).toEqual(["Review", "Stand-up", "Lunch"]);
  });
});

describe("the current time on the day timeline", () => {
  it("is the clock's time of day, in minutes", () => {
    expect(app.dayTimeline().now).toBe(at(10));
    clock.set("2026-11-26T16:45:30");
    expect(app.dayTimeline().now).toBe(at(16, 45));
  });

  it("moves the timeline on to the new day's slots after midnight", () => {
    slotted("Dentist", at(14), at(14, 30));
    clock.set(`${TOMORROW}T08:00:00`);
    expect(app.dayTimeline().entries).toEqual([]);
  });
});

describe("overlapping Time slots", () => {
  const lanes = () =>
    app.dayTimeline().entries.map((e) => [e.toDo.title, `${e.lane + 1} of ${e.lanes}`]);

  it("each get a lane of their own, side by side", () => {
    slotted("Call", at(9), at(10));
    slotted("Email", at(9, 30), at(10, 30));
    expect(lanes()).toEqual([
      ["Call", "1 of 2"],
      ["Email", "2 of 2"],
    ]);
  });

  it("take the whole width when they only touch", () => {
    slotted("Call", at(9), at(10));
    slotted("Email", at(10), at(11));
    expect(lanes()).toEqual([
      ["Call", "1 of 1"],
      ["Email", "1 of 1"],
    ]);
  });

  it("reuse a lane that has come free, sharing the width across a chain", () => {
    slotted("Workshop", at(9), at(12));
    slotted("Call", at(9), at(10));
    slotted("Email", at(10, 30), at(11));
    slotted("Lunch", at(13), at(14));
    expect(lanes()).toEqual([
      ["Call", "1 of 2"],
      ["Workshop", "2 of 2"],
      ["Email", "1 of 2"],
      ["Lunch", "1 of 1"],
    ]);
  });

  it("use as many lanes as slots run at once", () => {
    slotted("A", at(9), at(11));
    slotted("B", at(9), at(10));
    slotted("C", at(9, 30), at(10, 30));
    expect(lanes()).toEqual([
      ["B", "1 of 3"],
      ["A", "2 of 3"],
      ["C", "3 of 3"],
    ]);
  });
});

describe("the hours the day timeline shows", () => {
  const hours = () => {
    const { from, to } = app.dayTimeline();
    return { from, to };
  };

  it("are 06:00 to 23:00 for an empty day", () => {
    expect(hours()).toEqual({ from: at(6), to: at(23) });
  });

  it("stay 06:00 to 23:00 when every slot fits", () => {
    slotted("Run", at(6), at(7));
    slotted("Read", at(22), at(23));
    expect(hours()).toEqual({ from: at(6), to: at(23) });
  });

  it("widen to the hour to fit a slot that starts earlier", () => {
    slotted("Flight", at(4, 45), at(6, 30));
    expect(hours()).toEqual({ from: at(4), to: at(23) });
  });

  it("widen to the hour to fit a slot that ends later", () => {
    slotted("Night shift", at(22), at(23, 10));
    expect(hours()).toEqual({ from: at(6), to: at(24) });
  });

  it("ignore slots that are not on the timeline", () => {
    slotted("Flight", at(3), at(4), { kind: "date", date: YESTERDAY });
    expect(hours()).toEqual({ from: at(6), to: at(23) });
  });
});

describe("which To-dos the day timeline includes", () => {
  const titles = () => app.dayTimeline().entries.map((e) => e.toDo.title);

  it("includes To-dos in This Evening", () => {
    slotted("Cook", at(19), at(20), { kind: "thisEvening" });
    expect(titles()).toEqual(["Cook"]);
  });

  it("includes Sub-to-dos, with their parent's title", () => {
    const parent = app.createToDo({ title: "Move house" });
    const child = app.createToDo({ title: "Book van", parentId: parent });
    app.setTimeSlot(child, { start: at(8), end: at(9) });
    expect(app.dayTimeline().entries).toMatchObject([
      { toDo: { title: "Book van" }, parentTitle: "Move house" },
    ]);
  });

  it("leaves out To-dos in Today without a Time slot", () => {
    app.createToDo({ title: "Pay rent", when: { kind: "today" } });
    expect(titles()).toEqual([]);
  });

  it("leaves out a slot on a future Start date", () => {
    slotted("Dentist", at(14), at(14, 30), { kind: "date", date: TOMORROW });
    expect(titles()).toEqual([]);
  });

  it("keeps Completed and Cancelled To-dos until they move to the Logbook", () => {
    const done = slotted("Run", at(7), at(8));
    const dropped = slotted("Swim", at(18), at(19));
    app.complete(done);
    app.cancel(dropped);
    expect(app.dayTimeline().entries).toMatchObject([
      { toDo: { title: "Run", outcome: "completed" } },
      { toDo: { title: "Swim", outcome: "cancelled" } },
    ]);

    app.moveFinishedToLogbook();
    expect(titles()).toEqual([]);
  });

  it("leaves out a finished To-do at once when the Logbook takes it immediately", () => {
    app.setLogbookMode("immediately");
    app.complete(slotted("Run", at(7), at(8)));
    expect(titles()).toEqual([]);
  });

  it("leaves out To-dos in the Trash, and Sub-to-dos of a trashed To-do", () => {
    app.delete(slotted("Dentist", at(14), at(14, 30)));
    const parent = app.createToDo({ title: "Move house" });
    const child = app.createToDo({ title: "Book van", parentId: parent });
    app.setTimeSlot(child, { start: at(8), end: at(9) });
    app.delete(parent);
    expect(titles()).toEqual([]);
  });
});
