import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings, QuickFindResults } from "./index";
import { setup } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const summary = (r: QuickFindResults) => ({
  areas: r.areas.map((a) => a.title),
  projects: r.projects.map((p) => p.title),
  headings: r.headings.map((h) => `${h.projectTitle} › ${h.heading.title}`),
  tags: r.tags.map((t) => t.title),
  toDos: r.toDos.map((t) => `${t.toDo.title} [${t.field}]`),
});
const find = (q: string, includeLogbook = false) => summary(app.quickFind(q, { includeLogbook }));
const none = { areas: [], projects: [], headings: [], tags: [], toDos: [] };

describe("Quick Find", () => {
  it("finds nothing for an empty search", () => {
    app.createToDo({ title: "Buy milk" });
    expect(find("  ")).toEqual(none);
  });

  it("searches To-do titles, notes and Checklist items", () => {
    app.createToDo({ title: "Garden shed" });
    const noted = app.createToDo({ title: "Call Sam" });
    app.editToDo(noted, { notes: "Ask about the garden party" });
    const listed = app.createToDo({ title: "Weekend shop" });
    app.addChecklistItem(listed, "Garden gloves");
    app.createToDo({ title: "Unrelated" });
    expect(find("garden").toDos).toEqual([
      "Garden shed [title]",
      "Call Sam [notes]",
      "Weekend shop [checklist]",
    ]);
  });

  it("shows the matching text for notes and Checklist items", () => {
    const id = app.createToDo({ title: "Call Sam" });
    app.editToDo(id, { notes: "Ask about the garden party on Saturday" });
    const match = app.quickFind("party").toDos[0];
    expect(match.excerpt).toContain("garden party");
  });

  it("ignores capitals and accents", () => {
    app.createToDo({ title: "Café visit" });
    app.createToDo({ title: "CAFE MENU" });
    expect(find("cafe").toDos).toEqual(["Café visit [title]", "CAFE MENU [title]"]);
    expect(find("CAFÉ").toDos).toEqual(["Café visit [title]", "CAFE MENU [title]"]);
  });

  it("matches words anywhere, in any order", () => {
    app.createToDo({ title: "Renew the car insurance" });
    expect(find("insurance car").toDos).toEqual(["Renew the car insurance [title]"]);
    expect(find("sura").toDos).toEqual(["Renew the car insurance [title]"]);
    expect(find("car boat").toDos).toEqual([]);
  });

  it("groups Areas, Projects, Headings and Tags", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Home office", areaId: area });
    app.createHeading(project, "Home stretch");
    app.createTag("Homework");
    app.createToDo({ title: "Home insurance" });
    expect(find("home")).toEqual({
      areas: ["Home"],
      projects: ["Home office"],
      headings: ["Home office › Home stretch"],
      tags: ["Homework"],
      toDos: ["Home insurance [title]"],
    });
  });

  it("leaves out Logbook items unless asked", () => {
    app.setLogbookMode("immediately");
    const id = app.createToDo({ title: "Paid the rent" });
    app.complete(id);
    const project = app.createProject({ title: "Rent a flat" });
    app.completeProject(project);
    expect(find("rent").toDos).toEqual([]);
    expect(find("rent").projects).toEqual([]);
    expect(find("rent", true).toDos).toEqual(["Paid the rent [title]"]);
    expect(find("rent", true).projects).toEqual(["Rent a flat"]);
  });

  it("never includes the Trash", () => {
    const id = app.createToDo({ title: "Old idea" });
    app.delete(id);
    const project = app.createProject({ title: "Old project" });
    app.createHeading(project, "Old heading");
    app.createToDo({ title: "Old To-do in project", projectId: project });
    app.deleteProject(project);
    expect(find("old", true)).toEqual(none);
  });
});
