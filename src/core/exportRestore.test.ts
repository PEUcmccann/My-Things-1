import { beforeEach, describe, expect, it } from "vitest";
import {
  createMyThings,
  fixedClock,
  memoryStore,
  readExport,
  RestoreError,
  type ExportFile,
  type MyThings,
} from "./index";
import { device, NOW, send, setup, TODAY, TOMORROW, uuidCounter } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

/** Something in every list: Today, Upcoming, Someday, a Project, Logbook, Trash, a Smart List. */
function fillUp(on: MyThings) {
  const area = on.createArea("Home");
  const project = on.createProject({ title: "Move house", areaId: area });
  const heading = on.createHeading(project, "Pack");
  const tag = on.createTag("errand");
  const today = on.createToDo({ title: "Buy milk", when: { kind: "today" } });
  on.addTag({ kind: "toDo", id: today }, tag);
  on.addChecklistItem(today, "Check fridge");
  on.createToDo({ title: "Boxes", projectId: project, headingId: heading });
  on.createToDo({ title: "Call the bank", when: { kind: "date", date: TOMORROW } });
  on.createToDo({ title: "Learn the cello", when: { kind: "someday" } });
  const repeating = on.createToDo({ title: "Water plants", when: { kind: "today" } });
  on.setRepeat(repeating, { freq: "daily", interval: 1 });
  on.complete(repeating);
  const done = on.createToDo({ title: "Post letter" });
  on.complete(done);
  const trashed = on.createToDo({ title: "Old idea" });
  on.delete(trashed);
  const list = on.createSmartList("Errands", { tagIds: [tag] });
  on.setLogbookMode("immediately");
  on.setAccentColour("rose");
  return { area, project, tag, today, repeating, trashed, list };
}

/** What every list shows, to compare before and after a restore. */
function everything(on: MyThings, list: string) {
  return JSON.parse(
    JSON.stringify({
      today: on.today(),
      inbox: on.inbox(),
      upcoming: on.upcoming(),
      anytime: on.anytime(),
      someday: on.someday(),
      logbook: on.logbook(),
      trash: on.trash(),
      sidebar: on.sidebar(),
      smartLists: on.smartLists(),
      smartList: on.smartListToDos(list),
      logbookMode: on.logbookMode(),
      accentColour: on.accentColour(),
    }),
  ) as unknown;
}

const text = (file: ExportFile) => JSON.stringify(file);

describe("exporting", () => {
  it("holds every collection and the settings, with a format name and version", () => {
    const { tag, today, trashed, list } = fillUp(app);
    const file = app.exportAll();
    expect(file).toMatchObject({
      format: "mythings-export",
      version: 1,
      exportedAt: new Date(NOW).toISOString(),
      settings: { logbookMode: "immediately", accentColour: "rose" },
    });
    expect(Object.keys(file.records).sort()).toEqual(
      [
        "areas",
        "attachments",
        "checklistItems",
        "headings",
        "projects",
        "smartLists",
        "tags",
        "toDos",
      ].sort(),
    );
    const ids = (c: keyof ExportFile["records"]) => file.records[c].map((r) => r.id);
    expect(ids("toDos")).toEqual(expect.arrayContaining([today, trashed]));
    expect(ids("tags")).toEqual([tag]);
    expect(ids("smartLists")).toEqual([list]);
    expect(file.records.checklistItems.map((r) => r.title)).toEqual(["Check fridge"]);
  });

  it("leaves out the sync bookkeeping and records removed for good", () => {
    const gone = app.createArea("Gone");
    app.deleteArea(gone);
    const file = text(app.exportAll());
    expect(file).not.toContain(gone);
    expect(file).not.toContain("_removed");
    expect(file).not.toContain(app.deviceId());
    expect(Object.keys(app.exportAll())).toEqual([
      "format",
      "version",
      "exportedAt",
      "records",
      "settings",
    ]);
  });
});

describe("restoring", () => {
  it("brings every list back as it was when exported", () => {
    const { list, today, project } = fillUp(app);
    const before = everything(app, list);
    const file = text(app.exportAll());

    clock.set("2026-11-26T12:00:00");
    app.editToDo(today, { title: "Buy oat milk" });
    app.createToDo({ title: "Added later" });
    app.delete(today);
    app.emptyTrash();
    app.deleteProject(project);
    app.setAccentColour("blue");
    app.setLogbookMode("manually");
    expect(everything(app, list)).not.toEqual(before);

    app.restoreExport(file);
    expect(everything(app, list)).toEqual(before);
  });

  it("removes records not in the file for good", () => {
    const file = text(app.exportAll());
    const added = app.createArea("Added later");
    app.restoreExport(file);
    expect(app.sidebar().areas).toEqual([]);
    expect(
      app.unsentEdits().some((e) => e.recordId === added && e.field === "_removed" && e.value),
    ).toBe(true);
  });

  it("brings back records removed for good since the export, with every field", () => {
    const toDo = app.createToDo({ title: "Buy milk", when: { kind: "today" } });
    const file = text(app.exportAll());
    app.delete(toDo);
    app.emptyTrash();
    app.restoreExport(file);
    expect(app.today().main.map((e) => e.toDo.title)).toEqual(["Buy milk"]);
    expect(app.unsentEdits()).toContainEqual(
      expect.objectContaining({ recordId: toDo, field: "_removed", value: false }),
    );
  });

  it("writes every field as a new edit stamped now", () => {
    const toDo = app.createToDo({ title: "Buy milk" });
    const file = text(app.exportAll());
    app.markEditsSent(app.unsentEdits().map((e) => e.id));
    clock.set("2026-11-26T12:00:00");
    app.restoreExport(file);
    const edits = app.unsentEdits().filter((e) => e.recordId === toDo);
    expect(edits.map((e) => e.field)).toEqual(expect.arrayContaining(["title", "notes", "owner"]));
    for (const e of edits) expect(e.editedAt).toBe(new Date("2026-11-26T12:00:00").toISOString());
    expect(app.unsentEdits().filter((e) => e.collection === "settings").length).toBeGreaterThan(0);
  });

  it("sets every record's owner to the current owner", () => {
    const signedOut = setup().app;
    const toDo = signedOut.createToDo({ title: "Buy milk" });
    const area = signedOut.createArea("Home");
    expect(signedOut.getToDo(toDo).owner).toBe("me");
    const file = text(signedOut.exportAll());

    const account = createMyThings({
      clock: fixedClock(NOW),
      store: memoryStore(),
      newEditId: uuidCounter(5),
      owner: "user-1",
    });
    account.restoreExport(file);
    expect(account.getToDo(toDo).owner).toBe("user-1");
    expect(account.exportAll().records.areas.find((a) => a.id === area)?.owner).toBe("user-1");

    signedOut.restoreExport(text(account.exportAll()));
    expect(signedOut.getToDo(toDo).owner).toBe("me");
  });

  it("restores an export missing a collection and fields, with their defaults", () => {
    const toDo = app.createToDo({ title: "Buy milk", when: { kind: "today" } });
    const file = app.exportAll();
    const old = JSON.parse(text(file)) as Record<string, unknown> & {
      records: Record<string, unknown[]>;
    };
    delete old.records.smartLists;
    delete old.records.checklistItems;
    old.records.toDos = old.records.toDos.map((r) => {
      const {
        priority: _p,
        energy: _e,
        estimate: _s,
        timeSlot: _t,
        ...rest
      } = r as Record<string, unknown>;
      return rest;
    });
    old.settings = { logbookMode: "manually" };
    app.createSmartList("Later");

    app.restoreExport(JSON.stringify(old));
    expect(app.smartLists()).toEqual([]);
    expect(app.getToDo(toDo)).toMatchObject({
      title: "Buy milk",
      priority: "none",
      energy: null,
      estimate: null,
      timeSlot: null,
    });
    expect(app.logbookMode()).toBe("manually");
    expect(app.accentColour()).toBe("teal");
  });

  it("works on records exported by another device", () => {
    const a = device(1);
    const toDo = a.app.createToDo({ title: "Buy milk", when: { kind: "today" } });
    const b = device(2);
    b.app.restoreExport(text(a.app.exportAll()));
    expect(b.app.getToDo(toDo)).toEqual(a.app.getToDo(toDo));
    expect(b.app.today().main.map((e) => e.toDo.title)).toEqual(["Buy milk"]);
  });
});

describe("refusing a file", () => {
  function refusal(file: string) {
    try {
      app.restoreExport(file);
    } catch (error) {
      if (error instanceof RestoreError) return error.problem;
      throw error;
    }
    return null;
  }

  it("refuses, changing nothing, a file that isn't valid JSON, another format or a newer version", () => {
    app.createToDo({ title: "Buy milk" });
    const before = app.exportAll();
    app.markEditsSent(app.unsentEdits().map((e) => e.id));
    const newer = { ...before, version: 2 };
    expect(refusal("{ not json")).toBe("notJson");
    expect(refusal(JSON.stringify({ ...before, format: "other-app" }))).toBe("notAnExport");
    expect(refusal(JSON.stringify([1, 2]))).toBe("notAnExport");
    expect(refusal(JSON.stringify({ ...before, records: { toDos: "x" } }))).toBe("notAnExport");
    expect(refusal(JSON.stringify(newer))).toBe("newerVersion");
    expect(app.exportAll()).toEqual(before);
    expect(app.unsentEdits()).toEqual([]);
  });

  it("reads a file before restoring it, to show the date it was exported", () => {
    const file = text(app.exportAll());
    expect(readExport(file).exportedAt).toBe(new Date(NOW).toISOString());
    expect(() => readExport("nope")).toThrow(RestoreError);
  });
});

describe("restoring while syncing", () => {
  it("a restore on one device reaches the other, even over its newer edits", () => {
    const a = device(1);
    const b = device(2);
    const toDo = a.app.createToDo({ title: "Buy milk", when: { kind: "today" } });
    send(a.app, b.app);
    const file = text(a.app.exportAll());

    // B edits and adds, then A restores later; both sync.
    b.clock.set("2026-11-26T11:00:00");
    b.app.editToDo(toDo, { title: "Buy oat milk" });
    b.app.createToDo({ title: "Added on B", when: { kind: "today" } });
    send(b.app, a.app);
    a.app.delete(toDo);
    a.app.emptyTrash();
    a.clock.set("2026-11-26T12:00:00");
    a.app.restoreExport(file);
    send(a.app, b.app);

    for (const on of [a.app, b.app]) {
      expect(on.today().main.map((e) => e.toDo.title)).toEqual(["Buy milk"]);
    }
    expect(b.app.getToDo(toDo)).toEqual(a.app.getToDo(toDo));
    expect(b.app.today().main[0].toDo.startDate).toBe(TODAY);
  });

  it("a restore beats a removal on another device it hadn't heard of yet", () => {
    const a = device(1);
    const b = device(2);
    const area = a.app.createArea("Home");
    send(a.app, b.app);
    const file = text(a.app.exportAll());
    b.app.deleteArea(area);
    a.clock.set("2026-11-26T12:00:00");
    a.app.restoreExport(file);
    // B's removal was made before the restore, so the restore wins on both.
    send(b.app, a.app);
    send(a.app, b.app);
    for (const on of [a.app, b.app])
      expect(on.sidebar().areas.map((x) => x.area.title)).toEqual(["Home"]);
  });
});
