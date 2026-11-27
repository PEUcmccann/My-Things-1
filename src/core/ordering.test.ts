import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings } from "./index";
import { NOW, setup, TODAY } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const inbox = () => titles(app.inbox());

function inboxOf(...names: string[]): string[] {
  return names.map((title) => app.createToDo({ title }));
}

describe("reordering", () => {
  it("new To-dos go to the end", () => {
    inboxOf("A", "B", "C");
    expect(inbox()).toEqual(["A", "B", "C"]);
  });

  it("moves a To-do before another", () => {
    const [a, b, c] = inboxOf("A", "B", "C");
    app.placeToDo({ kind: "inbox" }, c, a);
    expect(inbox()).toEqual(["C", "A", "B"]);
    app.placeToDo({ kind: "inbox" }, c, b);
    expect(inbox()).toEqual(["A", "C", "B"]);
  });

  it("moves a To-do to the end", () => {
    const [a] = inboxOf("A", "B", "C");
    app.placeToDo({ kind: "inbox" }, a, null);
    expect(inbox()).toEqual(["B", "C", "A"]);
  });

  it("keeps the order through many moves into the same gap", () => {
    const [, b] = inboxOf("A", "B");
    const added: string[] = [];
    let before = b;
    for (let i = 0; i < 80; i++) {
      const id = app.createToDo({ title: `X${i}` });
      app.placeToDo({ kind: "inbox" }, id, before);
      before = id;
      added.unshift(`X${i}`);
    }
    expect(inbox()).toEqual(["A", ...added, "B"]);
  });

  it("keeps the order after a reload", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const first = createMyThings({ clock, store });
    const a = first.createToDo({ title: "A" });
    first.createToDo({ title: "B" });
    first.placeToDo({ kind: "inbox" }, a, null);
    const again = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(titles(again.inbox())).toEqual(["B", "A"]);
  });

  it("gives Today its own order, separate from the Project's", () => {
    const project = app.createProject({ title: "Move house" });
    const a = app.createToDo({ title: "A", projectId: project, when: { kind: "today" } });
    const b = app.createToDo({ title: "B", projectId: project, when: { kind: "today" } });
    app.placeToDo({ kind: "today", part: "main" }, b, a);
    expect(titles(app.today().main)).toEqual(["B", "A"]);
    expect(titles(app.projectToDos(project))).toEqual(["A", "B"]);
  });

  it("orders This Evening on its own", () => {
    const a = app.createToDo({ title: "A", when: { kind: "thisEvening" } });
    const b = app.createToDo({ title: "B", when: { kind: "thisEvening" } });
    app.placeToDo({ kind: "today", part: "thisEvening" }, b, a);
    expect(titles(app.today().thisEvening)).toEqual(["B", "A"]);
  });

  it("orders To-dos under a Heading", () => {
    const project = app.createProject({ title: "Move house" });
    const heading = app.createHeading(project, "Packing");
    const a = app.createToDo({ title: "A", headingId: heading });
    const b = app.createToDo({ title: "B", headingId: heading });
    app.placeToDo({ kind: "heading", id: heading }, b, a);
    expect(titles(app.projectContents(project).headings[0].toDos)).toEqual(["B", "A"]);
  });
});

describe("inserting at a position", () => {
  it("creates a To-do at exactly the spot it was dropped", () => {
    const [, b] = inboxOf("A", "B");
    app.createToDo({ title: "New", at: { list: { kind: "inbox" }, beforeId: b } });
    expect(inbox()).toEqual(["A", "New", "B"]);
  });

  it("creates a To-do at a spot in a Heading, filed under it", () => {
    const project = app.createProject({ title: "Move house" });
    const heading = app.createHeading(project, "Packing");
    const a = app.createToDo({ title: "A", headingId: heading });
    const id = app.createToDo({
      title: "New",
      at: { list: { kind: "heading", id: heading }, beforeId: a },
    });
    expect(app.getToDo(id).headingId).toBe(heading);
    expect(titles(app.projectContents(project).headings[0].toDos)).toEqual(["New", "A"]);
  });

  it("creates a To-do at a spot in Today, with today's Start date", () => {
    const a = app.createToDo({ title: "A", when: { kind: "today" } });
    const id = app.createToDo({
      title: "New",
      at: { list: { kind: "today", part: "main" }, beforeId: a },
    });
    expect(app.getToDo(id).startDate).toBe(TODAY);
    expect(titles(app.today().main)).toEqual(["New", "A"]);
  });
});

describe("moving between lists", () => {
  it("dropping a To-do into another list's spot files it there", () => {
    const project = app.createProject({ title: "Move house" });
    const a = app.createToDo({ title: "A", projectId: project });
    const id = app.createToDo({ title: "From the Inbox" });
    app.placeToDo({ kind: "project", id: project }, id, a);
    expect(inbox()).toEqual([]);
    expect(titles(app.projectToDos(project))).toEqual(["From the Inbox", "A"]);
  });

  it("dropping into This Evening moves it there", () => {
    const id = app.createToDo({ title: "A", when: { kind: "today" } });
    app.placeToDo({ kind: "today", part: "thisEvening" }, id, null);
    expect(titles(app.today().thisEvening)).toEqual(["A"]);
  });

  it("dropping on the Inbox, an Area, a Project or a Heading files it there", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Move house" });
    const heading = app.createHeading(project, "Packing");
    const id = app.createToDo({ title: "Thing", projectId: project });
    app.dropToDo(id, { kind: "area", id: area });
    expect(titles(app.areaContents(area).toDos)).toEqual(["Thing"]);
    app.dropToDo(id, { kind: "heading", id: heading });
    expect(app.getToDo(id)).toMatchObject({ projectId: project, headingId: heading });
    app.dropToDo(id, { kind: "inbox" });
    expect(inbox()).toEqual(["Thing"]);
  });

  it("a dropped To-do lands at the end of its new list", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "First made" });
    app.createToDo({ title: "Already there", projectId: project });
    app.dropToDo(id, { kind: "project", id: project });
    expect(titles(app.projectToDos(project))).toEqual(["Already there", "First made"]);
  });

  it("dropping on Today sets the Start date to today", () => {
    const id = app.createToDo({ title: "Thing" });
    app.dropToDo(id, { kind: "today" });
    expect(app.getToDo(id).startDate).toBe(TODAY);
  });

  it("does not file a Sub-to-do on its own", () => {
    const parent = app.createToDo({ title: "Parent" });
    const child = app.createToDo({ title: "Child", parentId: parent });
    const project = app.createProject({ title: "Move house" });
    expect(() => app.dropToDo(child, { kind: "project", id: project })).toThrow();
    app.dropToDo(child, { kind: "today" });
    expect(app.getToDo(child).startDate).toBe(TODAY);
  });
});

describe("sidebar order", () => {
  it("reorders Areas", () => {
    const a = app.createArea("A");
    app.createArea("B");
    app.placeArea(a, null);
    expect(app.areas().map((x) => x.title)).toEqual(["B", "A"]);
  });

  it("reorders Projects and moves them between Areas", () => {
    const area = app.createArea("Home");
    const p1 = app.createProject({ title: "P1" });
    const p2 = app.createProject({ title: "P2" });
    app.placeProject(p2, null, p1);
    expect(app.sidebar().projects.map((p) => p.title)).toEqual(["P2", "P1"]);
    app.placeProject(p1, area, null);
    expect(app.sidebar().areas[0].projects.map((p) => p.title)).toEqual(["P1"]);
    expect(app.sidebar().projects.map((p) => p.title)).toEqual(["P2"]);
  });
});
