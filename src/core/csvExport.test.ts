import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock, type MyThings } from "./index";
import { NEXT_WEEK, setup, TODAY, TOMORROW } from "./testSetup";

let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
});

const header = [
  "Title",
  "Notes",
  "Status",
  "Start date",
  "This Evening",
  "Someday",
  "Deadline",
  "Area",
  "Project",
  "Heading",
  "Parent To-do",
  "Tags",
  "Priority",
  "Energy",
  "Estimate (minutes)",
  "Time slot",
  "Repeat rule",
  "Checklist",
  "Attachments",
  "Created",
  "Finished",
  "In Logbook",
  "In Trash",
  "ID",
];

/** Reads RFC 4180 text back into rows, so tests can check cells. */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  expect(cell).toBe("");
  expect(row).toEqual([]);
  return rows;
}

/** The rows after the header, as objects keyed by column. */
function records(): Record<string, string>[] {
  const [head, ...rest] = parse(app.toDosCsv().slice(1));
  return rest.map((cells) => Object.fromEntries(head!.map((h, i) => [h, cells[i] ?? ""])));
}

const byTitle = (title: string) => records().find((r) => r.Title === title)!;

describe("the CSV of To-dos", () => {
  it("starts with a byte-order mark and the header, with CRLF line ends", () => {
    const text = app.toDosCsv();
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toBe("﻿" + header.join(",") + "\r\n");
  });

  it("writes a plain To-do with empty or default cells", () => {
    const id = app.createToDo({ title: "Buy milk" });
    expect(records()).toEqual([
      {
        Title: "Buy milk",
        Notes: "",
        Status: "Active",
        "Start date": "",
        "This Evening": "",
        Someday: "",
        Deadline: "",
        Area: "",
        Project: "",
        Heading: "",
        "Parent To-do": "",
        Tags: "",
        Priority: "none",
        Energy: "",
        "Estimate (minutes)": "",
        "Time slot": "",
        "Repeat rule": "",
        Checklist: "",
        Attachments: "0",
        Created: "2026-11-26 10:00",
        Finished: "",
        "In Logbook": "",
        "In Trash": "",
        ID: id,
      },
    ]);
  });

  it("writes every column for a To-do that uses it", () => {
    const area = app.createArea("Home");
    const project = app.createProject({ title: "Move house", areaId: area });
    const heading = app.createHeading(project, "Pack");
    const id = app.createToDo({ title: "Boxes", headingId: heading, when: { kind: "today" } });
    app.editToDo(id, { notes: "Big ones" });
    app.setDeadline(id, NEXT_WEEK);
    app.addTag({ kind: "toDo", id }, app.createTag("errand"));
    app.addTag({ kind: "toDo", id }, app.createTag("car"));
    app.setPriority(id, "high");
    app.setEnergy(id, "low");
    app.setEstimate(id, 45);
    app.setTimeSlot(id, { start: 9 * 60 + 5, end: 10 * 60 + 30 });
    app.addChecklistItem(id, "Tape");
    app.tickChecklistItem(app.addChecklistItem(id, "Markers"), true);
    expect(byTitle("Boxes")).toMatchObject({
      Notes: "Big ones",
      "Start date": TODAY,
      Deadline: NEXT_WEEK,
      Area: "Home",
      Project: "Move house",
      Heading: "Pack",
      Tags: "errand; car",
      Priority: "high",
      Energy: "low",
      "Estimate (minutes)": "45",
      "Time slot": "09:05-10:30",
      Checklist: "[ ] Tape; [x] Markers",
    });
  });

  it("marks This Evening and Someday", () => {
    app.createToDo({ title: "Read", when: { kind: "thisEvening" } });
    app.createToDo({ title: "Cello", when: { kind: "someday" } });
    expect(byTitle("Read")).toMatchObject({ "This Evening": "yes", Someday: "" });
    expect(byTitle("Cello")).toMatchObject({ "This Evening": "", Someday: "yes" });
  });

  it("writes an Area filed directly and a high Energy", () => {
    const id = app.createToDo({ title: "Fix tap", areaId: app.createArea("Home") });
    app.setEnergy(id, "high");
    expect(byTitle("Fix tap")).toMatchObject({ Area: "Home", Project: "", Energy: "high" });
  });

  it("writes the Repeat rule as its RRULE", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "weekly", interval: 2, byDay: ["MO", "TH"] });
    expect(byTitle("Water plants")["Repeat rule"]).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;WKST=MO",
    );
  });

  it("leaves the Repeat rule empty once removed", () => {
    const id = app.createToDo({ title: "Water plants", when: { kind: "today" } });
    app.setRepeat(id, { freq: "daily", interval: 1 });
    app.setRepeat(id, null);
    expect(byTitle("Water plants")["Repeat rule"]).toBe("");
  });

  it("includes Sub-to-dos, naming their parent", () => {
    const parent = app.createToDo({ title: "Trip" });
    app.createToDo({ title: "Pack bag", parentId: parent });
    expect(byTitle("Pack bag")["Parent To-do"]).toBe("Trip");
    expect(byTitle("Trip")["Parent To-do"]).toBe("");
  });

  it("includes finished To-dos, with when they were finished, and the Logbook", () => {
    const done = app.createToDo({ title: "Post letter" });
    const dropped = app.createToDo({ title: "Old plan" });
    clock.set("2026-11-26T14:07:00");
    app.complete(done);
    app.cancel(dropped);
    expect(byTitle("Post letter")).toMatchObject({
      Status: "Completed",
      Finished: "2026-11-26 14:07",
      "In Logbook": "",
    });
    expect(byTitle("Old plan")).toMatchObject({ Status: "Cancelled" });
    clock.set(`${TOMORROW}T09:00:00`);
    expect(byTitle("Post letter")["In Logbook"]).toBe("yes");
  });

  it("includes the Trash, Sub-to-dos of a trashed To-do too, but not what's removed for good", () => {
    const parent = app.createToDo({ title: "Old idea" });
    app.createToDo({ title: "Part of it", parentId: parent });
    app.delete(parent);
    expect(byTitle("Old idea")["In Trash"]).toBe("yes");
    expect(byTitle("Part of it")["In Trash"]).toBe("yes");
    app.emptyTrash();
    expect(records()).toEqual([]);
  });

  it("follows the shared list order", () => {
    const a = app.createToDo({ title: "A" });
    const b = app.createToDo({ title: "B" });
    app.createToDo({ title: "C" });
    app.placeToDo({ kind: "inbox" }, b, a);
    expect(records().map((r) => r.Title)).toEqual(["B", "A", "C"]);
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    const id = app.createToDo({ title: 'Say "hi", then go' });
    app.editToDo(id, { notes: "Line one\nLine two\r\nthree" });
    const text = app.toDosCsv();
    expect(text).toContain('"Say ""hi"", then go","Line one\nLine two\r\nthree",Active,');
    expect(byTitle('Say "hi", then go').Notes).toBe("Line one\nLine two\r\nthree");
  });

  it("stops spreadsheets running a cell as a formula", () => {
    for (const title of ["=HYPERLINK(1)", "+1", "-dash", "@who"]) app.createToDo({ title });
    const id = app.createToDo({ title: "Safe" });
    app.editToDo(id, { notes: '=SUM(A1,"x")' });
    expect(records().map((r) => r.Title)).toEqual([
      "'=HYPERLINK(1)",
      "'+1",
      "'-dash",
      "'@who",
      "Safe",
    ]);
    expect(app.toDosCsv()).toContain(`"'=SUM(A1,""x"")"`);
  });
});
