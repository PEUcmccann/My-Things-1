import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings } from "./index";

// The fixed "now" for every test: Thursday 26 November 2026, mid-morning.
const NOW = "2026-11-26T10:00:00";
const TODAY = "2026-11-26";
const YESTERDAY = "2026-11-25";
const TOMORROW = "2026-11-27";
const NEXT_WEEK = "2026-12-03";

let clock: ReturnType<typeof fixedClock>;
let app: MyThings;

beforeEach(() => {
  clock = fixedClock(NOW);
  let n = 0;
  app = createMyThings({ clock, store: memoryStore(), newId: () => `id-${++n}` });
});

const mainTitles = () => app.today().main.map((e) => e.toDo.title);
const eveningTitles = () => app.today().thisEvening.map((e) => e.toDo.title);
const allTitles = () => [...mainTitles(), ...eveningTitles()];

describe("Today", () => {
  it("includes a To-do whose Start date is today", () => {
    const id = app.createToDo({ title: "Pay rent" });
    app.setStartDate(id, TODAY);
    expect(mainTitles()).toEqual(["Pay rent"]);
  });

  it("rolls forward a To-do whose Start date has passed", () => {
    const id = app.createToDo({ title: "Call the bank" });
    app.setStartDate(id, YESTERDAY);
    expect(mainTitles()).toEqual(["Call the bank"]);
  });

  it("excludes a To-do whose Start date is tomorrow", () => {
    const id = app.createToDo({ title: "Water plants" });
    app.setStartDate(id, TOMORROW);
    expect(allTitles()).toEqual([]);
  });

  it("excludes a To-do with no Start date or Deadline", () => {
    app.createToDo({ title: "Read a book" });
    expect(allTitles()).toEqual([]);
  });

  it("includes a To-do with no Start date whose Deadline is today", () => {
    const id = app.createToDo({ title: "Submit tax return" });
    app.setDeadline(id, TODAY);
    expect(mainTitles()).toEqual(["Submit tax return"]);
  });

  it("includes a To-do whose Deadline has passed even if its Start date is later", () => {
    const id = app.createToDo({ title: "Renew passport" });
    app.setStartDate(id, NEXT_WEEK);
    app.setDeadline(id, YESTERDAY);
    expect(mainTitles()).toEqual(["Renew passport"]);
  });

  it("puts a To-do chosen for this evening in This Evening", () => {
    const id = app.createToDo({ title: "Plan the weekend" });
    app.moveToToday(id, { evening: true });
    expect(mainTitles()).toEqual([]);
    expect(eveningTitles()).toEqual(["Plan the weekend"]);
  });

  it("treats choosing Today as setting the Start date to today", () => {
    const id = app.createToDo({ title: "Book dentist" });
    app.moveToToday(id);
    expect(app.getToDo(id).startDate).toBe(TODAY);
    expect(mainTitles()).toEqual(["Book dentist"]);
  });

  it("excludes a To-do in the Trash", () => {
    const id = app.createToDo({ title: "Old idea" });
    app.setStartDate(id, TODAY);
    app.delete(id);
    expect(allTitles()).toEqual([]);
  });

  it("excludes a To-do in Someday", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setStartDate(id, TODAY);
    app.moveToSomeday(id);
    expect(allTitles()).toEqual([]);
  });

  describe("finished To-dos (Logbook at end of day, the default)", () => {
    it("keeps a To-do Completed today visible, ticked, until the day ends", () => {
      const id = app.createToDo({ title: "Buy milk" });
      app.setStartDate(id, TODAY);
      app.complete(id);
      expect(app.today().main.map((e) => e.toDo.outcome)).toEqual(["completed"]);

      clock.set("2026-11-27T08:00:00");
      expect(allTitles()).toEqual([]);
    });

    it("keeps a To-do Cancelled today visible until the day ends", () => {
      const id = app.createToDo({ title: "Go to the gym" });
      app.setStartDate(id, TODAY);
      app.cancel(id);
      expect(app.today().main.map((e) => e.toDo.outcome)).toEqual(["cancelled"]);

      clock.set("2026-11-27T08:00:00");
      expect(allTitles()).toEqual([]);
    });

    it("removes a finished To-do at once when the Logbook mode is immediately", () => {
      app.setLogbookMode("immediately");
      const id = app.createToDo({ title: "Reply to Sam" });
      app.setStartDate(id, TODAY);
      app.complete(id);
      expect(allTitles()).toEqual([]);
    });
  });

  describe("To-dos in a Someday Project", () => {
    it("excludes a To-do with no date of its own", () => {
      const project = app.createProject({ title: "Write a novel" });
      app.moveProjectToSomeday(project);
      app.createToDo({ title: "Outline chapter one", projectId: project });
      expect(allTitles()).toEqual([]);
    });

    it("includes a To-do with its own Start date of today", () => {
      const project = app.createProject({ title: "Write a novel" });
      app.moveProjectToSomeday(project);
      const id = app.createToDo({ title: "Email the editor", projectId: project });
      app.setStartDate(id, TODAY);
      expect(mainTitles()).toEqual(["Email the editor"]);
    });
  });

  describe("Sub-to-dos", () => {
    it("includes a Sub-to-do starting today, labelled with its undated parent", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.setStartDate(child, TODAY);
      expect(app.today().main).toEqual([
        expect.objectContaining({
          toDo: expect.objectContaining({ title: "Book flights" }),
          parentTitle: "Plan trip",
        }),
      ]);
    });

    it("places a Sub-to-do in its parent's Project", () => {
      const project = app.createProject({ title: "Japan" });
      const parent = app.createToDo({ title: "Plan trip", projectId: project });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      expect(app.getToDo(child).projectId).toBe(project);
    });
  });
});
