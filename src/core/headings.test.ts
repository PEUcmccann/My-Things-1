import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

let app: MyThings;
let project: string;

beforeEach(() => {
  ({ app } = setup());
  project = app.createProject({ title: "Move house" });
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const screen = (id = project) => {
  const c = app.projectContents(id);
  return {
    loose: titles(c.toDos),
    headings: c.headings.map((h) => [h.heading.title, titles(h.toDos)]),
  };
};

describe("Headings", () => {
  it("can be added and renamed", () => {
    const id = app.createHeading(project, "Packing");
    app.renameHeading(id, "Boxes");
    expect(app.headings(project).map((h) => h.title)).toEqual(["Boxes"]);
  });

  it("show To-dos without a Heading first, then each Heading in order", () => {
    const packing = app.createHeading(project, "Packing");
    const moving = app.createHeading(project, "Moving day");
    app.createToDo({ title: "Book van", headingId: moving });
    app.createToDo({ title: "Buy boxes", headingId: packing });
    app.createToDo({ title: "Tell the bank", projectId: project });
    expect(screen()).toEqual({
      loose: ["Tell the bank"],
      headings: [
        ["Packing", ["Buy boxes"]],
        ["Moving day", ["Book van"]],
      ],
    });
  });

  it("a To-do created under a Heading is filed in its Project", () => {
    const packing = app.createHeading(project, "Packing");
    const id = app.createToDo({ title: "Buy boxes", headingId: packing });
    expect(app.getToDo(id)).toMatchObject({ projectId: project, headingId: packing });
    expect(app.inbox()).toEqual([]);
  });
});

describe("moving To-dos and Headings", () => {
  it("moves a To-do under a Heading, including from another Project", () => {
    const other = app.createProject({ title: "Garden" });
    const id = app.createToDo({ title: "Buy boxes", projectId: other });
    const packing = app.createHeading(project, "Packing");
    app.moveToDo(id, { kind: "heading", id: packing });
    expect(screen()).toEqual({ loose: [], headings: [["Packing", ["Buy boxes"]]] });
    expect(screen(other)).toEqual({ loose: [], headings: [] });
  });

  it("moving a To-do to a different Project clears its Heading", () => {
    const packing = app.createHeading(project, "Packing");
    const id = app.createToDo({ title: "Buy boxes", headingId: packing });
    const other = app.createProject({ title: "Garden" });
    app.moveToDo(id, { kind: "project", id: other });
    expect(app.getToDo(id)).toMatchObject({ projectId: other, headingId: null });
  });

  it("moving a To-do to its own Project takes it out of the Heading", () => {
    const packing = app.createHeading(project, "Packing");
    const id = app.createToDo({ title: "Buy boxes", headingId: packing });
    app.moveToDo(id, { kind: "project", id: project });
    expect(screen()).toEqual({ loose: ["Buy boxes"], headings: [["Packing", []]] });
  });
});

describe("archiving", () => {
  it("is only allowed once every To-do under the Heading is finished", () => {
    const packing = app.createHeading(project, "Packing");
    const a = app.createToDo({ title: "Buy boxes", headingId: packing });
    const b = app.createToDo({ title: "Buy tape", headingId: packing });
    app.complete(a);
    expect(app.canArchiveHeading(packing)).toBe(false);
    expect(() => app.archiveHeading(packing)).toThrow();
    app.cancel(b);
    expect(app.canArchiveHeading(packing)).toBe(true);
  });

  it("hides the Heading and its To-dos from the Project, keeping them in the Logbook", () => {
    const packing = app.createHeading(project, "Packing");
    const a = app.createToDo({ title: "Buy boxes", headingId: packing });
    app.complete(a);
    app.archiveHeading(packing);
    expect(screen()).toEqual({ loose: [], headings: [] });
    expect(
      app.logbook().flatMap((d) => d.entries.map((e) => e.kind === "toDo" && e.toDo.title)),
    ).toEqual(["Buy boxes"]);
  });

  it("reopening one of its To-dos brings the Heading back", () => {
    const packing = app.createHeading(project, "Packing");
    const a = app.createToDo({ title: "Buy boxes", headingId: packing });
    app.complete(a);
    app.archiveHeading(packing);
    app.reopen(a);
    expect(screen()).toEqual({ loose: [], headings: [["Packing", ["Buy boxes"]]] });
  });
});

describe("deleting a Heading", () => {
  it("can keep its To-dos in the Project without a Heading", () => {
    const packing = app.createHeading(project, "Packing");
    app.createToDo({ title: "Buy boxes", headingId: packing });
    app.deleteHeading(packing, { toDos: "keep" });
    expect(screen()).toEqual({ loose: ["Buy boxes"], headings: [] });
  });

  it("can move its To-dos to the Trash", () => {
    const packing = app.createHeading(project, "Packing");
    const id = app.createToDo({ title: "Buy boxes", headingId: packing });
    app.deleteHeading(packing, { toDos: "delete" });
    expect(screen()).toEqual({ loose: [], headings: [] });
    expect(app.trash().map((e) => e.kind === "toDo" && e.toDo.title)).toEqual(["Buy boxes"]);
    app.restore(id);
    expect(screen()).toEqual({ loose: ["Buy boxes"], headings: [] });
  });
});
