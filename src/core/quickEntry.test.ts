import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup, TODAY, TOMORROW } from "./testSetup";

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

const tagTitles = (id: string) => app.tagsOf({ kind: "toDo", id }).map((t) => t.title);

describe("quick entry", () => {
  it("creates a To-do with the text as its title when there is no shorthand", () => {
    const toDo = enter("  Buy milk  ");
    expect(toDo.title).toBe("Buy milk");
    expect(toDo.tagIds).toEqual([]);
    expect(toDo.priority).toBe("none");
  });

  it("applies an existing Tag from #name and takes it out of the title", () => {
    const errand = app.createTag("Errand");
    const toDo = enter("Buy milk #errand");
    expect(toDo.title).toBe("Buy milk");
    expect(toDo.tagIds).toEqual([errand]);
    expect(tagTitles(toDo.id)).toEqual(["Errand"]);
  });
});

describe("Tags in quick entry", () => {
  it("matches a Tag ignoring case, reading - and _ as spaces", () => {
    const dayOff = app.createTag("Day off");
    const homeOffice = app.createTag("home office");
    const toDo = enter("Plan #DAY-OFF #Home_Office");
    expect(toDo.tagIds).toEqual([dayOff, homeOffice]);
  });

  it("matches a nested Tag by its own title, the first in Tag-tree order", () => {
    const home = app.createTag("Home");
    const work = app.createTag("Work");
    const homeCalls = app.createTag("Calls", home);
    app.createTag("Calls", work);
    expect(enter("Ring the plumber #calls").tagIds).toEqual([homeCalls]);
  });

  it("matches #parent/child by path", () => {
    const home = app.createTag("Home");
    const work = app.createTag("Work");
    app.createTag("Calls", home);
    const workCalls = app.createTag("Calls", work);
    expect(enter("Ring the client #work/calls").tagIds).toEqual([workCalls]);
  });

  it("creates an unknown Tag on save, with spaces for - and _", () => {
    const toDo = enter("Book flights #day-off");
    expect(tagTitles(toDo.id)).toEqual(["day off"]);
    expect(app.tagTree().map((n) => n.tag.title)).toEqual(["day off"]);
  });

  it("creates the missing levels of a path under the part that exists", () => {
    app.createTag("Home");
    const toDo = enter("Mow the lawn #home/garden/lawn");
    expect(app.tagTree().map((n) => [n.tag.title, n.depth])).toEqual([
      ["Home", 0],
      ["garden", 1],
      ["lawn", 2],
    ]);
    expect(tagTitles(toDo.id)).toEqual(["lawn"]);
  });

  it("applies every Tag, and a repeated Tag once, creating a new one only once", () => {
    const errand = app.createTag("Errand");
    const toDo = enter("Buy milk #errand #shop #Errand #shop");
    expect(tagTitles(toDo.id)).toEqual(["Errand", "shop"]);
    expect(toDo.tagIds[0]).toBe(errand);
    expect(app.tagTree()).toHaveLength(2);
  });

  it.each([
    ["digits only", "Read chapter #1", "Read chapter #1"],
    ["inside a word", "Learn C# basics", "Learn C# basics"],
    ["a lone #", "Press # to dial", "Press # to dial"],
    ["followed by punctuation", "Buy milk #errand, eggs", "Buy milk #errand, eggs"],
    ["an empty path part", "Sort #home//garden", "Sort #home//garden"],
  ])("keeps # as text when it is %s", (_, text, title) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(title);
    expect(toDo.tagIds).toEqual([]);
    expect(app.tagTree()).toEqual([]);
  });
});

describe("Priority in quick entry", () => {
  it.each([
    ["!low", "low"],
    ["!med", "medium"],
    ["!medium", "medium"],
    ["!high", "high"],
    ["!HIGH", "high"],
    ["!Med", "medium"],
  ])("sets the Priority from %s", (token, priority) => {
    const toDo = enter(`Call the bank ${token}`);
    expect(toDo.priority).toBe(priority);
    expect(toDo.title).toBe("Call the bank");
  });

  it.each([
    ["an unknown word", "Fix it !urgent"],
    ["!none", "Fix it !none"],
    ["a sentence ending in !", "Fix it now!"],
    ["a lone !", "Fix it !"],
    ["inside a word", "Fix it!high"],
  ])("keeps ! as text for %s", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.priority).toBe("none");
  });

  it("uses the last Priority and keeps earlier ones as text", () => {
    const toDo = enter("Fix it !low now !high");
    expect(toDo.priority).toBe("high");
    expect(toDo.title).toBe("Fix it !low now");
  });
});

describe("Estimate in quick entry", () => {
  it.each([
    ["~15m", 15],
    ["~90m", 90],
    ["~1h", 60],
    ["~1h30m", 90],
    ["~2H", 120],
  ])("sets the Estimate from %s", (token, minutes) => {
    const toDo = enter(`Write report ${token}`);
    expect(toDo.estimate).toBe(minutes);
    expect(toDo.title).toBe("Write report");
  });

  it.each([
    ["a decimal", "Write report ~1.5h"],
    ["no unit", "Write report ~15"],
    ["no time", "Write report ~0m"],
    ["minutes before hours", "Write report ~30m1h"],
    ["a lone ~", "Write report ~"],
    ["inside a word", "Write report~15m"],
  ])("keeps ~ as text for %s", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.estimate).toBeNull();
  });

  it("uses the last Estimate and keeps earlier ones as text", () => {
    expect(enter("Write ~1h report ~15m").estimate).toBe(15);
    expect(enter("Write ~1h report ~15m").title).toBe("Write ~1h report");
  });
});

describe("Time slot in quick entry", () => {
  // Times are minutes from 00:00.
  const at = (hours: number, minutes = 0) => hours * 60 + minutes;

  it("sets the start and end from @HH:MM-HH:MM", () => {
    const toDo = enter("Stand-up @14:00-14:30");
    expect(toDo.timeSlot).toEqual({ start: at(14), end: at(14, 30) });
    expect(toDo.title).toBe("Stand-up");
  });

  it("gives a To-do with no Start date today's Start date", () => {
    expect(enter("Stand-up @9:15").startDate).toBe(TODAY);
  });

  it("keeps the Start date the To-do is created with", () => {
    const id = app.createFromQuickEntry("Stand-up @9:15", {
      placement: { when: { kind: "date", date: TOMORROW } },
    });
    expect(app.getToDo(id!).startDate).toBe(TOMORROW);
  });

  it("ends 30 minutes after the start with no Estimate", () => {
    expect(enter("Stand-up @9:15").timeSlot).toEqual({ start: at(9, 15), end: at(9, 45) });
    expect(enter("Stand-up @09:15").timeSlot).toEqual({ start: at(9, 15), end: at(9, 45) });
  });

  it("ends one Estimate after the start, wherever the Estimate is typed", () => {
    expect(enter("Stand-up @14:00 ~15m").timeSlot).toEqual({ start: at(14), end: at(14, 15) });
    expect(enter("Stand-up ~1h @14:00").timeSlot).toEqual({ start: at(14), end: at(15) });
  });

  it("cuts the end to 24:00", () => {
    expect(enter("Night shift @23:45 ~1h").timeSlot).toEqual({ start: at(23, 45), end: at(24) });
    expect(enter("Night shift @23:00-24:00").timeSlot).toEqual({ start: at(23), end: at(24) });
  });

  it.each([
    ["an hour past 23", "Call @25:00"],
    ["a start of 24:00", "Call @24:00"],
    ["minutes past 59", "Call @14:60"],
    ["one minute digit", "Call @14:5"],
    ["a 12-hour time", "Call @2pm"],
    ["an end before the start", "Call @14:30-14:00"],
    ["an end at the start", "Call @14:00-14:00"],
    ["an end past 24:00", "Call @23:00-24:30"],
    ["an email address", "Mail jo@example.com"],
    ["a name", "Reply to @sam"],
    ["inside a word", "Call at@14:00"],
  ])("keeps @ as text for %s", (_, text) => {
    const toDo = enter(text);
    expect(toDo.title).toBe(text);
    expect(toDo.timeSlot).toBeNull();
    expect(toDo.startDate).toBeNull();
  });

  it("uses the last Time slot and keeps earlier ones as text", () => {
    const toDo = enter("Call @9:00 or @10:00");
    expect(toDo.timeSlot).toEqual({ start: at(10), end: at(10, 30) });
    expect(toDo.title).toBe("Call @9:00 or");
  });
});

describe("combined shorthand", () => {
  it("sets a Tag, Priority, Estimate and Time slot from one line", () => {
    const toDo = enter("Buy milk #errand !high ~15m @14:00");
    expect(toDo.title).toBe("Buy milk");
    expect(tagTitles(toDo.id)).toEqual(["errand"]);
    expect(toDo.priority).toBe("high");
    expect(toDo.estimate).toBe(15);
    expect(toDo.timeSlot).toEqual({ start: 840, end: 855 });
    expect(toDo.startDate).toBe(TODAY);
  });

  it("finds shorthand anywhere in the title", () => {
    const toDo = enter("!high Buy #errand fresh ~15m milk");
    expect(toDo.title).toBe("Buy fresh milk");
    expect(toDo.priority).toBe("high");
    expect(toDo.estimate).toBe(15);
  });

  it("creates nothing when only shorthand is typed", () => {
    expect(app.createFromQuickEntry("#errand !high")).toBeNull();
    expect(app.tagTree()).toEqual([]);
    expect(app.inbox()).toEqual([]);
  });

  it("files the To-do where it is created, at a spot in the list", () => {
    const first = app.createToDo({ title: "First" });
    const project = app.createProject({ title: "Garden" });
    app.moveToDo(first, { kind: "project", id: project });
    const id = app.createFromQuickEntry("Water plants !low", {
      placement: { projectId: project },
      at: { list: { kind: "project", id: project }, beforeId: first },
    });
    expect(app.projectContents(project).toDos.map((e) => e.toDo.id)).toEqual([id, first]);
    expect(app.getToDo(id!).priority).toBe("low");
  });
});

describe("keeping shorthand as text", () => {
  it("keeps a token at an ignored offset in the title, without its effect", () => {
    const text = "Buy milk #errand !high";
    const preview = app.previewQuickEntry(text);
    const errand = preview.tokens.find((t) => t.text === "#errand")!;
    const id = app.createFromQuickEntry(text, { ignored: [errand.start] });
    const toDo = app.getToDo(id!);
    expect(toDo.title).toBe("Buy milk #errand");
    expect(toDo.tagIds).toEqual([]);
    expect(toDo.priority).toBe("high");
  });

  it("lets an earlier token count once the last one is kept as text", () => {
    const text = "Fix it !low now !high";
    const high = text.indexOf("!high");
    expect(app.previewQuickEntry(text, [high]).tokens.map((t) => t.text)).toEqual(["!low"]);
  });
});

describe("previewing quick entry", () => {
  it("shows the cleaned title and each token, marking new Tags", () => {
    app.createTag("Errand");
    const preview = app.previewQuickEntry("Buy milk #errand #shop !high ~15m @14:00");
    expect(preview.title).toBe("Buy milk");
    expect(preview.tokens.map((t) => [t.text, t.start, t.newTag ?? null])).toEqual([
      ["#errand", 9, false],
      ["#shop", 17, true],
      ["!high", 23, null],
      ["~15m", 29, null],
      ["@14:00", 34, null],
    ]);
  });

  it("changes nothing", () => {
    app.previewQuickEntry("Buy milk #errand");
    expect(app.tagTree()).toEqual([]);
    expect(app.inbox()).toEqual([]);
  });
});
