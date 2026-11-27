import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings } from "./index";
import { NOW, setup } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const inboxTitles = () => app.inbox().map((e) => e.toDo.title);

describe("Inbox", () => {
  it("lists a new To-do with no Area or Project", () => {
    app.createToDo({ title: "Buy milk" });
    expect(inboxTitles()).toEqual(["Buy milk"]);
  });

  it("lists To-dos in the order they were created", () => {
    app.createToDo({ title: "First" });
    clock.set("2026-11-26T10:05:00");
    app.createToDo({ title: "Second" });
    expect(inboxTitles()).toEqual(["First", "Second"]);
  });

  it("leaves out To-dos filed in a Project", () => {
    const project = app.createProject({ title: "Move house" });
    app.createToDo({ title: "Book van", projectId: project });
    expect(inboxTitles()).toEqual([]);
  });

  it("leaves out To-dos in the Trash", () => {
    const id = app.createToDo({ title: "Old idea" });
    app.delete(id);
    expect(inboxTitles()).toEqual([]);
  });
});

describe("records", () => {
  it("give every new To-do an owner and created and updated times", () => {
    const id = app.createToDo({ title: "Buy milk" });
    expect(app.getToDo(id)).toMatchObject({
      owner: "me",
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
    });
  });

  it("move the updated time forward on each change", () => {
    const id = app.createToDo({ title: "Buy milk" });
    clock.set("2026-11-26T11:00:00");
    app.setDeadline(id, "2026-11-30");
    expect(app.getToDo(id).updatedAt).toBe(new Date("2026-11-26T11:00:00").toISOString());
    expect(app.getToDo(id).createdAt).toBe(new Date(NOW).toISOString());
  });
});

describe("saving", () => {
  it("brings To-dos back from a saved snapshot", () => {
    const first = memoryStore();
    const clock = fixedClock(NOW);
    createMyThings({ clock, store: first }).createToDo({ title: "Buy milk" });

    const reloaded = createMyThings({ clock, store: memoryStore(first.snapshot()) });
    expect(reloaded.inbox().map((e) => e.toDo.title)).toEqual(["Buy milk"]);
  });

  it("reports every change so the app can save it", () => {
    let changes = 0;
    const store = memoryStore(undefined, () => changes++);
    createMyThings({ clock: fixedClock(NOW), store }).createToDo({ title: "Buy milk" });
    expect(changes).toBeGreaterThan(0);
  });
});
