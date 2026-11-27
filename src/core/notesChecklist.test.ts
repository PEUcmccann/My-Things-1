import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

let app: MyThings;
let toDo: string;

beforeEach(() => {
  ({ app } = setup());
  toDo = app.createToDo({ title: "Pack for the trip" });
});

const checklist = () => app.checklist(toDo).map((c) => `${c.ticked ? "x" : " "} ${c.title}`);

describe("notes", () => {
  it("can be written on a To-do", () => {
    app.editToDo(toDo, { notes: "**Passport** and [tickets](https://example.com)" });
    expect(app.getToDo(toDo).notes).toBe("**Passport** and [tickets](https://example.com)");
  });

  it("can be written on a Project", () => {
    const project = app.createProject({ title: "Japan" });
    app.setProjectNotes(project, "# Ideas");
    expect(app.getProject(project).notes).toBe("# Ideas");
  });

  it("start empty", () => {
    expect(app.getToDo(toDo).notes).toBe("");
  });
});

describe("Checklist items", () => {
  it("are added in order and start unticked", () => {
    app.addChecklistItem(toDo, "Passport");
    app.addChecklistItem(toDo, "Charger");
    expect(checklist()).toEqual(["  Passport", "  Charger"]);
  });

  it("can be ticked and unticked", () => {
    const id = app.addChecklistItem(toDo, "Passport");
    app.tickChecklistItem(id, true);
    expect(checklist()).toEqual(["x Passport"]);
    app.tickChecklistItem(id, false);
    expect(checklist()).toEqual(["  Passport"]);
  });

  it("can be renamed and deleted", () => {
    const a = app.addChecklistItem(toDo, "Pasport");
    const b = app.addChecklistItem(toDo, "Charger");
    app.renameChecklistItem(a, "Passport");
    app.deleteChecklistItem(b);
    expect(checklist()).toEqual(["  Passport"]);
  });

  it("can be reordered", () => {
    const a = app.addChecklistItem(toDo, "Passport");
    app.addChecklistItem(toDo, "Charger");
    const c = app.addChecklistItem(toDo, "Socks");
    app.moveChecklistItem(c, 0);
    expect(checklist()).toEqual(["  Socks", "  Passport", "  Charger"]);
    app.moveChecklistItem(a, 2);
    expect(checklist()).toEqual(["  Socks", "  Charger", "  Passport"]);
  });

  it("keep their order after more are added", () => {
    app.addChecklistItem(toDo, "Passport");
    const b = app.addChecklistItem(toDo, "Charger");
    app.moveChecklistItem(b, 0);
    app.addChecklistItem(toDo, "Socks");
    expect(checklist()).toEqual(["  Charger", "  Passport", "  Socks"]);
  });

  it("belong to one To-do only", () => {
    const other = app.createToDo({ title: "Other" });
    app.addChecklistItem(toDo, "Passport");
    app.addChecklistItem(other, "Milk");
    expect(checklist()).toEqual(["  Passport"]);
  });

  it("report progress as ticked out of all", () => {
    const a = app.addChecklistItem(toDo, "Passport");
    app.addChecklistItem(toDo, "Charger");
    app.tickChecklistItem(a, true);
    expect(app.checklistProgress(toDo)).toEqual({ ticked: 1, total: 2 });
  });

  it("have only a title and a ticked state", () => {
    const id = app.addChecklistItem(toDo, "Passport");
    const item = app.checklist(toDo).find((c) => c.id === id)!;
    expect(item).not.toHaveProperty("startDate");
    expect(item).not.toHaveProperty("deadline");
    expect(item).not.toHaveProperty("tagIds");
  });

  it("are removed for good with their To-do", () => {
    app.addChecklistItem(toDo, "Passport");
    app.delete(toDo);
    app.emptyTrash();
    expect(app.checklist(toDo)).toEqual([]);
  });
});
