import { describe, expect, it } from "vitest";
import {
  createMyThings,
  fixedClock,
  memoryStore,
  type Edit,
  type MyThings,
  type SnapshotV1,
} from "./index";
import { device, exchange, NOW, send, TODAY } from "./testSetup";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Two devices that share a To-do made on the first. */
function twoDevices() {
  const a = device(1);
  const b = device(2);
  const id = a.app.createToDo({ title: "Buy milk", when: { kind: "today" } });
  send(a.app, b.app);
  return { a, b, id };
}

const fields = (app: MyThings) => app.unsentEdits().map((e) => e.field);

describe("recording edits", () => {
  it("records every field of a new record", () => {
    const a = device(1);
    const id = a.app.createToDo({ title: "Buy milk" });
    const { id: _id, ...rest } = a.app.getToDo(id);
    expect(fields(a.app).sort()).toEqual(Object.keys(rest).sort());
    expect(a.app.unsentEdits().find((e) => e.field === "title")).toMatchObject({
      collection: "toDos",
      recordId: id,
      value: "Buy milk",
      editedAt: new Date("2026-11-26T10:00:00").toISOString(),
      deviceId: a.app.deviceId(),
    });
  });

  it("records only the fields that changed, with the time of the change", () => {
    const { a, id } = twoDevices();
    a.clock.set("2026-11-26T11:30:00");
    a.app.setDeadline(id, "2026-11-30");
    a.app.editToDo(id, { title: "Buy milk" });
    const at = new Date("2026-11-26T11:30:00").toISOString();
    // Setting the title it already has, at the same moment, changes nothing.
    expect(a.app.unsentEdits().map((e) => [e.field, e.value, e.editedAt])).toEqual(
      expect.arrayContaining([
        ["deadline", "2026-11-30", at],
        ["updatedAt", at, at],
      ]),
    );
    expect(fields(a.app)).toHaveLength(2);
  });

  it("keeps only the latest unsent edit of a field", () => {
    const { a, id } = twoDevices();
    a.app.editToDo(id, { title: "Oat milk" });
    a.app.editToDo(id, { title: "Soy milk" });
    expect(a.app.unsentEdits().filter((e) => e.field === "title")).toHaveLength(1);
    expect(a.app.unsentEdits().find((e) => e.field === "title")?.value).toBe("Soy milk");
  });

  it("gives every edit and the device a v4 UUID, from the app's generator or its own", () => {
    const { a } = twoDevices();
    expect(a.app.deviceId()).toMatch(uuidV4);
    const own = createMyThings({ clock: fixedClock("2026-11-26T10:00:00"), store: memoryStore() });
    own.createArea("Home");
    const ids = own.unsentEdits().map((e) => e.id);
    for (const editId of [...ids, own.deviceId()]) expect(editId).toMatch(uuidV4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records removal for good as a removal marker", () => {
    const a = device(1);
    const area = a.app.createArea("Home");
    const project = a.app.createProject({ title: "Move" });
    const heading = a.app.createHeading(project, "Pack");
    const tag = a.app.createTag("errand");
    const toDo = a.app.createToDo({ title: "Buy milk" });
    const step = a.app.addChecklistItem(toDo, "Check fridge");
    const list = a.app.createSmartList("Errands");
    const trashed = a.app.createToDo({ title: "Old" });
    a.app.markEditsSent(a.app.unsentEdits().map((e) => e.id));

    a.app.deleteArea(area);
    a.app.deleteHeading(heading, { toDos: "keep" });
    a.app.deleteTag(tag);
    a.app.deleteChecklistItem(step);
    a.app.deleteSmartList(list);
    a.app.delete(trashed);
    const markers = () =>
      a.app
        .unsentEdits()
        .filter((e) => e.field === "_removed")
        .map((e) => [e.collection, e.recordId, e.value]);
    expect(markers()).toEqual([
      ["areas", area, true],
      ["headings", heading, true],
      ["tags", tag, true],
      ["checklistItems", step, true],
      ["smartLists", list, true],
    ]);
    // Moving to the Trash is an ordinary edit.
    expect(a.app.unsentEdits().some((e) => e.recordId === trashed && e.field === "deletedAt")).toBe(
      true,
    );
    a.app.emptyTrash();
    expect(markers()).toContainEqual(["toDos", trashed, true]);
  });
});

describe("merging edits from another device", () => {
  it("a new To-do arrives whole", () => {
    const { a, b, id } = twoDevices();
    expect(b.app.getToDo(id)).toEqual(a.app.getToDo(id));
    expect(b.app.today().main.map((e) => e.toDo.title)).toEqual(["Buy milk"]);
    expect(a.app.unsentEdits()).toEqual([]);
  });

  it("keeps edits to different fields of one To-do made on both", () => {
    const { a, b, id } = twoDevices();
    a.clock.set("2026-11-26T10:01:00");
    a.app.editToDo(id, { title: "Buy oat milk" });
    b.clock.set("2026-11-26T10:02:00");
    b.app.setDeadline(id, "2026-11-30");
    exchange(a.app, b.app);
    for (const app of [a.app, b.app]) {
      expect(app.getToDo(id)).toMatchObject({ title: "Buy oat milk", deadline: "2026-11-30" });
    }
    expect(a.app.getToDo(id)).toEqual(b.app.getToDo(id));
  });

  it("keeps the later edit when both changed the same field", () => {
    const { a, b, id } = twoDevices();
    b.clock.set("2026-11-26T10:02:00");
    b.app.editToDo(id, { title: "Later" });
    a.clock.set("2026-11-26T10:01:00");
    a.app.editToDo(id, { title: "Earlier" });
    exchange(a.app, b.app);
    expect(a.app.getToDo(id).title).toBe("Later");
    expect(b.app.getToDo(id).title).toBe("Later");
  });

  it("breaks a tie by the larger device id, so both end the same", () => {
    const { a, b, id } = twoDevices();
    expect(b.app.deviceId() > a.app.deviceId()).toBe(true);
    for (const [d, title] of [
      [a, "From A"],
      [b, "From B"],
    ] as const) {
      d.clock.set("2026-11-26T10:05:00");
      d.app.editToDo(id, { title });
    }
    exchange(a.app, b.app);
    expect(a.app.getToDo(id).title).toBe("From B");
    expect(b.app.getToDo(id).title).toBe("From B");
  });

  it("breaks a tie on the same device by the larger edit id", () => {
    const { b, id } = twoDevices();
    const edit = (editId: string, value: string): Edit => ({
      id: editId,
      collection: "toDos",
      recordId: id,
      field: "title",
      value,
      editedAt: "2026-11-26T12:00:00.000Z",
      deviceId: "30000000-0000-4000-8000-000000000000",
    });
    const low = edit("30000000-0000-4000-8000-000000000001", "Low");
    const high = edit("30000000-0000-4000-8000-000000000002", "High");
    b.app.applyEdits([high, low]);
    expect(b.app.getToDo(id).title).toBe("High");
    b.app.applyEdits([low]);
    expect(b.app.getToDo(id).title).toBe("High");
  });

  it("merges edits made offline on both devices and exchanged later", () => {
    const { a, b, id } = twoDevices();
    a.clock.set("2026-11-26T12:00:00");
    const area = a.app.createArea("Home");
    a.app.moveToDo(id, { kind: "area", id: area });
    a.app.createToDo({ title: "Call mum", when: { kind: "today" } });
    b.clock.set("2026-11-26T13:00:00");
    b.app.complete(id);
    b.app.createToDo({ title: "Water plants", when: { kind: "today" } });
    b.clock.set("2026-11-26T14:00:00");
    b.app.addChecklistItem(id, "Check fridge");

    exchange(a.app, b.app);
    for (const app of [a.app, b.app]) {
      expect(app.getToDo(id)).toMatchObject({ areaId: area, outcome: "completed" });
      expect(app.checklist(id).map((c) => c.title)).toEqual(["Check fridge"]);
      expect(app.areas().map((r) => r.title)).toEqual(["Home"]);
    }
    expect(a.app.today()).toEqual(b.app.today());
    expect(
      a.app
        .today()
        .main.map((e) => e.toDo.title)
        .sort(),
    ).toEqual(["Buy milk", "Call mum", "Water plants"]);
  });

  it("keeps a record removed for good, even against a later edit", () => {
    const { a, b, id } = twoDevices();
    const step = a.app.addChecklistItem(id, "Check fridge");
    send(a.app, b.app);
    a.clock.set("2026-11-26T10:01:00");
    a.app.deleteChecklistItem(step);
    b.clock.set("2026-11-26T10:02:00");
    b.app.renameChecklistItem(step, "Check the fridge");
    exchange(a.app, b.app);
    expect(a.app.checklist(id)).toEqual([]);
    expect(b.app.checklist(id)).toEqual([]);
    // A still later edit arriving afterwards doesn't bring it back either.
    b.app.applyEdits([
      {
        id: "30000000-0000-4000-8000-000000000001",
        collection: "checklistItems",
        recordId: step,
        field: "ticked",
        value: true,
        editedAt: "2026-11-27T09:00:00.000Z",
        deviceId: "30000000-0000-4000-8000-000000000000",
      },
    ]);
    expect(b.app.checklist(id)).toEqual([]);
  });

  it("brings back a record removed for good only through _removed false with every field", () => {
    const a = device(1);
    const tag = a.app.createTag("errand");
    const created = a.app.unsentEdits();
    send(a.app, device(2).app);
    a.app.deleteTag(tag);
    expect(a.app.tagTree()).toEqual([]);
    // What a restore (M3-06) sends: every field, then _removed false, all stamped later.
    const later = "2026-11-27T09:00:00.000Z";
    const restore: Edit[] = [
      ...created.map((e, i) => ({
        ...e,
        id: `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        editedAt: later,
      })),
      {
        ...created[0],
        id: "40000000-0000-4000-8000-0000000000ff",
        field: "_removed",
        value: false,
        editedAt: later,
      },
    ];
    a.app.applyEdits(restore);
    expect(a.app.tagTree().map((n) => n.tag.title)).toEqual(["errand"]);
  });

  it("syncs moving to the Trash, restoring, and emptying the Trash", () => {
    const { a, b, id } = twoDevices();
    a.clock.set("2026-11-26T10:01:00");
    a.app.delete(id);
    send(a.app, b.app);
    expect(b.app.trash().map((e) => e.kind === "toDo" && e.toDo.id)).toEqual([id]);
    expect(b.app.today().main).toEqual([]);

    b.clock.set("2026-11-26T10:02:00");
    b.app.restore(id);
    send(b.app, a.app);
    expect(a.app.trash()).toEqual([]);
    expect(a.app.today().main.map((e) => e.toDo.id)).toEqual([id]);

    a.clock.set("2026-11-26T10:03:00");
    a.app.delete(id);
    a.app.emptyTrash();
    send(a.app, b.app);
    expect(b.app.trash()).toEqual([]);
    expect(b.app.findToDo(id)).toBeUndefined();
  });

  it("syncs the settings as one record", () => {
    const a = device(1);
    const b = device(2);
    a.clock.set("2026-11-26T10:01:00");
    a.app.setAccentColour("rose");
    b.clock.set("2026-11-26T10:02:00");
    b.app.setLogbookMode("immediately");
    expect(a.app.unsentEdits()).toMatchObject([
      { collection: "settings", recordId: "settings", field: "accentColour", value: "rose" },
    ]);
    exchange(a.app, b.app);
    for (const app of [a.app, b.app]) {
      expect(app.accentColour()).toBe("rose");
      expect(app.logbookMode()).toBe("immediately");
    }
  });

  it("creates a record it doesn't have, with defaults for fields not received yet", () => {
    const b = device(2);
    b.app.applyEdits([
      {
        id: "30000000-0000-4000-8000-000000000001",
        collection: "toDos",
        recordId: "elsewhere",
        field: "title",
        value: "From elsewhere",
        editedAt: "2026-11-26T09:00:00.000Z",
        deviceId: "30000000-0000-4000-8000-000000000000",
      },
    ]);
    expect(b.app.getToDo("elsewhere")).toMatchObject({
      id: "elsewhere",
      title: "From elsewhere",
      tagIds: [],
      notes: "",
      priority: "none",
      timeSlot: null,
      repeat: null,
    });
  });

  it("creates nothing to send, and applying a batch twice changes nothing", () => {
    const a = device(1);
    const b = device(2);
    const id = a.app.createToDo({ title: "Buy milk", when: { kind: "today" } });
    a.app.addChecklistItem(id, "Check fridge");
    a.app.setAccentColour("blue");
    const batch = a.app.unsentEdits();
    expect(b.app.applyEdits(batch)).toBeGreaterThan(0);
    const once = { toDo: b.app.getToDo(id), checklist: b.app.checklist(id) };
    expect(b.app.applyEdits(batch)).toBe(0);
    expect({ toDo: b.app.getToDo(id), checklist: b.app.checklist(id) }).toEqual(once);
    expect(b.app.accentColour()).toBe("blue");
    expect(b.app.unsentEdits()).toEqual([]);
  });

  it("a device's own edits coming back change nothing", () => {
    const { a, id } = twoDevices();
    a.app.editToDo(id, { title: "Oat milk" });
    const mine = a.app.unsentEdits();
    a.app.markEditsSent(mine.map((e) => e.id));
    expect(a.app.applyEdits(mine)).toBe(0);
    expect(a.app.unsentEdits()).toEqual([]);
  });

  it("an edit made after a newer one arrived from a clock ahead still wins everywhere", () => {
    const { a, b, id } = twoDevices();
    b.clock.set("2026-11-26T18:00:00");
    b.app.editToDo(id, { title: "From the future" });
    send(b.app, a.app);
    a.clock.set("2026-11-26T10:05:00");
    a.app.editToDo(id, { title: "Typed just now" });
    send(a.app, b.app);
    expect(a.app.getToDo(id).title).toBe("Typed just now");
    expect(b.app.getToDo(id).title).toBe("Typed just now");
  });
});

describe("saving sync bookkeeping", () => {
  it("keeps the device id, unsent edits and edit times across a reload", () => {
    const a = device(1);
    const id = a.app.createToDo({ title: "Buy milk" });
    const again = device(1, { snapshot: a.store.snapshot() });
    expect(again.app.deviceId()).toBe(a.app.deviceId());
    expect(again.app.unsentEdits()).toEqual(a.app.unsentEdits());
    const older: Edit = {
      ...a.app.unsentEdits().find((e) => e.field === "title")!,
      id: "30000000-0000-4000-8000-000000000001",
      deviceId: "30000000-0000-4000-8000-000000000000",
      value: "Older",
      editedAt: "2026-11-26T08:00:00.000Z",
    };
    expect(again.app.applyEdits([older])).toBe(0);
    expect(again.app.getToDo(id).title).toBe("Buy milk");
  });

  it("loads a version 1 snapshot: edit times from updatedAt, nothing to send", () => {
    const v1: SnapshotV1 = {
      version: 1,
      records: {
        toDos: [
          {
            id: "old",
            owner: "me",
            createdAt: "2026-11-20T09:00:00.000Z",
            updatedAt: "2026-11-21T09:00:00.000Z",
            position: 0,
            todayPosition: null,
            title: "From Milestone 2",
            notes: "",
            tagIds: [],
            outcome: "active",
            finishedAt: null,
            loggedAt: null,
            startDate: TODAY,
            evening: false,
            someday: false,
            deadline: null,
            timeSlot: null,
            areaId: null,
            projectId: null,
            headingId: null,
            parentId: null,
            deletedAt: null,
            priority: "none",
            energy: null,
            estimate: null,
            repeat: null,
            seriesId: null,
            seriesValues: null,
          },
        ],
      },
      settings: { logbookMode: "endOfDay", accentColour: "green" },
    };
    const b = device(2, { snapshot: JSON.parse(JSON.stringify(v1)) });
    expect(b.app.today().main.map((e) => e.toDo.title)).toEqual(["From Milestone 2"]);
    expect(b.app.accentColour()).toBe("green");
    expect(b.app.unsentEdits()).toEqual([]);
    const titled = (value: string, editedAt: string, n: number): Edit => ({
      id: `30000000-0000-4000-8000-00000000000${n}`,
      collection: "toDos",
      recordId: "old",
      field: "title",
      value,
      editedAt,
      deviceId: "30000000-0000-4000-8000-000000000000",
    });
    expect(b.app.applyEdits([titled("Before", "2026-11-21T08:00:00.000Z", 1)])).toBe(0);
    expect(b.app.applyEdits([titled("After", "2026-11-21T10:00:00.000Z", 2)])).toBe(1);
    expect(b.app.getToDo("old").title).toBe("After");
  });
});

describe("the account's last received time", () => {
  it("starts empty, is kept across a reload, and is forgotten when the device is erased", () => {
    const a = device(1);
    expect(a.app.lastReceivedAt()).toBeNull();
    a.app.setLastReceivedAt("2026-11-26T10:00:00.123Z");
    const again = device(1, { snapshot: a.store.snapshot() });
    expect(again.app.lastReceivedAt()).toBe("2026-11-26T10:00:00.123Z");
    again.app.eraseDevice();
    expect(again.app.lastReceivedAt()).toBeNull();
  });
});

describe("queueing everything for an account", () => {
  it("queues every field of records that have nothing to send, keeping their edit times", () => {
    const a = device(1);
    const id = a.app.createToDo({ title: "Buy milk" });
    a.app.markEditsSent(a.app.unsentEdits().map((e) => e.id));
    a.app.queueAllRecords();
    const edits = a.app.unsentEdits();
    expect(edits.find((e) => e.field === "title")).toMatchObject({
      recordId: id,
      value: "Buy milk",
      editedAt: new Date(NOW).toISOString(),
      deviceId: a.app.deviceId(),
    });
    expect(edits.some((e) => e.collection === "settings")).toBe(true);
    // Another device gets the whole To-do.
    const b = device(2);
    send(a.app, b.app);
    expect(b.app.getToDo(id)).toEqual(a.app.getToDo(id));
  });

  it("leaves edits waiting to be sent as they are", () => {
    const a = device(1);
    a.app.createToDo({ title: "Buy milk" });
    const before = a.app.unsentEdits();
    a.app.queueAllRecords();
    expect(a.app.unsentEdits().filter((e) => e.collection !== "settings")).toEqual(before);
  });

  it("sends version 1 records whole, and its never-edited settings lose to the account's", () => {
    const v1: SnapshotV1 = {
      version: 1,
      records: {
        areas: [
          {
            id: "home",
            owner: "me",
            createdAt: "2026-11-20T09:00:00.000Z",
            updatedAt: "2026-11-21T09:00:00.000Z",
            title: "Home",
            tagIds: [],
            position: 0,
          },
        ],
      },
      settings: { logbookMode: "endOfDay", accentColour: "green" },
    };
    const a = device(1, { snapshot: JSON.parse(JSON.stringify(v1)) });
    a.app.queueAllRecords();
    const title = a.app.unsentEdits().find((e) => e.recordId === "home" && e.field === "title");
    expect(title).toMatchObject({
      editedAt: "2026-11-21T09:00:00.000Z",
      deviceId: a.app.deviceId(),
    });
    const b = device(2);
    b.app.setAccentColour("blue");
    exchange(a.app, b.app);
    expect(a.app.accentColour()).toBe("blue");
    expect(b.app.sidebar().areas.map((s) => s.area.title)).toEqual(["Home"]);
    // Its own queued edits coming back change nothing.
    expect(a.app.applyEdits([title!])).toBe(0);
  });

  it("queues records removed for good as removed", () => {
    const a = device(1);
    const area = a.app.createArea("Home");
    a.app.deleteArea(area);
    a.app.markEditsSent(a.app.unsentEdits().map((e) => e.id));
    a.app.queueAllRecords();
    expect(
      a.app
        .unsentEdits()
        .filter((e) => e.recordId === area)
        .map((e) => [e.field, e.value]),
    ).toEqual([["_removed", true]]);
  });
});
