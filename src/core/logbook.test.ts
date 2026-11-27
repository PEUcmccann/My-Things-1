import { beforeEach, describe, expect, it } from "vitest";
import type { fixedClock, MyThings } from "./index";
import { setup, TODAY } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const inboxTitles = () => app.inbox().map((e) => e.toDo.title);
const logbook = () =>
  app.logbook().map((day) => ({
    date: day.date,
    entries: day.entries.map((e) => {
      const finished = e.kind === "toDo" ? e.toDo : e.project;
      return `${finished.title} (${finished.outcome})`;
    }),
  }));

describe("Completed and Cancelled", () => {
  it("completing marks a To-do Completed", () => {
    const id = app.createToDo({ title: "Buy milk" });
    app.complete(id);
    expect(app.getToDo(id).outcome).toBe("completed");
  });

  it("cancelling marks a To-do Cancelled, not Completed", () => {
    const id = app.createToDo({ title: "Go to the gym" });
    app.cancel(id);
    expect(app.getToDo(id).outcome).toBe("cancelled");
  });
});

describe("Logbook timing", () => {
  describe("at the end of the day (the default)", () => {
    it("keeps a To-do finished today in its list", () => {
      const id = app.createToDo({ title: "Buy milk" });
      app.complete(id);
      expect(inboxTitles()).toEqual(["Buy milk"]);
      expect(logbook()).toEqual([]);
    });

    it("moves it to the Logbook the next day", () => {
      const id = app.createToDo({ title: "Buy milk" });
      app.complete(id);
      clock.set("2026-11-27T07:00:00");
      expect(inboxTitles()).toEqual([]);
      expect(logbook()).toEqual([{ date: TODAY, entries: ["Buy milk (completed)"] }]);
    });
  });

  describe("immediately", () => {
    it("moves a finished To-do to the Logbook at once", () => {
      app.setLogbookMode("immediately");
      const id = app.createToDo({ title: "Buy milk" });
      app.complete(id);
      expect(inboxTitles()).toEqual([]);
      expect(logbook()).toEqual([{ date: TODAY, entries: ["Buy milk (completed)"] }]);
    });
  });

  describe("manually", () => {
    beforeEach(() => app.setLogbookMode("manually"));

    it("keeps finished To-dos in their list, even on later days", () => {
      const id = app.createToDo({ title: "Buy milk" });
      app.complete(id);
      clock.set("2026-11-29T07:00:00");
      expect(inboxTitles()).toEqual(["Buy milk"]);
      expect(app.hasFinishedOutsideLogbook()).toBe(true);
    });

    it("moves them to the Logbook when asked", () => {
      const done = app.createToDo({ title: "Buy milk" });
      app.createToDo({ title: "Still to do" });
      app.complete(done);
      app.moveFinishedToLogbook();
      expect(inboxTitles()).toEqual(["Still to do"]);
      expect(logbook()).toEqual([{ date: TODAY, entries: ["Buy milk (completed)"] }]);
      expect(app.hasFinishedOutsideLogbook()).toBe(false);
    });
  });

  it("keeps items in the Logbook when the mode changes", () => {
    const id = app.createToDo({ title: "Buy milk" });
    app.setLogbookMode("immediately");
    app.complete(id);
    app.setLogbookMode("manually");
    expect(inboxTitles()).toEqual([]);
    expect(logbook()).toEqual([{ date: TODAY, entries: ["Buy milk (completed)"] }]);
  });
});

describe("Logbook", () => {
  beforeEach(() => app.setLogbookMode("immediately"));

  it("groups items by the day they were finished, newest first", () => {
    const a = app.createToDo({ title: "Older" });
    const b = app.createToDo({ title: "Newer" });
    const c = app.createToDo({ title: "Newest" });
    app.complete(a);
    clock.set("2026-11-27T09:00:00");
    app.cancel(b);
    clock.set("2026-11-27T10:00:00");
    app.complete(c);
    expect(logbook()).toEqual([
      { date: "2026-11-27", entries: ["Newest (completed)", "Newer (cancelled)"] },
      { date: TODAY, entries: ["Older (completed)"] },
    ]);
  });

  it("leaves out To-dos in the Trash", () => {
    const id = app.createToDo({ title: "Buy milk" });
    app.complete(id);
    app.delete(id);
    expect(logbook()).toEqual([]);
  });
});

describe("reopening", () => {
  it("makes a Logbook To-do active again in its original place", () => {
    app.setLogbookMode("immediately");
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.complete(id);
    app.reopen(id);
    expect(app.getToDo(id)).toMatchObject({ outcome: "active", projectId: project });
    expect(logbook()).toEqual([]);
  });

  it("brings a reopened Inbox To-do back to the Inbox", () => {
    app.setLogbookMode("immediately");
    const id = app.createToDo({ title: "Buy milk" });
    app.cancel(id);
    app.reopen(id);
    expect(inboxTitles()).toEqual(["Buy milk"]);
  });
});
