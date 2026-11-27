import { beforeEach, describe, expect, it } from "vitest";
import {
  createMyThings,
  fixedClock,
  formatEstimate,
  type Energy,
  memoryStore,
  type MyThings,
  type Priority,
} from "./index";
import { NOW, setup } from "./testSetup";

let app: MyThings;
let id: string;

beforeEach(() => {
  ({ app } = setup());
  id = app.createToDo({ title: "Write report" });
});

describe("planning attributes", () => {
  it("start with no Priority, Energy or Estimate", () => {
    expect(app.getToDo(id)).toMatchObject({ priority: "none", energy: null, estimate: null });
  });
});

describe("Priority", () => {
  it("can be set and cleared back to none", () => {
    app.setPriority(id, "high");
    expect(app.getToDo(id).priority).toBe("high");
    app.setPriority(id, "none");
    expect(app.getToDo(id).priority).toBe("none");
  });

  it("refuses a value that is not offered", () => {
    app.setPriority(id, "low");
    expect(() => app.setPriority(id, "urgent" as Priority)).toThrow();
    expect(app.getToDo(id).priority).toBe("low");
  });
});

describe("Energy", () => {
  it("can be set to low or high and cleared", () => {
    app.setEnergy(id, "high");
    expect(app.getToDo(id).energy).toBe("high");
    app.setEnergy(id, "low");
    expect(app.getToDo(id).energy).toBe("low");
    app.setEnergy(id, null);
    expect(app.getToDo(id).energy).toBeNull();
  });

  it("refuses a value that is not offered", () => {
    expect(() => app.setEnergy(id, "medium" as Energy)).toThrow();
    expect(app.getToDo(id).energy).toBeNull();
  });
});

describe("Estimate", () => {
  it("can be set to a number of minutes and cleared", () => {
    app.setEstimate(id, 45);
    expect(app.getToDo(id).estimate).toBe(45);
    app.setEstimate(id, 600);
    expect(app.getToDo(id).estimate).toBe(600);
    app.setEstimate(id, null);
    expect(app.getToDo(id).estimate).toBeNull();
  });

  it("refuses zero, negative and fractional minutes", () => {
    app.setEstimate(id, 30);
    for (const bad of [0, -15, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => app.setEstimate(id, bad)).toThrow();
    }
    expect(app.getToDo(id).estimate).toBe(30);
  });
});

describe("Estimate text", () => {
  it("shows minutes under an hour, and hours and minutes from an hour", () => {
    expect([5, 15, 59, 60, 90, 120, 125, 600].map(formatEstimate)).toEqual([
      "5m",
      "15m",
      "59m",
      "1h",
      "1h 30m",
      "2h",
      "2h 5m",
      "10h",
    ]);
  });
});

describe("Today's Estimate total", () => {
  it("adds up the Estimates of Today's active To-dos, This Evening included", () => {
    app.setEstimate(app.createToDo({ title: "Call bank", when: { kind: "today" } }), 15);
    app.setEstimate(app.createToDo({ title: "Cook", when: { kind: "thisEvening" } }), 90);
    app.createToDo({ title: "No Estimate", when: { kind: "today" } });
    app.setEstimate(app.createToDo({ title: "Later", when: { kind: "someday" } }), 30);
    expect(app.todayEstimate()).toBe(105);
  });

  it("leaves out Completed and Cancelled To-dos", () => {
    const done = app.createToDo({ title: "Done", when: { kind: "today" } });
    const dropped = app.createToDo({ title: "Dropped", when: { kind: "today" } });
    const open = app.createToDo({ title: "Open", when: { kind: "today" } });
    for (const t of [done, dropped, open]) app.setEstimate(t, 20);
    app.complete(done);
    app.cancel(dropped);
    expect(app.todayEstimate()).toBe(20);
  });

  it("is zero when nothing in Today has an Estimate", () => {
    app.createToDo({ title: "Call bank", when: { kind: "today" } });
    expect(app.todayEstimate()).toBe(0);
  });
});

describe("saved data", () => {
  it("keeps the attributes after a reload", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const first = createMyThings({ clock, store });
    const saved = first.createToDo({ title: "Buy milk" });
    first.setPriority(saved, "medium");
    first.setEnergy(saved, "low");
    first.setEstimate(saved, 90);
    const reloaded = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(reloaded.getToDo(saved)).toMatchObject({
      priority: "medium",
      energy: "low",
      estimate: 90,
    });
  });

  it("loads To-dos saved by Milestone 1 with the attributes unset", () => {
    const old = memoryStore();
    const clock = fixedClock(NOW);
    const saved = createMyThings({ clock, store: old }).createToDo({ title: "Buy milk" });
    const snapshot = old.snapshot();
    const m1 = snapshot.records.toDos.map(
      ({ priority: _p, energy: _e, estimate: _s, ...rest }) => rest,
    );
    const loaded = createMyThings({
      clock,
      store: memoryStore({ ...snapshot, records: { ...snapshot.records, toDos: m1 as never } }),
    });
    expect(loaded.getToDo(saved)).toMatchObject({ priority: "none", energy: null, estimate: null });
  });
});
