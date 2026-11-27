import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

// The fixed clock says Thursday 26 November 2026.
let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

function repeatingToDo(title = "Water plants"): string {
  const id = app.createToDo({ title, when: { kind: "today" } });
  app.setRepeat(id, { freq: "daily", interval: 1 });
  return id;
}

/** Completes the current occurrence (and its Sub-to-dos) and returns the next one's id. */
function completeAndNext(id: string): string {
  app.complete(id, { remaining: "complete" });
  const next = app.currentOccurrence(id);
  if (!next) throw new Error("No next occurrence");
  return next.id;
}

/** An edit to one copied field, and how to read that field back. */
interface FieldCase {
  name: string;
  edit: (id: string) => void;
  read: (id: string) => unknown;
  original: unknown;
  changed: unknown;
}

const fieldCases: FieldCase[] = [
  {
    name: "notes",
    edit: (id) => app.editToDo(id, { notes: "Use rainwater" }),
    read: (id) => app.getToDo(id).notes,
    original: "",
    changed: "Use rainwater",
  },
  {
    name: "Priority",
    edit: (id) => app.setPriority(id, "high"),
    read: (id) => app.getToDo(id).priority,
    original: "none",
    changed: "high",
  },
  {
    name: "Energy",
    edit: (id) => app.setEnergy(id, "low"),
    read: (id) => app.getToDo(id).energy,
    original: null,
    changed: "low",
  },
  {
    name: "Estimate",
    edit: (id) => app.setEstimate(id, 15),
    read: (id) => app.getToDo(id).estimate,
    original: null,
    changed: 15,
  },
  {
    name: "Time slot",
    edit: (id) => app.setTimeSlot(id, { start: 8 * 60, end: 8 * 60 + 30 }),
    read: (id) => app.getToDo(id).timeSlot,
    original: null,
    changed: { start: 480, end: 510 },
  },
];

describe.each(fieldCases)("$name", ({ edit, read, original, changed }) => {
  it('"this one" changes only the current occurrence', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => edit(id));
    expect(read(id)).toEqual(changed);
    expect(read(completeAndNext(id))).toEqual(original);
  });

  it('"all future ones" changes the current occurrence and every later one', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "allFuture", () => edit(id));
    expect(read(id)).toEqual(changed);
    const next = completeAndNext(id);
    expect(read(next)).toEqual(changed);
    expect(read(completeAndNext(next))).toEqual(changed);
  });
});

describe("the Deadline", () => {
  it('"this one" leaves later occurrences with the series\' Deadline, shifted', () => {
    const id = repeatingToDo();
    app.setDeadline(id, "2026-11-28");
    app.editOccurrence(id, "thisOne", () => app.setDeadline(id, "2026-12-05"));
    expect(app.getToDo(id).deadline).toBe("2026-12-05");
    expect(app.getToDo(completeAndNext(id)).deadline).toBe("2026-11-29");
  });

  it('"this one" adding a Deadline leaves later occurrences without one', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.setDeadline(id, "2026-11-28"));
    expect(app.getToDo(completeAndNext(id)).deadline).toBeNull();
  });

  it('"all future ones" gives every later occurrence the Deadline, shifted', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "allFuture", () => app.setDeadline(id, "2026-11-28"));
    const next = completeAndNext(id);
    expect(app.getToDo(next).deadline).toBe("2026-11-29");
    expect(app.getToDo(completeAndNext(next)).deadline).toBe("2026-11-30");
  });
});

describe("Tags", () => {
  const tagTitles = (id: string) => app.tagsOf({ kind: "toDo", id }).map((t) => t.title);

  it('"this one" adding or removing a Tag leaves later occurrences as the series was', () => {
    const id = repeatingToDo();
    const home = app.createTag("Home");
    const garden = app.createTag("Garden");
    app.addTag({ kind: "toDo", id }, home);
    app.editOccurrence(id, "thisOne", () => {
      app.addTag({ kind: "toDo", id }, garden);
      app.removeTag({ kind: "toDo", id }, home);
    });
    expect(tagTitles(id)).toEqual(["Garden"]);
    expect(tagTitles(completeAndNext(id))).toEqual(["Home"]);
  });

  it('"all future ones" adding or removing a Tag changes every later occurrence', () => {
    const id = repeatingToDo();
    const home = app.createTag("Home");
    const garden = app.createTag("Garden");
    app.addTag({ kind: "toDo", id }, home);
    app.editOccurrence(id, "allFuture", () => {
      app.addTag({ kind: "toDo", id }, garden);
      app.removeTag({ kind: "toDo", id }, home);
    });
    const next = completeAndNext(id);
    expect(tagTitles(next)).toEqual(["Garden"]);
    expect(tagTitles(completeAndNext(next))).toEqual(["Garden"]);
  });

  it('"all future ones" can undo a "this one" Tag change', () => {
    const id = repeatingToDo();
    const home = app.createTag("Home");
    app.editOccurrence(id, "thisOne", () => app.addTag({ kind: "toDo", id }, home));
    app.editOccurrence(id, "allFuture", () => app.removeTag({ kind: "toDo", id }, home));
    app.editOccurrence(id, "allFuture", () => app.addTag({ kind: "toDo", id }, home));
    expect(tagTitles(completeAndNext(id))).toEqual(["Home"]);
  });
});

describe("the Checklist", () => {
  const titles = (id: string) => app.checklist(id).map((c) => c.title);

  /** A repeating To-do with the Checklist "Fill can", "Water", "Feed". */
  function withChecklist(): { id: string; items: string[] } {
    const id = repeatingToDo();
    const items = ["Fill can", "Water", "Feed"].map((t) => app.addChecklistItem(id, t));
    return { id, items };
  }

  /** Adds "Mist leaves", removes "Feed" and renames "Water" to "Water well". */
  function editChecklist(id: string, items: string[]) {
    app.addChecklistItem(id, "Mist leaves");
    app.deleteChecklistItem(items[2]);
    app.renameChecklistItem(items[1], "Water well");
  }

  it('"this one" leaves later occurrences with the Checklist as it was', () => {
    const { id, items } = withChecklist();
    app.editOccurrence(id, "thisOne", () => editChecklist(id, items));
    expect(titles(id)).toEqual(["Fill can", "Water well", "Mist leaves"]);
    expect(titles(completeAndNext(id))).toEqual(["Fill can", "Water", "Feed"]);
  });

  it('"all future ones" copies added and renamed items and drops removed ones', () => {
    const { id, items } = withChecklist();
    app.editOccurrence(id, "allFuture", () => editChecklist(id, items));
    const next = completeAndNext(id);
    expect(titles(next)).toEqual(["Fill can", "Water well", "Mist leaves"]);
    expect(titles(completeAndNext(next))).toEqual(["Fill can", "Water well", "Mist leaves"]);
  });

  it('"all future ones" after "this one" changes the same item for the series', () => {
    const { id, items } = withChecklist();
    app.editOccurrence(id, "thisOne", () => app.renameChecklistItem(items[1], "Water well"));
    app.editOccurrence(id, "allFuture", () => app.deleteChecklistItem(items[1]));
    expect(titles(completeAndNext(id))).toEqual(["Fill can", "Feed"]);
  });

  it('an item added for "this one" and then removed is gone', () => {
    const { id } = withChecklist();
    let added = "";
    app.editOccurrence(id, "thisOne", () => (added = app.addChecklistItem(id, "Mist leaves")));
    app.editOccurrence(id, "thisOne", () => app.deleteChecklistItem(added));
    expect(titles(completeAndNext(id))).toEqual(["Fill can", "Water", "Feed"]);
  });

  it("ticking an item is not a change to the series: the next one starts unticked", () => {
    const { id, items } = withChecklist();
    app.editOccurrence(id, "thisOne", () => app.tickChecklistItem(items[0], true));
    const next = completeAndNext(id);
    expect(app.checklist(next).map((c) => c.ticked)).toEqual([false, false, false]);
  });
});

describe("Sub-to-dos", () => {
  const titles = (id: string) => app.subToDos(id).map((t) => t.title);

  /** A repeating To-do with the Sub-to-dos "Front garden", "Balcony", "Kitchen". */
  function withSubToDos(): { id: string; children: string[] } {
    const id = repeatingToDo();
    const children = ["Front garden", "Balcony", "Kitchen"].map((title) =>
      app.createToDo({ title, parentId: id }),
    );
    return { id, children };
  }

  /** Adds "Bathroom", removes "Kitchen" and renames "Balcony" to "Roof terrace". */
  function editSubToDos(id: string, children: string[]) {
    app.createToDo({ title: "Bathroom", parentId: id });
    app.delete(children[2]);
    app.editToDo(children[1], { title: "Roof terrace" });
  }

  it('"this one" leaves later occurrences with the Sub-to-dos as they were', () => {
    const { id, children } = withSubToDos();
    app.editOccurrence(id, "thisOne", () => editSubToDos(id, children));
    expect(titles(id)).toEqual(["Front garden", "Roof terrace", "Bathroom"]);
    expect(titles(completeAndNext(id))).toEqual(["Front garden", "Balcony", "Kitchen"]);
  });

  it('"this one" keeps a removed Sub-to-do for the series after the Trash is emptied', () => {
    const { id, children } = withSubToDos();
    app.editOccurrence(id, "thisOne", () => app.delete(children[2]));
    app.emptyTrash();
    expect(titles(completeAndNext(id))).toEqual(["Front garden", "Balcony", "Kitchen"]);
  });

  it('"all future ones" copies added and renamed Sub-to-dos and drops removed ones', () => {
    const { id, children } = withSubToDos();
    app.editOccurrence(id, "allFuture", () => editSubToDos(id, children));
    const next = completeAndNext(id);
    expect(titles(next)).toEqual(["Front garden", "Roof terrace", "Bathroom"]);
    expect(titles(completeAndNext(next))).toEqual(["Front garden", "Roof terrace", "Bathroom"]);
  });

  it("an edit inside a Sub-to-do's own detail carries over as it is", () => {
    const { id, children } = withSubToDos();
    app.editToDo(children[0], { title: "Back garden" });
    app.addChecklistItem(children[0], "Hose");
    const next = completeAndNext(id);
    expect(titles(next)).toEqual(["Back garden", "Balcony", "Kitchen"]);
    expect(app.checklist(app.subToDos(next)[0].id).map((c) => c.title)).toEqual(["Hose"]);
  });
});

describe("reopening the latest occurrence", () => {
  it('keeps its "this one" changes for when it is completed again', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.complete(id);
    app.reopen(id);
    expect(app.getToDo(completeAndNext(id)).title).toBe("Water plants");
  });
});

describe("removing the Repeat rule", () => {
  it("ends the series; the current To-do stays as a normal To-do, as edited", () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.setRepeat(id, null);
    expect(app.asksThisOneOrAllFuture(id)).toBe(false);
    expect(app.currentOccurrence(id)).toBeUndefined();
    app.complete(id);
    expect(app.currentOccurrence(id)).toBeUndefined();
    expect(app.getToDo(id)).toMatchObject({ title: "Water the ferns", outcome: "completed" });
  });

  it('a new rule starts a fresh series, without earlier "this one" changes', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.setRepeat(id, null);
    app.setRepeat(id, { freq: "daily", interval: 1 });
    expect(app.getToDo(completeAndNext(id)).title).toBe("Water the ferns");
  });
});

describe("changing the Repeat rule", () => {
  it('applies to all future occurrences and keeps "this one" changes', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.setRepeat(id, { freq: "weekly", interval: 1, byDay: ["TH"] });
    const next = app.getToDo(completeAndNext(id));
    expect(next).toMatchObject({ title: "Water plants", startDate: "2026-12-03" });
  });
});

describe("Upcoming's projected entries", () => {
  const projected = () =>
    app
      .upcoming()
      .flatMap((g) => g.entries)
      .filter((e) => e.kind === "projected")
      .map((e) => (e.kind === "projected" ? `${e.toDo.title} ${e.date}` : ""));

  it('show later occurrences as the series is, without "this one" changes', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    expect(projected()[0]).toBe("Water plants 2026-11-27");
    app.editOccurrence(id, "allFuture", () => app.editToDo(id, { title: "Water the cacti" }));
    expect(projected()[0]).toBe("Water the cacti 2026-11-27");
  });

  it('carry the series\' Tags, without "this one" changes', () => {
    const id = repeatingToDo();
    const home = app.createTag("Home");
    const garden = app.createTag("Garden");
    app.addTag({ kind: "toDo", id }, home);
    app.editOccurrence(id, "thisOne", () => {
      app.removeTag({ kind: "toDo", id }, home);
      app.addTag({ kind: "toDo", id }, garden);
    });
    const tagNames = () =>
      app
        .upcoming()
        .flatMap((g) => g.entries)
        .flatMap((e) => (e.kind === "projected" ? [e.tags.map((t) => t.title)] : []));
    expect(tagNames()[0]).toEqual(["Home"]);
    const outdoors = app.createTag("Outdoors");
    app.editOccurrence(id, "allFuture", () => app.addTag({ kind: "toDo", id }, outdoors));
    expect(tagNames()[0]).toEqual(["Outdoors", "Home"]);
  });
});

describe("which edits ask", () => {
  it("only the current occurrence of a repeating To-do asks", () => {
    const id = repeatingToDo();
    const child = app.createToDo({ title: "Balcony", parentId: id });
    const plain = app.createToDo({ title: "Buy soil" });
    expect(app.asksThisOneOrAllFuture(id)).toBe(true);
    expect(app.asksThisOneOrAllFuture(child)).toBe(false);
    expect(app.asksThisOneOrAllFuture(plain)).toBe(false);
    app.complete(id, { remaining: "complete" });
    expect(app.asksThisOneOrAllFuture(id)).toBe(false);
  });

  it("an edit to several To-dos applies one choice to each repeating one", () => {
    const a = repeatingToDo("Water plants");
    const b = repeatingToDo("Feed the cat");
    const plain = app.createToDo({ title: "Buy soil" });
    app.editOccurrences([a, b, plain], "thisOne", () => app.setPriorityMany([a, b, plain], "high"));
    expect([a, b, plain].map((id) => app.getToDo(id).priority)).toEqual(["high", "high", "high"]);
    expect(app.getToDo(completeAndNext(a)).priority).toBe("none");
    expect(app.getToDo(completeAndNext(b)).priority).toBe("none");
  });

  it('an edit to several To-dos for "all future ones" carries over to each', () => {
    const a = repeatingToDo("Water plants");
    const b = repeatingToDo("Feed the cat");
    const home = app.createTag("Home");
    app.editOccurrences([a, b], "allFuture", () => app.addTagsMany([a, b], [home]));
    expect(app.getToDo(completeAndNext(a)).tagIds).toEqual([home]);
    expect(app.getToDo(completeAndNext(b)).tagIds).toEqual([home]);
  });

  it("a To-do that doesn't repeat is just edited", () => {
    const id = app.createToDo({ title: "Buy soil" });
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Buy compost" }));
    expect(app.getToDo(id).title).toBe("Buy compost");
  });

  it("moving the To-do or its Start date doesn't change what the series copies", () => {
    const id = repeatingToDo();
    const area = app.createArea("Home");
    app.moveToDo(id, { kind: "area", id: area });
    app.setStartDate(id, "2026-11-27");
    const next = app.getToDo(completeAndNext(id));
    expect(next).toMatchObject({ areaId: area, startDate: "2026-11-28" });
  });
});

describe("mixing the two choices", () => {
  it('an "all future ones" edit keeps an earlier "this one" edit to another field', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.editOccurrence(id, "allFuture", () => app.setPriority(id, "high"));
    const next = app.getToDo(completeAndNext(id));
    expect(next).toMatchObject({ title: "Water plants", priority: "high" });
  });

  it('an "all future ones" edit to the same field replaces the series\' value', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.editOccurrence(id, "allFuture", () => app.editToDo(id, { title: "Water the cacti" }));
    expect(app.getToDo(completeAndNext(id)).title).toBe("Water the cacti");
  });

  it('a second "this one" edit keeps the series\' original value', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the cacti" }));
    expect(app.getToDo(completeAndNext(id)).title).toBe("Water plants");
  });

  it("an edit outside either choice carries over as it is", () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.setPriority(id, "high"));
    app.editToDo(id, { notes: "Use rainwater" });
    const next = app.getToDo(completeAndNext(id));
    expect(next).toMatchObject({ priority: "none", notes: "Use rainwater" });
  });
});

describe("the title", () => {
  it('"this one" changes only the current occurrence', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "thisOne", () => app.editToDo(id, { title: "Water the ferns" }));
    expect(app.getToDo(id).title).toBe("Water the ferns");
    expect(app.getToDo(completeAndNext(id)).title).toBe("Water plants");
  });

  it('"all future ones" changes the current occurrence and every later one', () => {
    const id = repeatingToDo();
    app.editOccurrence(id, "allFuture", () => app.editToDo(id, { title: "Water the ferns" }));
    const next = completeAndNext(id);
    expect(app.getToDo(next).title).toBe("Water the ferns");
    expect(app.getToDo(completeAndNext(next)).title).toBe("Water the ferns");
  });
});
