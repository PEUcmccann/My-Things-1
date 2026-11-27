import { beforeEach, describe, expect, it } from "vitest";
import {
  createMyThings,
  fixedClock,
  memoryStore,
  type DateRange,
  type Energy,
  type EstimateChoice,
  type MyThings,
  type Priority,
} from "./index";
import { NOW, setup } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof setup>["clock"];

beforeEach(() => {
  ({ app, clock } = setup());
});

const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const matching = (id: string) => titles(app.smartListToDos(id));

describe("creating Smart Lists", () => {
  it("lists Smart Lists oldest first", () => {
    app.createSmartList("Quick errands");
    app.createSmartList("Deep work");
    expect(app.smartLists().map((s) => s.title)).toEqual(["Quick errands", "Deep work"]);
  });

  it("with no filters matches every To-do open in lists, Inbox included, but not Someday", () => {
    app.createToDo({ title: "In the Inbox" });
    const area = app.createArea("Home");
    app.createToDo({ title: "In an Area", areaId: area });
    app.createToDo({ title: "Parked", when: { kind: "someday" } });
    const list = app.createSmartList("Everything");
    expect(matching(list)).toEqual(["In the Inbox", "In an Area"]);
  });
});

describe("which To-dos a Smart List shows", () => {
  it("shows Completed To-dos until they reach the Logbook, but not those in the Trash", () => {
    const done = app.createToDo({ title: "Done today" });
    const old = app.createToDo({ title: "Done yesterday" });
    const binned = app.createToDo({ title: "Binned" });
    const list = app.createSmartList("Everything");
    clock.set("2026-11-25T10:00:00");
    app.complete(old);
    clock.set("2026-11-26T10:00:00");
    app.complete(done);
    app.delete(binned);
    expect(matching(list)).toEqual(["Done today"]);
  });

  it("leaves out To-dos held back by a Someday or future-starting Project", () => {
    const later = app.createProject({ title: "Later" });
    app.setProjectWhen(later, { kind: "date", date: "2026-12-10" });
    const parked = app.createProject({ title: "Parked" });
    app.moveProjectToSomeday(parked);
    app.createToDo({ title: "Waits", projectId: later });
    const dated = app.createToDo({ title: "Has its own date", projectId: later });
    app.setStartDate(dated, "2026-11-30");
    app.createToDo({ title: "Waits too", projectId: parked });
    expect(matching(app.createSmartList("Everything"))).toEqual(["Has its own date"]);
  });

  it("shows Sub-to-dos on their own, labelled with their parent, in list order", () => {
    const parent = app.createToDo({ title: "Plan party" });
    app.createToDo({ title: "Book hall", parentId: parent });
    const entries = app.smartListToDos(app.createSmartList("Everything"));
    expect(entries.map((e) => [e.toDo.title, e.parentTitle])).toEqual([
      ["Plan party", null],
      ["Book hall", "Plan party"],
    ]);
  });
});

describe("editing Smart Lists", () => {
  it("can be renamed, have their filters changed and be deleted, leaving To-dos alone", () => {
    const high = app.createToDo({ title: "Urgent" });
    app.setPriority(high, "high");
    app.createToDo({ title: "Whenever" });
    const list = app.createSmartList("Urgnt", { priority: ["high"] });
    app.renameSmartList(list, "Urgent things");
    expect(app.getSmartList(list).title).toBe("Urgent things");
    expect(matching(list)).toEqual(["Urgent"]);

    app.setSmartListFilters(list, { priority: ["none"] });
    expect(app.getSmartList(list).filters.priority).toEqual(["none"]);
    expect(matching(list)).toEqual(["Whenever"]);

    app.deleteSmartList(list);
    expect(app.smartLists()).toEqual([]);
    expect(app.findSmartList(list)).toBeUndefined();
    expect(titles(app.inbox())).toEqual(["Urgent", "Whenever"]);
  });

  it("keeps its name when renamed to nothing", () => {
    const list = app.createSmartList("Errands");
    app.renameSmartList(list, "  ");
    expect(app.getSmartList(list).title).toBe("Errands");
  });
});

describe("saving Smart Lists", () => {
  it("survives a restart, and a snapshot saved before Smart Lists loads with none", () => {
    const store = memoryStore();
    const first = createMyThings({ clock: fixedClock(NOW), store });
    const errand = first.createTag("Errand");
    first.createSmartList("Errands", { tagIds: [errand], startDate: ["thisWeek"] });

    const saved = JSON.parse(JSON.stringify(store.snapshot()));
    const again = createMyThings({ clock: fixedClock(NOW), store: memoryStore(saved) });
    expect(again.smartLists().map((s) => [s.title, s.filters.tagIds, s.filters.startDate])).toEqual(
      [["Errands", [errand], ["thisWeek"]]],
    );

    delete saved.records.smartLists;
    const old = createMyThings({ clock: fixedClock(NOW), store: memoryStore(saved) });
    expect(old.smartLists()).toEqual([]);
  });
});

describe("the Tags filter", () => {
  it("matches any of its Tags, counting nested Tags and the Project's and Area's Tags", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const home = app.createTag("Home");
    const calls = app.createTag("Calls");
    const area = app.createArea("Garden");
    app.addTag({ kind: "area", id: area }, home);
    const project = app.createProject({ title: "Party" });
    app.addTag({ kind: "project", id: project }, home);
    const post = app.createToDo({ title: "Post parcel" });
    app.addTag({ kind: "toDo", id: post }, errand);
    app.createToDo({ title: "Mow lawn", areaId: area });
    app.createToDo({ title: "Send invites", projectId: project });
    const call = app.createToDo({ title: "Call mum" });
    app.addTag({ kind: "toDo", id: call }, calls);
    app.createToDo({ title: "No Tags" });

    const list = app.createSmartList("Out or home", { tagIds: [out, home] });
    expect(matching(list)).toEqual(["Post parcel", "Mow lawn", "Send invites"]);
  });
});

describe("the Areas and Projects filter", () => {
  it("matches To-dos in a picked Area, directly or in its Projects, or in a picked Project", () => {
    const work = app.createArea("Work");
    const home = app.createArea("Home");
    const report = app.createProject({ title: "Report", areaId: work });
    const move = app.createProject({ title: "Move", areaId: home });
    const garden = app.createProject({ title: "Garden", areaId: home });
    app.createToDo({ title: "Email boss", areaId: work });
    const draft = app.createToDo({ title: "Draft", projectId: report });
    app.createToDo({ title: "Check figures", parentId: draft });
    app.createToDo({ title: "Book van", projectId: move });
    app.createToDo({ title: "Plant bulbs", projectId: garden });
    app.createToDo({ title: "Hoover", areaId: home });
    app.createToDo({ title: "Loose" });

    const list = app.createSmartList("Work or moving", {
      containers: [
        { kind: "area", id: work },
        { kind: "project", id: move },
      ],
    });
    expect(matching(list)).toEqual(["Email boss", "Draft", "Check figures", "Book van"]);
  });
});

describe("the Start date and Deadline filters", () => {
  // Today is Thursday 26 November 2026; this week runs Monday 23 to Sunday 29.
  const days = {
    "last month": "2026-10-30",
    yesterday: "2026-11-25",
    today: "2026-11-26",
    tomorrow: "2026-11-27",
    sunday: "2026-11-29",
    "next tuesday": "2026-12-01",
    "next thursday": "2026-12-03",
  };

  function dated(set: (id: string, date: string) => void) {
    for (const [title, date] of Object.entries(days)) set(app.createToDo({ title }), date);
    app.createToDo({ title: "undated" });
  }

  it("picks Start dates by relative ranges", () => {
    dated((id, date) => app.setStartDate(id, date));
    const by = (range: DateRange) => matching(app.createSmartList(range, { startDate: [range] }));
    expect(by("todayOrEarlier")).toEqual(["last month", "yesterday", "today"]);
    expect(by("today")).toEqual(["today"]);
    expect(by("tomorrow")).toEqual(["tomorrow"]);
    expect(by("thisWeek")).toEqual(["yesterday", "today", "tomorrow", "sunday"]);
    expect(by("next7Days")).toEqual(["today", "tomorrow", "sunday", "next tuesday"]);
    expect(by("thisMonth")).toEqual(["yesterday", "today", "tomorrow", "sunday"]);
    expect(by("hasDate")).toEqual(Object.keys(days));
    expect(by("noDate")).toEqual(["undated"]);
  });

  it("picks Deadlines by the same ranges, several of them combining with OR", () => {
    dated((id, date) => app.setDeadline(id, date));
    const list = app.createSmartList("Due", { deadline: ["tomorrow", "noDate"] });
    expect(matching(list)).toEqual(["tomorrow", "undated"]);
  });

  it("keeps a relative range up to date as the days pass", () => {
    dated((id, date) => app.setStartDate(id, date));
    const list = app.createSmartList("Today", { startDate: ["today"] });
    clock.set("2026-11-27T09:00:00");
    expect(matching(list)).toEqual(["tomorrow"]);
  });
});

describe("the Priority, Energy and Estimate filters", () => {
  beforeEach(() => {
    const plan = (title: string, p: Priority, e: Energy | null, minutes: number | null) => {
      const id = app.createToDo({ title });
      app.setPriority(id, p);
      app.setEnergy(id, e);
      app.setEstimate(id, minutes);
    };
    plan("Pay bill", "high", "low", 5);
    plan("Write essay", "medium", "high", 120);
    plan("Sort photos", "none", null, null);
    plan("Buy stamps", "low", null, 15);
    plan("Clean oven", "none", "high", 16);
  });

  it("picks exact Priorities, none included", () => {
    const list = app.createSmartList("P", { priority: ["high", "none"] });
    expect(matching(list)).toEqual(["Pay bill", "Sort photos", "Clean oven"]);
  });

  it("picks Energy low, high or not set", () => {
    expect(matching(app.createSmartList("E", { energy: ["high"] }))).toEqual([
      "Write essay",
      "Clean oven",
    ]);
    expect(matching(app.createSmartList("E", { energy: ["low", null] }))).toEqual([
      "Pay bill",
      "Sort photos",
      "Buy stamps",
    ]);
  });

  it("picks Estimates up to or more than some minutes, or not set", () => {
    const by = (estimate: EstimateChoice[]) => matching(app.createSmartList("M", { estimate }));
    expect(by([{ kind: "upTo", minutes: 15 }])).toEqual(["Pay bill", "Buy stamps"]);
    expect(by([{ kind: "moreThan", minutes: 15 }])).toEqual(["Write essay", "Clean oven"]);
    expect(by([{ kind: "notSet" }, { kind: "moreThan", minutes: 60 }])).toEqual([
      "Write essay",
      "Sort photos",
    ]);
  });

  it("rejects an Estimate filter that is not a whole, positive number of minutes", () => {
    expect(() => app.createSmartList("M", { estimate: [{ kind: "upTo", minutes: 0 }] })).toThrow();
  });
});

describe("deleted filter values", () => {
  it("drops a deleted Tag, and a kind left with only deleted values matches nothing", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const home = app.createTag("Home");
    const post = app.createToDo({ title: "Post parcel" });
    app.addTag({ kind: "toDo", id: post }, errand);
    const hoover = app.createToDo({ title: "Hoover" });
    app.addTag({ kind: "toDo", id: hoover }, home);
    app.createToDo({ title: "Untagged" });
    const outOrHome = app.createSmartList("Out or home", { tagIds: [out, home] });
    const onlyOut = app.createSmartList("Out", { tagIds: [out] });

    app.deleteTag(out);
    expect(matching(outOrHome)).toEqual(["Hoover"]);
    expect(matching(onlyOut)).toEqual([]);
    expect(app.goneFromSmartList(onlyOut)).toEqual({ tagIds: [out], containers: [] });
  });

  it("drops a deleted Area or a Project in the Trash, and still opens", () => {
    const work = app.createArea("Work");
    const report = app.createProject({ title: "Report" });
    app.createToDo({ title: "Email boss", areaId: work });
    app.createToDo({ title: "Draft", projectId: report });
    app.createToDo({ title: "Loose" });
    const list = app.createSmartList("Work", {
      containers: [
        { kind: "area", id: work },
        { kind: "project", id: report },
      ],
    });

    app.deleteArea(work);
    expect(matching(list)).toEqual(["Draft"]);
    app.deleteProject(report);
    expect(matching(list)).toEqual([]);
    expect(app.goneFromSmartList(list).containers).toEqual([
      { kind: "area", id: work },
      { kind: "project", id: report },
    ]);

    app.restoreProject(report);
    expect(matching(list)).toEqual(["Draft"]);
  });
});

describe("combining filters", () => {
  it("ANDs different kinds and ORs values of one kind", () => {
    const errand = app.createTag("Errand");
    const out = app.createTag("Out");
    const make = (title: string, tag: string | null, minutes: number, start: string | null) => {
      const id = app.createToDo({ title });
      if (tag) app.addTag({ kind: "toDo", id }, tag);
      app.setEstimate(id, minutes);
      if (start) app.setStartDate(id, start);
    };
    make("Post parcel", errand, 10, "2026-11-27");
    make("Get cash", out, 5, "2026-11-23");
    make("Buy paint", errand, 45, "2026-11-27");
    make("Return book", out, 15, "2026-12-03");
    make("Phone dentist", null, 5, "2026-11-26");
    make("Drop keys", errand, 5, null);

    const list = app.createSmartList("Quick errands this week", {
      tagIds: [errand, out],
      estimate: [{ kind: "upTo", minutes: 15 }],
      startDate: ["thisWeek"],
    });
    expect(matching(list)).toEqual(["Post parcel", "Get cash"]);
  });
});
