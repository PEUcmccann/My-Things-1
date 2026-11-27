import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { NEXT_WEEK, setup, TODAY } from "./testSetup";

let app: MyThings;
let a: string;
let b: string;
let parent: string;
let child: string;

beforeEach(() => {
  ({ app } = setup());
  a = app.createToDo({ title: "A" });
  b = app.createToDo({ title: "B" });
  parent = app.createToDo({ title: "Parent" });
  child = app.createToDo({ title: "Child", parentId: parent });
});

const outcome = (id: string) => app.getToDo(id).outcome;

describe("bulk actions on selected To-dos", () => {
  it("move them all, Sub-to-dos staying with their parent", () => {
    const project = app.createProject({ title: "Move house" });
    const other = app.createToDo({ title: "Other parent" });
    const otherChild = app.createToDo({ title: "Other child", parentId: other });
    app.moveMany([a, b, child, parent], { kind: "project", id: project });
    for (const id of [a, b, parent, child]) expect(app.getToDo(id).projectId).toBe(project);
    app.moveMany([otherChild], { kind: "project", id: project });
    expect(app.getToDo(otherChild)).toMatchObject({ projectId: null, parentId: other });
  });

  it("set When on all of them, including Sub-to-dos", () => {
    app.setWhenMany([a, b, child], { kind: "today" });
    for (const id of [a, b, child]) expect(app.getToDo(id).startDate).toBe(TODAY);
    expect(app.getToDo(parent).startDate).toBeNull();
  });

  it("set the Deadline on all of them", () => {
    app.setDeadlineMany([a, child], NEXT_WEEK);
    expect([a, child].map((id) => app.getToDo(id).deadline)).toEqual([NEXT_WEEK, NEXT_WEEK]);
  });

  it("add Tags to all of them, keeping the Tags they had", () => {
    const home = app.createTag("Home");
    const urgent = app.createTag("Urgent");
    app.addTag({ kind: "toDo", id: a }, home);
    app.addTagsMany([a, child], [urgent]);
    expect(app.tagsOf({ kind: "toDo", id: a }).map((t) => t.title)).toEqual(["Home", "Urgent"]);
    expect(app.tagsOf({ kind: "toDo", id: child }).map((t) => t.title)).toEqual(["Urgent"]);
  });

  it("complete all of them", () => {
    app.completeMany([a, b]);
    expect([a, b].map(outcome)).toEqual(["completed", "completed"]);
  });

  it("complete a parent and its Sub-to-do together without asking", () => {
    expect(app.bulkNeedsRemainingChoice([parent, child])).toBe(false);
    app.completeMany([parent, child]);
    expect([parent, child].map(outcome)).toEqual(["completed", "completed"]);
  });

  it("ask what to do with Sub-to-dos that were not selected", () => {
    expect(app.bulkNeedsRemainingChoice([a, parent])).toBe(true);
    expect(() => app.completeMany([a, parent])).toThrow();
    expect(outcome(a)).toBe("active");
    app.completeMany([a, parent], { remaining: "cancel" });
    expect([a, parent, child].map(outcome)).toEqual(["completed", "completed", "cancelled"]);
  });

  it("cancel all of them", () => {
    app.cancelMany([a, child]);
    expect([a, child, parent].map(outcome)).toEqual(["cancelled", "cancelled", "active"]);
  });

  it("delete all of them to the Trash", () => {
    app.deleteMany([a, parent, child]);
    const trashed = app.trash().map((e) => (e.kind === "toDo" ? e.toDo.title : ""));
    expect(trashed.sort()).toEqual(["A", "Parent"]);
    expect(app.isInTrash(child)).toBe(true);
    expect(app.inbox().map((e) => e.toDo.title)).toEqual(["B"]);
  });
});
