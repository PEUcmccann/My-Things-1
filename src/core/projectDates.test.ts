import { beforeEach, describe, expect, it } from "vitest";
import type { fixedClock, MyThings } from "./index";
import { NEXT_WEEK, setup, TODAY, TOMORROW } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const todayTitles = () => titles(app.today().main);
const projectTitles = (list: "today" | "anytime" | "someday") =>
  app.projectsIn(list).map((p) => p.title);

describe("Project dates", () => {
  it("can be given a Start date, a Deadline and Someday", () => {
    const id = app.createProject({ title: "Write a novel" });
    app.setProjectWhen(id, { kind: "date", date: TOMORROW });
    app.setProjectDeadline(id, NEXT_WEEK);
    expect(app.getProject(id)).toMatchObject({ startDate: TOMORROW, deadline: NEXT_WEEK });
    app.setProjectWhen(id, { kind: "someday" });
    expect(app.getProject(id)).toMatchObject({ startDate: null, someday: true });
  });

  it("treat This Evening as Today, since Projects have no evening", () => {
    const id = app.createProject({ title: "Write a novel" });
    app.setProjectWhen(id, { kind: "thisEvening" });
    expect(app.getProject(id).startDate).toBe(TODAY);
  });
});

describe("To-dos in a held-back Project", () => {
  for (const [name, hold] of [
    ["in Someday", (id: string) => app.setProjectWhen(id, { kind: "someday" })],
    [
      "starting in the future",
      (id: string) => app.setProjectWhen(id, { kind: "date", date: NEXT_WEEK }),
    ],
  ] as const) {
    describe(name, () => {
      it("are hidden from Anytime", () => {
        const project = app.createProject({ title: "Write a novel" });
        hold(project);
        app.createToDo({ title: "Outline", projectId: project });
        expect(titles(app.anytime())).toEqual([]);
      });

      it("show in Anytime and Today when they have their own Start date", () => {
        const project = app.createProject({ title: "Write a novel" });
        hold(project);
        const id = app.createToDo({ title: "Email the editor", projectId: project });
        app.setWhen(id, { kind: "today" });
        expect(titles(app.anytime())).toEqual(["Email the editor"]);
        expect(todayTitles()).toEqual(["Email the editor"]);
      });

      it("show in Today when they have their own Deadline", () => {
        const project = app.createProject({ title: "Write a novel" });
        hold(project);
        const id = app.createToDo({ title: "Send contract", projectId: project });
        app.setDeadline(id, TODAY);
        expect(todayTitles()).toEqual(["Send contract"]);
        expect(titles(app.anytime())).toEqual(["Send contract"]);
      });

      it("still show on the Project's own screen", () => {
        const project = app.createProject({ title: "Write a novel" });
        hold(project);
        app.createToDo({ title: "Outline", projectId: project });
        expect(titles(app.projectToDos(project))).toEqual(["Outline"]);
      });
    });
  }

  it("come back to Anytime once the Project's Start date arrives", () => {
    const project = app.createProject({ title: "Write a novel" });
    app.setProjectWhen(project, { kind: "date", date: TOMORROW });
    app.createToDo({ title: "Outline", projectId: project });
    clock.set("2026-11-27T09:00:00");
    expect(titles(app.anytime())).toEqual(["Outline"]);
  });
});

describe("Projects in lists", () => {
  it("Today has Projects whose Start date or Deadline has come", () => {
    const a = app.createProject({ title: "Starts today" });
    app.setProjectWhen(a, { kind: "today" });
    const b = app.createProject({ title: "Due today" });
    app.setProjectDeadline(b, TODAY);
    app.createProject({ title: "Undated" });
    expect(projectTitles("today")).toEqual(["Starts today", "Due today"]);
  });

  it("Upcoming shows a Project on its future Start date and Deadline", () => {
    const id = app.createProject({ title: "Write a novel" });
    app.setProjectWhen(id, { kind: "date", date: TOMORROW });
    app.setProjectDeadline(id, NEXT_WEEK);
    expect(
      app.upcoming().map((g) => g.entries.map((e) => (e.kind === "project" ? e.reason : ""))),
    ).toEqual([["start"], ["deadline"]]);
  });

  it("Anytime has active Projects with no future Start date, not in Someday", () => {
    app.createProject({ title: "Undated" });
    const later = app.createProject({ title: "Later" });
    app.setProjectWhen(later, { kind: "date", date: TOMORROW });
    const parked = app.createProject({ title: "Parked" });
    app.setProjectWhen(parked, { kind: "someday" });
    expect(projectTitles("anytime")).toEqual(["Undated"]);
  });

  it("Someday has Projects parked there", () => {
    const parked = app.createProject({ title: "Parked" });
    app.setProjectWhen(parked, { kind: "someday" });
    app.createProject({ title: "Undated" });
    expect(projectTitles("someday")).toEqual(["Parked"]);
  });

  it("leave out deleted Projects", () => {
    const id = app.createProject({ title: "Deleted" });
    app.deleteProject(id);
    expect(projectTitles("anytime")).toEqual([]);
  });
});

describe("finishing a Project", () => {
  it("completes a Project with no open To-dos straight away", () => {
    const id = app.createProject({ title: "Move house" });
    const t = app.createToDo({ title: "Book van", projectId: id });
    app.complete(t);
    expect(app.openToDoCount(id)).toBe(0);
    app.completeProject(id);
    expect(app.getProject(id).outcome).toBe("completed");
  });

  it("needs a choice when open To-dos remain", () => {
    const id = app.createProject({ title: "Move house" });
    app.createToDo({ title: "Book van", projectId: id });
    expect(app.openToDoCount(id)).toBe(1);
    expect(() => app.completeProject(id)).toThrow();
    expect(app.getProject(id).outcome).toBe("active");
  });

  it("Complete all remaining completes the open To-dos", () => {
    const id = app.createProject({ title: "Move house" });
    const a = app.createToDo({ title: "Book van", projectId: id });
    const b = app.createToDo({ title: "Pack books", projectId: id });
    app.cancel(b);
    app.completeProject(id, { remaining: "complete" });
    expect(app.getToDo(a).outcome).toBe("completed");
    expect(app.getToDo(b).outcome).toBe("cancelled");
  });

  it("Cancel all remaining cancels the open To-dos", () => {
    const id = app.createProject({ title: "Move house" });
    const a = app.createToDo({ title: "Book van", projectId: id });
    const b = app.createToDo({ title: "Pack books", projectId: id });
    app.complete(b);
    app.cancelProject(id, { remaining: "cancel" });
    expect(app.getProject(id).outcome).toBe("cancelled");
    expect(app.getToDo(a).outcome).toBe("cancelled");
    expect(app.getToDo(b).outcome).toBe("completed");
  });

  it("moves the Project to the Logbook following the Logbook timing", () => {
    const id = app.createProject({ title: "Move house" });
    app.completeProject(id);
    expect(app.sidebar().projects.map((p) => p.title)).toEqual(["Move house"]);
    expect(app.logbook()).toEqual([]);

    clock.set("2026-11-27T08:00:00");
    expect(app.sidebar().projects).toEqual([]);
    expect(app.logbook().map((d) => d.entries.map((e) => e.kind))).toEqual([["project"]]);
  });

  it("moves it straight away when the Logbook timing is immediately", () => {
    app.setLogbookMode("immediately");
    const id = app.createProject({ title: "Move house" });
    app.cancelProject(id);
    expect(app.sidebar().projects).toEqual([]);
    expect(app.logbook()[0].entries).toEqual([
      {
        kind: "project",
        project: expect.objectContaining({ title: "Move house", outcome: "cancelled" }),
      },
    ]);
  });

  it("can be reopened from the Logbook", () => {
    app.setLogbookMode("immediately");
    const id = app.createProject({ title: "Move house" });
    app.completeProject(id);
    app.reopenProject(id);
    expect(app.logbook()).toEqual([]);
    expect(app.sidebar().projects.map((p) => p.title)).toEqual(["Move house"]);
  });

  it("is moved to the Logbook manually in manual mode", () => {
    app.setLogbookMode("manually");
    const id = app.createProject({ title: "Move house" });
    app.completeProject(id);
    expect(app.hasFinishedOutsideLogbook()).toBe(true);
    app.moveFinishedToLogbook();
    expect(app.sidebar().projects).toEqual([]);
  });
});
