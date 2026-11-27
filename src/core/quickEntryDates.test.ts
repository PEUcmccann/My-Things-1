import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup, TODAY, TOMORROW } from "./testSetup";

// The fixed clock is Thursday 26 November 2026.
let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

/** Creates a To-do from quick entry text and returns it. */
function enter(text: string) {
  const id = app.createFromQuickEntry(text);
  if (!id) throw new Error(`Nothing created from "${text}"`);
  return app.getToDo(id);
}

describe("date words in quick entry", () => {
  it("sets tomorrow's Start date from 'tomorrow' and takes it out of the title", () => {
    const toDo = enter("Buy milk tomorrow");
    expect(toDo.startDate).toBe(TOMORROW);
    expect(toDo.title).toBe("Buy milk");
    expect(toDo.evening).toBe(false);
    expect(toDo.someday).toBe(false);
  });

  it.each([
    ["today", TODAY],
    ["tom", TOMORROW],
    ["Tomorrow", TOMORROW],
    ["TODAY", TODAY],
  ])("sets the Start date from %s", (phrase, date) => {
    const toDo = enter(`Buy milk ${phrase}`);
    expect(toDo.startDate).toBe(date);
    expect(toDo.title).toBe("Buy milk");
  });
});

describe("'in N days / weeks / months' in quick entry", () => {
  it.each([
    ["in 3 days", "2026-11-29"],
    ["in 1 day", "2026-11-27"],
    ["in 2 weeks", "2026-12-10"],
    ["in 1 week", "2026-12-03"],
    ["in 1 month", "2026-12-26"],
    ["in 2 months", "2027-01-26"],
    ["In 10 Days", "2026-12-06"],
  ])("sets the Start date from '%s', taking all three words", (phrase, date) => {
    const toDo = enter(`Renew passport ${phrase}`);
    expect(toDo.startDate).toBe(date);
    expect(toDo.title).toBe("Renew passport");
  });

  it("lands on the month's last day when the day doesn't exist there", () => {
    ({ app } = setup("2027-01-31T10:00:00"));
    expect(enter("Pay rent in 1 month").startDate).toBe("2027-02-28");
    expect(enter("Pay rent in 13 months").startDate).toBe("2028-02-29");
    expect(enter("Pay rent in 3 months").startDate).toBe("2027-04-30");
  });

  it.each([
    ["no number", "Fill in the form"],
    ["zero", "Back in 0 days"],
    ["another unit", "Done in 3 years"],
    ["a word for the number", "Back in three days"],
    ["no unit", "Back in 3"],
  ])("keeps 'in' as text with %s", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.startDate).toBeNull();
  });
});

describe("This Evening and Someday in quick entry", () => {
  it.each(["this evening", "tonight", "This Evening", "TONIGHT"])(
    "puts the To-do in This Evening from '%s'",
    (phrase) => {
      const toDo = enter(`Call mum ${phrase}`);
      expect(toDo.startDate).toBe(TODAY);
      expect(toDo.evening).toBe(true);
      expect(toDo.title).toBe("Call mum");
    },
  );

  it("keeps a bare 'evening' in the title", () => {
    const toDo = enter("Evening run");
    expect(toDo.title).toBe("Evening run");
    expect(toDo.startDate).toBeNull();
    expect(toDo.evening).toBe(false);
  });

  it("keeps 'this' as text when 'evening' doesn't follow", () => {
    expect(enter("Fix this bug").title).toBe("Fix this bug");
  });

  it("moves the To-do to Someday from 'someday'", () => {
    const toDo = enter("Learn the cello someday");
    expect(toDo.someday).toBe(true);
    expect(toDo.startDate).toBeNull();
    expect(toDo.title).toBe("Learn the cello");
    expect(app.someday().map((e) => e.toDo.title)).toEqual(["Learn the cello"]);
  });

  it("keeps a time token as text with 'someday', since a Time slot needs a Start date", () => {
    const toDo = enter("Learn the cello someday @14:00");
    expect(toDo.someday).toBe(true);
    expect(toDo.timeSlot).toBeNull();
    expect(toDo.title).toBe("Learn the cello @14:00");
    const preview = app.previewQuickEntry("Learn the cello someday @14:00");
    expect(preview.tokens.map((t) => t.text)).toEqual(["someday"]);
  });

  it("puts a Time slot on today's evening with 'tonight'", () => {
    const toDo = enter("Call mum tonight @19:00");
    expect(toDo.evening).toBe(true);
    expect(toDo.startDate).toBe(TODAY);
    expect(toDo.timeSlot).toEqual({ start: 19 * 60, end: 19 * 60 + 30 });
  });
});

describe("calendar dates in quick entry", () => {
  it.each([
    ["12 Dec", "2026-12-12"],
    ["12 December", "2026-12-12"],
    ["Dec 12", "2026-12-12"],
    ["December 12", "2026-12-12"],
    ["3 jan", "2027-01-03"],
    ["SEPT 4", "2027-09-04"],
    ["2026-12-12", "2026-12-12"],
    ["2027-02-28", "2027-02-28"],
  ])("sets the Start date from %s", (phrase, date) => {
    const toDo = enter(`Book dentist ${phrase}`);
    expect(toDo.startDate).toBe(date);
    expect(toDo.title).toBe("Book dentist");
  });

  it("reads a day and month that have passed this year as next year", () => {
    expect(enter("Book dentist 25 Nov").startDate).toBe("2027-11-25");
    expect(enter("Book dentist Mar 1").startDate).toBe("2027-03-01");
  });

  it("reads today's day and month as today", () => {
    expect(enter("Book dentist 26 Nov").startDate).toBe(TODAY);
  });

  it.each([
    ["a numeric date", "Pay bill 12/12"],
    ["a day that doesn't exist", "Pay bill 31 Nov"],
    ["a month name alone", "Plan for May"],
    ["a number before a word", "Read 12 Angry Men"],
    ["an ISO date that doesn't exist", "Pay bill 2026-02-30"],
    ["a day of 0", "Pay bill 0 Dec"],
  ])("keeps %s as text", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.startDate).toBeNull();
  });
});

describe("weekdays in quick entry", () => {
  // Today is a Thursday: a weekday means the next such day after today.
  it.each([
    ["fri", "2026-11-27"],
    ["friday", "2026-11-27"],
    ["Sat", "2026-11-28"],
    ["sunday", "2026-11-29"],
    ["mon", "2026-11-30"],
    ["tue", "2026-12-01"],
    ["tues", "2026-12-01"],
    ["Tuesday", "2026-12-01"],
    ["wed", "2026-12-02"],
    ["wednesday", "2026-12-02"],
    ["thu", "2026-12-03"],
    ["thurs", "2026-12-03"],
    ["THURSDAY", "2026-12-03"],
  ])("sets the next %s", (phrase, date) => {
    const toDo = enter(`Call Sam ${phrase}`);
    expect(toDo.startDate).toBe(date);
    expect(toDo.title).toBe("Call Sam");
  });

  it("reads today's weekday as the same day next week", () => {
    expect(enter("Call Sam thu").startDate).toBe("2026-12-03");
    expect(enter("Call Sam thursday").startDate).toBe("2026-12-03");
  });

  it("reads 'next fri' as the same day as 'fri', taking both words", () => {
    const toDo = enter("Call Sam next fri");
    expect(toDo.startDate).toBe("2026-11-27");
    expect(toDo.title).toBe("Call Sam");
    expect(enter("Call Sam Next Thursday").startDate).toBe("2026-12-03");
  });

  it("keeps 'next' as text when no weekday follows", () => {
    const toDo = enter("Plan the next step");
    expect(toDo.title).toBe("Plan the next step");
    expect(toDo.startDate).toBeNull();
  });
});

describe("where date phrases sit in the title", () => {
  it.each([
    ["at the start", "tomorrow buy milk", "buy milk"],
    ["in the middle", "Buy tomorrow fresh milk", "Buy fresh milk"],
    ["at the end", "Buy milk tomorrow", "Buy milk"],
    ["a multi-word phrase in the middle", "Pay in 2 weeks the rent", "Pay the rent"],
  ])("reads a date phrase %s", (_, text, title) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(title);
    expect(toDo.startDate).not.toBeNull();
  });

  it.each([
    ["a possessive", "Prep tomorrow's talk"],
    ["punctuation after it", "Call Sam tomorrow, then Jo"],
    ["part of a word", "Friday's child"],
    ["inside a word", "Mayday drill"],
    ["a month on its own", "Dec the halls"],
  ])("keeps a date word as text in %s", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.startDate).toBeNull();
  });

  it("uses the last date phrase and keeps earlier ones as text", () => {
    const toDo = enter("Move the call from fri to next mon");
    expect(toDo.startDate).toBe("2026-11-30");
    expect(toDo.title).toBe("Move the call from fri to");
    expect(enter("Someday tomorrow").title).toBe("Someday");
    expect(enter("Someday tomorrow").someday).toBe(false);
  });

  it.each([
    ["on fri", "2026-11-27"],
    ["on next fri", "2026-11-27"],
    ["on 12 Dec", "2026-12-12"],
    ["On Dec 12", "2026-12-12"],
    ["on 2026-12-12", "2026-12-12"],
  ])("takes a preceding 'on' out with '%s'", (phrase, date) => {
    const toDo = enter(`Call Sam ${phrase} about it`);
    expect(toDo.startDate).toBe(date);
    expect(toDo.title).toBe("Call Sam about it");
    expect(app.previewQuickEntry(`Call Sam ${phrase}`).tokens.map((t) => t.text)).toEqual([phrase]);
  });

  it("keeps 'on' as text when no date follows", () => {
    expect(enter("Turn on the heating tomorrow").title).toBe("Turn on the heating");
  });
});

describe("date phrases with other shorthand", () => {
  it("puts a Time slot on the date phrase's day, wherever the time is typed", () => {
    const toDo = enter("Dentist fri @9:30");
    expect(toDo.startDate).toBe("2026-11-27");
    expect(toDo.timeSlot).toEqual({ start: 570, end: 600 });
    const before = enter("Dentist @9:30 12 Dec");
    expect(before.startDate).toBe("2026-12-12");
    expect(before.timeSlot).toEqual({ start: 570, end: 600 });
  });

  it("creates the full example from docs/plan.md", () => {
    const toDo = enter("Buy milk tomorrow #errand !high ~15m @14:00");
    expect(toDo.title).toBe("Buy milk");
    expect(toDo.startDate).toBe(TOMORROW);
    expect(app.tagsOf({ kind: "toDo", id: toDo.id }).map((t) => t.title)).toEqual(["errand"]);
    expect(toDo.priority).toBe("high");
    expect(toDo.estimate).toBe(15);
    expect(toDo.timeSlot).toEqual({ start: 840, end: 855 });
  });

  it("overrides the 'When' of the list it is created from", () => {
    const id = app.createFromQuickEntry("Buy milk tomorrow", {
      placement: { when: { kind: "today" } },
    });
    expect(app.getToDo(id!).startDate).toBe(TOMORROW);
    const kept = app.createFromQuickEntry("Buy milk", { placement: { when: { kind: "today" } } });
    expect(app.getToDo(kept!).startDate).toBe(TODAY);
  });

  it("creates nothing when only a date phrase is typed", () => {
    expect(app.createFromQuickEntry("tomorrow")).toBeNull();
  });

  it("works the date out from the clock at the time", () => {
    const { app: later, clock } = setup();
    clock.set("2026-12-31T22:00:00");
    const id = later.createFromQuickEntry("Party tomorrow");
    expect(later.getToDo(id!).startDate).toBe("2027-01-01");
  });
});

describe("previewing and keeping date phrases as text", () => {
  it("shows a date phrase as one token with what it sets", () => {
    const preview = app.previewQuickEntry("Call Sam on next fri !high");
    expect(preview.title).toBe("Call Sam");
    expect(preview.tokens.map((t) => [t.text, t.start, t.value])).toEqual([
      ["on next fri", 9, { kind: "when", when: { kind: "date", date: "2026-11-27" } }],
      ["!high", 21, { kind: "priority", priority: "high" }],
    ]);
  });

  it("keeps every word of a tapped-away phrase as text", () => {
    const text = "Call Sam next fri";
    const id = app.createFromQuickEntry(text, { ignored: [text.indexOf("next")] });
    const toDo = app.getToDo(id!);
    expect(toDo.title).toBe(text);
    expect(toDo.startDate).toBeNull();
  });

  it("lets an earlier date phrase count once the last one is kept as text", () => {
    const text = "Fix it today or in 3 days";
    const id = app.createFromQuickEntry(text, { ignored: [text.indexOf("in 3")] });
    const toDo = app.getToDo(id!);
    expect(toDo.title).toBe("Fix it or in 3 days");
    expect(toDo.startDate).toBe(TODAY);
  });
});
