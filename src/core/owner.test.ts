import { describe, expect, it } from "vitest";
import { createMyThings, fixedClock, localOwner, memoryStore, type MyThings } from "./index";
import { device, NOW, setup } from "./testSetup";

const account = "a1b2c3d4-0000-4000-8000-000000000001";
const otherAccount = "a1b2c3d4-0000-4000-8000-000000000002";

/** The owner of every record, from an export of everything. */
function owners(app: MyThings): string[] {
  const { records } = app.exportAll();
  return Object.values(records).flatMap((list) => list.map((r) => r.owner));
}

/** One record of every collection that has an owner. */
function fillDevice(app: MyThings) {
  const area = app.createArea("Home");
  const project = app.createProject({ title: "Move house", areaId: area });
  app.createHeading(project, "Packing");
  const toDo = app.createToDo({ title: "Buy boxes", projectId: project });
  app.addChecklistItem(toDo, "Tape");
  app.createTag("Errand");
  return toDo;
}

describe("owner", () => {
  it("is me until you sign in", () => {
    const { app } = setup();
    fillDevice(app);
    expect(app.owner()).toBe(localOwner);
    expect(new Set(owners(app))).toEqual(new Set([localOwner]));
  });

  it("becomes the account for every existing record when you sign in", () => {
    const { app } = setup();
    const toDo = fillDevice(app);
    app.delete(app.createToDo({ title: "Old idea" }));
    app.changeOwner(account);
    expect(app.owner()).toBe(account);
    expect(owners(app).length).toBeGreaterThan(6);
    expect(new Set(owners(app))).toEqual(new Set([account]));
    expect(app.getToDo(toDo).owner).toBe(account);
  });

  it("is the account for records created after signing in", () => {
    const { app } = setup();
    app.changeOwner(account);
    const toDo = app.createToDo({ title: "Call the bank" });
    const area = app.createArea("Work");
    expect(app.getToDo(toDo).owner).toBe(account);
    expect(new Set(owners(app))).toEqual(new Set([account]));
    expect(area).toBeTruthy();
  });

  it("is sent to other devices as an edit", () => {
    const a = device(1);
    const toDo = a.app.createToDo({ title: "Buy milk" });
    a.app.markEditsSent(a.app.unsentEdits().map((e) => e.id));
    a.app.changeOwner(account);
    expect(a.app.unsentEdits()).toEqual([
      expect.objectContaining({ recordId: toDo, field: "owner", value: account }),
    ]);
  });

  it("changes nothing when you sign in again with the same account", () => {
    const { app } = setup();
    fillDevice(app);
    app.changeOwner(account);
    app.markEditsSent(app.unsentEdits().map((e) => e.id));
    const before = app.exportAll();
    app.changeOwner(account);
    expect(app.unsentEdits()).toEqual([]);
    expect(app.exportAll()).toEqual(before);
  });

  it("is kept after a reload when the app passes it in", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const first = createMyThings({ clock, store });
    first.changeOwner(account);
    const again = createMyThings({ clock, store: memoryStore(store.snapshot()), owner: account });
    const toDo = again.createToDo({ title: "Later" });
    expect(again.getToDo(toDo).owner).toBe(account);
  });

  it("tells whether the device holds another account's records", () => {
    const { app } = setup();
    fillDevice(app);
    expect(app.holdsAnotherAccount(account)).toBe(false);
    app.changeOwner(account);
    expect(app.holdsAnotherAccount(account)).toBe(false);
    expect(app.holdsAnotherAccount(otherAccount)).toBe(true);
  });

  it("refuses to take over another account's records", () => {
    const { app } = setup();
    fillDevice(app);
    app.changeOwner(account);
    expect(() => app.changeOwner(otherAccount)).toThrow();
    expect(new Set(owners(app))).toEqual(new Set([account]));
  });
});

describe("erasing the device", () => {
  it("leaves an empty store with default settings, owned by me", () => {
    const { app } = setup();
    fillDevice(app);
    app.setAccentColour("rose");
    app.setLogbookMode("immediately");
    app.changeOwner(account);
    app.eraseDevice();
    expect(owners(app)).toEqual([]);
    expect(app.accentColour()).toBe("teal");
    expect(app.logbookMode()).toBe("endOfDay");
    expect(app.owner()).toBe(localOwner);
    expect(app.inbox()).toEqual([]);
  });

  it("sends nothing to other devices: the data stays in the account", () => {
    const { app } = setup();
    fillDevice(app);
    app.changeOwner(account);
    app.eraseDevice();
    expect(app.unsentEdits()).toEqual([]);
  });

  it("lets another account sign in, and records made before signing in are taken over", () => {
    const { app } = setup();
    fillDevice(app);
    app.changeOwner(account);
    app.eraseDevice();
    const toDo = app.createToDo({ title: "Signed out" });
    expect(app.holdsAnotherAccount(otherAccount)).toBe(false);
    app.changeOwner(otherAccount);
    expect(app.getToDo(toDo).owner).toBe(otherAccount);
  });

  it("stays erased after a reload", () => {
    const store = memoryStore();
    const clock = fixedClock(NOW);
    const app = createMyThings({ clock, store });
    fillDevice(app);
    app.eraseDevice();
    const again = createMyThings({ clock, store: memoryStore(store.snapshot()) });
    expect(owners(again)).toEqual([]);
    expect(again.unsentEdits()).toEqual([]);
  });
});
