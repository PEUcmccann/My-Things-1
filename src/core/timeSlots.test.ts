import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings } from "./index";
import { NEXT_WEEK, NOW, setup, TODAY, TOMORROW, YESTERDAY } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

// Times are minutes from 00:00.
const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("setting a Time slot", () => {
  it("gives a dated To-do a start and end time", () => {
    const id = app.createToDo({ title: "Write report", when: { kind: "date", date: TOMORROW } });
    app.setTimeSlot(id, { start: at(14), end: at(14, 30) });
    expect(app.getToDo(id).timeSlot).toEqual({ start: 840, end: 870 });
    expect(app.getToDo(id).startDate).toBe(TOMORROW);
  });

  it("allows a slot that ends at 24:00", () => {
    const id = app.createToDo({ title: "Night shift", when: { kind: "today" } });
    app.setTimeSlot(id, { start: at(23), end: at(24) });
    expect(app.getToDo(id).timeSlot).toEqual({ start: 1380, end: 1440 });
  });

  it.each([
    ["ends before it starts", { start: 870, end: 840 }],
    ["ends when it starts", { start: 840, end: 840 }],
    ["crosses midnight", { start: 1410, end: 1470 }],
    ["starts before 00:00", { start: -30, end: 30 }],
    ["is not in whole minutes", { start: 840.5, end: 870 }],
  ])("refuses a slot that %s", (_, slot) => {
    const id = app.createToDo({ title: "Write report", when: { kind: "today" } });
    expect(() => app.setTimeSlot(id, slot)).toThrow();
    expect(app.getToDo(id).timeSlot).toBeNull();
  });

  it("gives a To-do with no Start date a Start date of today", () => {
    const id = app.createToDo({ title: "Call Sam" });
    app.setTimeSlot(id, { start: at(14), end: at(14, 30) });
    expect(app.getToDo(id)).toMatchObject({ startDate: TODAY, someday: false });
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Call Sam"]);
  });

  it("brings a To-do out of Someday into today", () => {
    const id = app.createToDo({ title: "Call Sam", when: { kind: "someday" } });
    app.setTimeSlot(id, { start: at(14), end: at(14, 30) });
    expect(app.getToDo(id)).toMatchObject({ startDate: TODAY, someday: false });
    expect(app.someday()).toEqual([]);
  });

  it("never moves a To-do into or out of This Evening", () => {
    const evening = app.createToDo({ title: "Cook", when: { kind: "thisEvening" } });
    const day = app.createToDo({ title: "Run", when: { kind: "today" } });
    app.setTimeSlot(evening, { start: at(9), end: at(10) });
    app.setTimeSlot(day, { start: at(20), end: at(21) });
    expect(app.today().thisEvening.map((e) => e.toDo.title)).toEqual(["Cook"]);
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Run"]);
  });

  it("can be set on a Sub-to-do", () => {
    const parent = app.createToDo({ title: "Move house" });
    const child = app.createToDo({ title: "Book van", parentId: parent });
    app.setTimeSlot(child, { start: at(8), end: at(9) });
    expect(app.getToDo(child)).toMatchObject({
      startDate: TODAY,
      timeSlot: { start: 480, end: 540 },
    });
    expect(app.getToDo(parent).timeSlot).toBeNull();
  });

  it("clears the slot", () => {
    const id = app.createToDo({ title: "Write report", when: { kind: "today" } });
    app.setTimeSlot(id, { start: at(9), end: at(10) });
    app.setTimeSlot(id, null);
    expect(app.getToDo(id).timeSlot).toBeNull();
    expect(app.getToDo(id).startDate).toBe(TODAY);
  });
});

describe("the end pre-filled for a start time", () => {
  it("is 30 minutes later for a To-do with no Estimate", () => {
    const id = app.createToDo({ title: "Call Sam" });
    expect(app.suggestedSlotEnd(id, at(14))).toBe(at(14, 30));
  });

  it("is cut to 24:00 when it would pass midnight", () => {
    const id = app.createToDo({ title: "Call Sam" });
    expect(app.suggestedSlotEnd(id, at(23, 45))).toBe(at(24));
  });

  it("is the start plus the Estimate for a To-do with one", () => {
    const id = app.createToDo({ title: "Write report" });
    app.setEstimate(id, 90);
    expect(app.suggestedSlotEnd(id, at(14))).toBe(at(15, 30));
  });

  it("is cut to 24:00 when the Estimate would pass midnight", () => {
    const id = app.createToDo({ title: "Write report" });
    app.setEstimate(id, 120);
    expect(app.suggestedSlotEnd(id, at(23))).toBe(at(24));
  });
});

describe("when the Start date changes", () => {
  const slotted = () => {
    const id = app.createToDo({ title: "Dentist", when: { kind: "today" } });
    app.setTimeSlot(id, { start: at(14), end: at(14, 30) });
    return id;
  };

  it("keeps the times on the new day", () => {
    const id = slotted();
    app.setWhen(id, { kind: "date", date: NEXT_WEEK });
    expect(app.getToDo(id)).toMatchObject({
      startDate: NEXT_WEEK,
      timeSlot: { start: 840, end: 870 },
    });
  });

  it("keeps the times when moved into This Evening", () => {
    const id = slotted();
    app.setWhen(id, { kind: "thisEvening" });
    expect(app.getToDo(id).timeSlot).toEqual({ start: 840, end: 870 });
  });

  it("clears the slot when the Start date is cleared", () => {
    const id = slotted();
    app.setWhen(id, { kind: "none" });
    expect(app.getToDo(id).timeSlot).toBeNull();
  });

  it("clears the slot when the Start date is set to nothing directly", () => {
    const id = slotted();
    app.setStartDate(id, null);
    expect(app.getToDo(id).timeSlot).toBeNull();
  });

  it("clears the slot when the To-do moves to Someday", () => {
    const id = slotted();
    app.moveToSomeday(id);
    expect(app.getToDo(id).timeSlot).toBeNull();
  });

  it("clears the slot when the To-do moves to the Inbox", () => {
    const id = slotted();
    app.moveToDo(id, { kind: "inbox" });
    expect(app.getToDo(id).timeSlot).toBeNull();
  });

  it("keeps the slot when the To-do moves to an Area", () => {
    const id = slotted();
    const area = app.createArea("Health");
    app.moveToDo(id, { kind: "area", id: area });
    expect(app.getToDo(id).timeSlot).toEqual({ start: 840, end: 870 });
  });

  it("clears slots when several To-dos are moved to Someday at once", () => {
    const id = slotted();
    app.setWhenMany([id], { kind: "someday" });
    expect(app.getToDo(id).timeSlot).toBeNull();
  });
});

describe("saving", () => {
  it("keeps a Time slot across a restart", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const first = createMyThings({ clock, store });
    const id = first.createToDo({ title: "Dentist" });
    first.setTimeSlot(id, { start: at(14), end: at(14, 30) });

    const again = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(again.getToDo(id).timeSlot).toEqual({ start: 840, end: 870 });
  });

  it("loads To-dos saved before Time slots existed with no slot", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const id = createMyThings({ clock, store }).createToDo({ title: "Dentist" });
    const snapshot = store.snapshot();
    const legacy = snapshot.records.toDos.map(({ timeSlot: _s, ...rest }) => rest);
    const loaded = createMyThings({
      clock,
      store: memoryStore({ ...snapshot, records: { ...snapshot.records, toDos: legacy as never } }),
    });
    expect(loaded.getToDo(id).timeSlot).toBeNull();
  });
});

describe("a slot on a past Start date", () => {
  it("stays on that date, and moving the To-do to today carries the times", () => {
    const id = app.createToDo({ title: "Dentist", when: { kind: "date", date: YESTERDAY } });
    app.setTimeSlot(id, { start: at(14), end: at(14, 30) });
    expect(app.getToDo(id)).toMatchObject({
      startDate: YESTERDAY,
      timeSlot: { start: 840, end: 870 },
    });
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Dentist"]);

    app.moveToToday(id);
    expect(app.getToDo(id)).toMatchObject({ startDate: TODAY, timeSlot: { start: 840, end: 870 } });
  });
});
