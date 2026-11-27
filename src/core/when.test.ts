import { beforeEach, describe, expect, it } from "vitest";
import { deadlineFlag, type MyThings } from "./index";
import { NEXT_WEEK, setup, TODAY, TOMORROW, YESTERDAY } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const todayTitles = () => {
  const { main, thisEvening } = app.today();
  return { main: main.map((e) => e.toDo.title), evening: thisEvening.map((e) => e.toDo.title) };
};
const inboxTitles = () => app.inbox().map((e) => e.toDo.title);

describe("editing a To-do", () => {
  it("renames it", () => {
    const id = app.createToDo({ title: "Buy milk" });
    app.editToDo(id, { title: "Buy oat milk" });
    expect(app.getToDo(id).title).toBe("Buy oat milk");
  });

  it("keeps the old title when the new one is blank", () => {
    const id = app.createToDo({ title: "Buy milk" });
    app.editToDo(id, { title: "   " });
    expect(app.getToDo(id).title).toBe("Buy milk");
  });
});

describe("When", () => {
  it("Today puts the To-do in the main part of Today", () => {
    const id = app.createToDo({ title: "Pay rent" });
    app.setWhen(id, { kind: "today" });
    expect(app.getToDo(id).startDate).toBe(TODAY);
    expect(todayTitles()).toEqual({ main: ["Pay rent"], evening: [] });
  });

  it("This Evening puts it in the This Evening part of Today", () => {
    const id = app.createToDo({ title: "Plan the weekend" });
    app.setWhen(id, { kind: "thisEvening" });
    expect(todayTitles()).toEqual({ main: [], evening: ["Plan the weekend"] });
  });

  it("a later date keeps it out of Today until that day", () => {
    const id = app.createToDo({ title: "Water plants" });
    app.setWhen(id, { kind: "date", date: TOMORROW });
    expect(todayTitles()).toEqual({ main: [], evening: [] });
  });

  it("Someday clears the Start date", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setWhen(id, { kind: "today" });
    app.setWhen(id, { kind: "someday" });
    expect(app.getToDo(id)).toMatchObject({ startDate: null, someday: true });
  });

  it("clearing it removes the Start date and Someday", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setWhen(id, { kind: "someday" });
    app.setWhen(id, { kind: "none" });
    expect(app.getToDo(id)).toMatchObject({ startDate: null, someday: false, evening: false });
  });

  it("choosing a date moves a To-do out of the This Evening part", () => {
    const id = app.createToDo({ title: "Plan the weekend" });
    app.setWhen(id, { kind: "thisEvening" });
    app.setWhen(id, { kind: "date", date: TODAY });
    expect(todayTitles()).toEqual({ main: ["Plan the weekend"], evening: [] });
  });
});

describe("the Inbox and When", () => {
  it("a To-do given a Start date leaves the Inbox", () => {
    const id = app.createToDo({ title: "Pay rent" });
    app.setWhen(id, { kind: "today" });
    expect(inboxTitles()).toEqual([]);
  });

  it("a To-do moved to Someday leaves the Inbox", () => {
    const id = app.createToDo({ title: "Learn the cello" });
    app.setWhen(id, { kind: "someday" });
    expect(inboxTitles()).toEqual([]);
  });

  it("a To-do with only a Deadline stays in the Inbox", () => {
    const id = app.createToDo({ title: "Renew passport" });
    app.setDeadline(id, NEXT_WEEK);
    expect(inboxTitles()).toEqual(["Renew passport"]);
  });

  it("clearing When puts it back in the Inbox", () => {
    const id = app.createToDo({ title: "Pay rent" });
    app.setWhen(id, { kind: "today" });
    app.setWhen(id, { kind: "none" });
    expect(inboxTitles()).toEqual(["Pay rent"]);
  });
});

describe("Deadline", () => {
  it("can be set and cleared", () => {
    const id = app.createToDo({ title: "Renew passport" });
    app.setDeadline(id, NEXT_WEEK);
    expect(app.getToDo(id).deadline).toBe(NEXT_WEEK);
    app.setDeadline(id, null);
    expect(app.getToDo(id).deadline).toBeNull();
  });

  describe("flag", () => {
    it("shows overdue once the Deadline has passed", () => {
      expect(deadlineFlag(YESTERDAY, TODAY)).toBe("overdue");
    });

    it("shows soon on the day itself", () => {
      expect(deadlineFlag(TODAY, TODAY)).toBe("soon");
    });

    it("shows soon up to three days ahead", () => {
      expect(deadlineFlag("2026-11-29", TODAY)).toBe("soon");
    });

    it("shows nothing four or more days ahead", () => {
      expect(deadlineFlag("2026-11-30", TODAY)).toBeNull();
    });

    it("shows nothing without a Deadline", () => {
      expect(deadlineFlag(null, TODAY)).toBeNull();
    });

    it("uses the core's clock", () => {
      expect(app.deadlineFlag(TOMORROW)).toBe("soon");
    });
  });
});
