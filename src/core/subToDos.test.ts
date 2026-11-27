import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup, TODAY } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);

describe("Sub-to-dos", () => {
  it("are listed under their parent", () => {
    const parent = app.createToDo({ title: "Plan trip" });
    app.createToDo({ title: "Book flights", parentId: parent });
    app.createToDo({ title: "Book hotel", parentId: parent });
    expect(app.subToDos(parent).map((t) => t.title)).toEqual(["Book flights", "Book hotel"]);
  });

  it("are one level deep only", () => {
    const parent = app.createToDo({ title: "Plan trip" });
    const child = app.createToDo({ title: "Book flights", parentId: parent });
    expect(() => app.createToDo({ title: "Compare prices", parentId: child })).toThrow();
  });

  it("have their own Start date and Deadline", () => {
    const parent = app.createToDo({ title: "Plan trip" });
    const child = app.createToDo({ title: "Book flights", parentId: parent });
    app.setWhen(child, { kind: "today" });
    app.setDeadline(child, TODAY);
    expect(app.getToDo(parent)).toMatchObject({ startDate: null, deadline: null });
    expect(app.getToDo(child)).toMatchObject({ startDate: TODAY, deadline: TODAY });
  });

  it("appear in lists on their own, labelled with the parent", () => {
    const area = app.createArea("Travel");
    const parent = app.createToDo({ title: "Plan trip", areaId: area });
    app.createToDo({ title: "Book flights", parentId: parent });
    expect(app.anytime().map((e) => [e.toDo.title, e.parentTitle])).toEqual([
      ["Plan trip", null],
      ["Book flights", "Plan trip"],
    ]);
  });

  describe("placement", () => {
    it("sit in the parent's Project and Heading", () => {
      const project = app.createProject({ title: "Japan" });
      const heading = app.createHeading(project, "Before");
      const parent = app.createToDo({ title: "Plan trip", headingId: heading });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      expect(app.getToDo(child)).toMatchObject({ projectId: project, headingId: heading });
    });

    it("move with their parent", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      const project = app.createProject({ title: "Japan" });
      const heading = app.createHeading(project, "Before");
      app.moveToDo(parent, { kind: "heading", id: heading });
      expect(app.getToDo(child)).toMatchObject({ projectId: project, headingId: heading });
      const area = app.createArea("Travel");
      app.moveToDo(parent, { kind: "area", id: area });
      expect(app.getToDo(child)).toMatchObject({ areaId: area, projectId: null, headingId: null });
    });

    it("cannot be moved on their own", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      const project = app.createProject({ title: "Japan" });
      expect(() => app.moveToDo(child, { kind: "project", id: project })).toThrow();
    });
  });

  describe("promoting", () => {
    it("turns a Sub-to-do into a normal To-do in the same place", () => {
      const project = app.createProject({ title: "Japan" });
      const parent = app.createToDo({ title: "Plan trip", projectId: project });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.promote(child);
      expect(app.getToDo(child)).toMatchObject({ parentId: null, projectId: project });
      expect(app.subToDos(parent)).toEqual([]);
      const entry = app.projectToDos(project).find((e) => e.toDo.id === child);
      expect(entry?.parentTitle).toBeNull();
    });

    it("lets the promoted To-do move on its own", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.promote(child);
      const project = app.createProject({ title: "Japan" });
      app.moveToDo(child, { kind: "project", id: project });
      expect(titles(app.projectToDos(project))).toEqual(["Book flights"]);
    });
  });

  describe("finishing a parent", () => {
    it("needs a choice while Sub-to-dos are open", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      app.createToDo({ title: "Book flights", parentId: parent });
      expect(app.openSubToDoCount(parent)).toBe(1);
      expect(() => app.complete(parent)).toThrow();
      expect(app.getToDo(parent).outcome).toBe("active");
    });

    it("Complete all remaining completes the open Sub-to-dos", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const a = app.createToDo({ title: "Book flights", parentId: parent });
      const b = app.createToDo({ title: "Book hotel", parentId: parent });
      app.cancel(b);
      app.complete(parent, { remaining: "complete" });
      expect([parent, a, b].map((id) => app.getToDo(id).outcome)).toEqual([
        "completed",
        "completed",
        "cancelled",
      ]);
    });

    it("Cancel all remaining cancels the open Sub-to-dos", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const a = app.createToDo({ title: "Book flights", parentId: parent });
      app.complete(parent, { remaining: "cancel" });
      expect(app.getToDo(parent).outcome).toBe("completed");
      expect(app.getToDo(a).outcome).toBe("cancelled");
    });

    it("needs no choice when every Sub-to-do is finished", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const a = app.createToDo({ title: "Book flights", parentId: parent });
      app.complete(a);
      app.cancel(parent);
      expect(app.getToDo(parent).outcome).toBe("cancelled");
    });
  });

  describe("deleting a parent", () => {
    it("moves its Sub-to-dos to the Trash with it", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.setWhen(child, { kind: "today" });
      app.delete(parent);
      expect(app.today().main).toEqual([]);
      expect(app.isInTrash(child)).toBe(true);
    });

    it("restoring the parent restores them", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.setWhen(child, { kind: "today" });
      app.delete(parent);
      app.restore(parent);
      expect(titles(app.today().main)).toEqual(["Book flights"]);
      expect(app.getToDo(child).parentId).toBe(parent);
    });

    it("emptying the Trash removes them too", () => {
      const parent = app.createToDo({ title: "Plan trip" });
      const child = app.createToDo({ title: "Book flights", parentId: parent });
      app.delete(parent);
      app.emptyTrash();
      expect(app.findToDo(child)).toBeUndefined();
    });
  });
});
