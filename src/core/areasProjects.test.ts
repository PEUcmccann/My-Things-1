import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const inboxTitles = () => titles(app.inbox());

describe("Areas", () => {
  it("can be created and renamed", () => {
    const id = app.createArea("Work");
    app.renameArea(id, "Job");
    expect(app.areas().map((a) => a.title)).toEqual(["Job"]);
  });

  it("show their Projects and the To-dos filed directly in them", () => {
    const area = app.createArea("Home");
    app.createProject({ title: "Paint the hall", areaId: area });
    app.createToDo({ title: "Fix the tap", areaId: area });
    const contents = app.areaContents(area);
    expect(contents.projects.map((p) => p.title)).toEqual(["Paint the hall"]);
    expect(titles(contents.toDos)).toEqual(["Fix the tap"]);
  });

  it("do not list a Project's To-dos as filed directly in the Area", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Paint the hall", areaId: area });
    app.createToDo({ title: "Buy paint", projectId: project });
    expect(titles(app.areaContents(area).toDos)).toEqual([]);
  });

  describe("deleting", () => {
    it("moves its To-dos back to the Inbox", () => {
      const area = app.createArea("Home");
      app.createToDo({ title: "Fix the tap", areaId: area });
      app.deleteArea(area);
      expect(inboxTitles()).toEqual(["Fix the tap"]);
      expect(app.areas()).toEqual([]);
    });

    it("keeps its Projects, with no Area", () => {
      const area = app.createArea("Home");
      const project = app.createProject({ title: "Paint the hall", areaId: area });
      app.deleteArea(area);
      expect(app.getProject(project).areaId).toBeNull();
      expect(app.sidebar().projects.map((p) => p.title)).toEqual(["Paint the hall"]);
    });
  });
});

describe("Projects", () => {
  it("can be created on their own or in an Area, renamed and moved", () => {
    const area = app.createArea("Work");
    const own = app.createProject({ title: "Learn Spanish" });
    const inArea = app.createProject({ title: "Launch", areaId: area });
    app.renameProject(own, "Learn Italian");
    app.moveProject(inArea, null);
    app.moveProject(own, area);
    expect(app.sidebar()).toMatchObject({
      projects: [{ title: "Launch" }],
      areas: [{ area: { title: "Work" }, projects: [{ title: "Learn Italian" }] }],
    });
  });

  it("list the To-dos created in them", () => {
    const project = app.createProject({ title: "Move house" });
    app.createToDo({ title: "Book van", projectId: project });
    expect(titles(app.projectToDos(project))).toEqual(["Book van"]);
    expect(inboxTitles()).toEqual([]);
  });

  describe("progress", () => {
    it("counts Completed To-dos out of all of them", () => {
      const project = app.createProject({ title: "Move house" });
      const a = app.createToDo({ title: "Book van", projectId: project });
      app.createToDo({ title: "Pack books", projectId: project });
      app.createToDo({ title: "Clean oven", projectId: project });
      app.complete(a);
      expect(app.projectProgress(project)).toEqual({ completed: 1, total: 3 });
    });

    it("leaves Cancelled To-dos out of both counts", () => {
      const project = app.createProject({ title: "Move house" });
      const a = app.createToDo({ title: "Book van", projectId: project });
      const b = app.createToDo({ title: "Hire piano movers", projectId: project });
      app.complete(a);
      app.cancel(b);
      expect(app.projectProgress(project)).toEqual({ completed: 1, total: 1 });
    });

    it("still counts To-dos that have moved to the Logbook", () => {
      app.setLogbookMode("immediately");
      const project = app.createProject({ title: "Move house" });
      const a = app.createToDo({ title: "Book van", projectId: project });
      app.complete(a);
      expect(app.projectProgress(project)).toEqual({ completed: 1, total: 1 });
      expect(app.projectToDos(project)).toEqual([]);
    });
  });
});

describe("moving To-dos", () => {
  it("filing an Inbox To-do in a Project takes it out of the Inbox", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van" });
    app.moveToDo(id, { kind: "project", id: project });
    expect(inboxTitles()).toEqual([]);
    expect(titles(app.projectToDos(project))).toEqual(["Book van"]);
  });

  it("filing a To-do in an Area takes it out of its Project", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.moveToDo(id, { kind: "area", id: area });
    expect(titles(app.projectToDos(project))).toEqual([]);
    expect(titles(app.areaContents(area).toDos)).toEqual(["Book van"]);
  });

  it("moving a To-do back to the Inbox clears its Project and When", () => {
    const project = app.createProject({ title: "Move house" });
    const id = app.createToDo({ title: "Book van", projectId: project });
    app.setWhen(id, { kind: "today" });
    app.moveToDo(id, { kind: "inbox" });
    expect(inboxTitles()).toEqual(["Book van"]);
    expect(app.today().main).toEqual([]);
  });

  it("a To-do in a Project in an Area is not also filed directly in the Area", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Move house", areaId: area });
    const id = app.createToDo({ title: "Book van", areaId: area, projectId: project });
    expect(app.getToDo(id).areaId).toBeNull();
  });
});

describe("deleting an Area with its contents", () => {
  it("can move its Projects and To-dos to the Trash", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Paint the hall", areaId: area });
    const id = app.createToDo({ title: "Fix the tap", areaId: area });
    app.deleteArea(area, { contents: "trash" });
    expect(app.sidebar().projects).toEqual([]);
    expect(inboxTitles()).toEqual([]);
    expect(app.trash().length).toBe(2);
    app.restore(id);
    app.restoreProject(project);
    expect(inboxTitles()).toEqual(["Fix the tap"]);
    expect(app.getProject(project).areaId).toBeNull();
  });
});
