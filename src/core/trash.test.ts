import { beforeEach, describe, expect, it } from "vitest";
import type { fixedClock, MyThings } from "./index";
import { setup, TODAY } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const inboxTitles = () => titles(app.inbox());
const trashTitles = () =>
  app.trash().map((e) => (e.kind === "toDo" ? e.toDo.title : `Project: ${e.project.title}`));

describe("deleting", () => {
  it("moves a To-do to the Trash and out of every other list", () => {
    const id = app.createToDo({ title: "Old idea" });
    app.setDeadline(id, TODAY);
    app.delete(id);
    expect(trashTitles()).toEqual(["Old idea"]);
    expect(inboxTitles()).toEqual([]);
    expect(app.today().main).toEqual([]);
  });

  it("moves a Project and its To-dos to the Trash together", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.setWhen(id, { kind: "today" });
    app.deleteProject(project);
    expect(trashTitles()).toEqual(["Project: Move house"]);
    expect(app.sidebar().projects).toEqual([]);
    expect(app.today().main).toEqual([]);
  });

  it("lists the most recently deleted first", () => {
    const a = app.createToDo({ title: "First" });
    const b = app.createToDo({ title: "Second" });
    app.delete(a);
    clock.set("2026-11-26T11:00:00");
    app.delete(b);
    expect(trashTitles()).toEqual(["Second", "First"]);
  });
});

describe("restoring", () => {
  it("puts a To-do back where it was", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.delete(id);
    app.restore(id);
    expect(trashTitles()).toEqual([]);
    expect(titles(app.projectToDos(project))).toEqual(["Book van"]);
  });

  it("sends a To-do to the Inbox when its Project has gone", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.delete(id);
    app.deleteProject(project);
    app.emptyTrash();
    expect(() => app.getToDo(id)).toThrow();

    const other = app.createProject({ title: "Garden" });
    const kept = app.createToDo({ title: "Plant bulbs", projectId: other });
    app.delete(kept);
    app.deleteProject(other);
    app.restore(kept);
    expect(inboxTitles()).toEqual(["Plant bulbs"]);
  });

  it("sends a To-do to the Inbox when its Area has been deleted", () => {
    const area = app.createArea("Home");
    const id = app.createToDo({ title: "Fix the tap", areaId: area });
    app.delete(id);
    app.deleteArea(area);
    app.restore(id);
    expect(inboxTitles()).toEqual(["Fix the tap"]);
  });

  it("brings a Project back with the To-dos deleted with it", () => {
    const project = app.createProject({ title: "Move house" });
    app.createToDo({ title: "Book van", projectId: project });
    app.deleteProject(project);
    app.restoreProject(project);
    expect(titles(app.projectToDos(project))).toEqual(["Book van"]);
    expect(app.sidebar().projects.map((p) => p.title)).toEqual(["Move house"]);
  });

  it("does not bring back a To-do deleted on its own before its Project", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.createToDo({ title: "Pack books", projectId: project });
    app.delete(id);
    app.deleteProject(project);
    app.restoreProject(project);
    expect(titles(app.projectToDos(project))).toEqual(["Pack books"]);
    expect(trashTitles()).toEqual(["Book van"]);
  });
});

describe("expiry", () => {
  it("keeps items for 30 days", () => {
    const id = app.createToDo({ title: "Old idea" });
    app.delete(id);
    clock.set("2026-12-26T09:00:00");
    app.purgeExpiredTrash();
    expect(trashTitles()).toEqual(["Old idea"]);
  });

  it("removes items deleted more than 30 days ago for good", () => {
    const old = app.createToDo({ title: "Old idea" });
    app.delete(old);
    clock.set("2026-12-20T10:00:00");
    const recent = app.createToDo({ title: "Recent idea" });
    app.delete(recent);
    clock.set("2026-12-26T10:00:01");
    app.purgeExpiredTrash();
    expect(trashTitles()).toEqual(["Recent idea"]);
    expect(app.findToDo(old)).toBeUndefined();
  });

  it("removes an expired Project with its To-dos", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.deleteProject(project);
    clock.set("2027-01-01T10:00:00");
    app.purgeExpiredTrash();
    expect(trashTitles()).toEqual([]);
    expect(app.findProject(project)).toBeUndefined();
    expect(app.findToDo(id)).toBeUndefined();
  });
});

describe("emptying the Trash", () => {
  it("removes everything in it for good, and nothing else", () => {
    const keep = app.createToDo({ title: "Keep me" });
    const a = app.createToDo({ title: "Old idea" });
    const project = app.createProject({ title: "Move house" });
    app.delete(a);
    app.deleteProject(project);
    app.emptyTrash();
    expect(trashTitles()).toEqual([]);
    expect(app.findToDo(a)).toBeUndefined();
    expect(app.findProject(project)).toBeUndefined();
    expect(app.getToDo(keep).title).toBe("Keep me");
  });
});
