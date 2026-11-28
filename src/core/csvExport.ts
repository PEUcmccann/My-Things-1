import { toLocalDate } from "./clock";
import { byPosition, type Context } from "./context";
import type { ChecklistItem, Moment, Outcome, ToDo } from "./types";

/** The CSV export's columns, in order. Glossary terms, since the file is read outside the app. */
export const csvHeaders = [
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
] as const;

const statuses: Record<Outcome, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** A cell spreadsheets would run as a formula gets a leading `'`. */
const formulaStart = /^[=+\-@]/;

/** One cell, RFC 4180 style: quoted when it holds a comma, quote or line break. */
export function csvCell(value: string): string {
  const safe = formulaStart.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows of cells as CSV text: a UTF-8 byte-order mark, then rows ending in CRLF. */
export function csvText(rows: string[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes from 00:00 as HH:MM. */
const clockTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** A moment in local time as YYYY-MM-DD HH:MM. */
function localMoment(moment: Moment | null): string {
  if (!moment) return "";
  const at = new Date(moment);
  return `${toLocalDate(at)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

const yes = (flag: boolean) => (flag ? "yes" : "");

export function csvQueries(ctx: Context) {
  const { store } = ctx;

  function checklistText(toDoId: string): string {
    return store
      .all("checklistItems")
      .filter((c: ChecklistItem) => c.toDoId === toDoId)
      .sort((a, b) => a.position - b.position)
      .map((c) => `${c.ticked ? "[x]" : "[ ]"} ${c.title}`)
      .join("; ");
  }

  function row(toDo: ToDo): string[] {
    const project = ctx.find("projects", toDo.projectId);
    // A To-do in a Project takes its Area from the Project.
    const area = ctx.find("areas", project ? project.areaId : toDo.areaId);
    const tags = toDo.tagIds
      .map((id) => ctx.find("tags", id)?.title)
      .filter((title): title is string => title !== undefined);
    const slot = toDo.timeSlot;
    return [
      toDo.title,
      toDo.notes,
      statuses[toDo.outcome],
      toDo.startDate ?? "",
      yes(toDo.evening),
      yes(toDo.someday),
      toDo.deadline ?? "",
      area?.title ?? "",
      project?.title ?? "",
      ctx.find("headings", toDo.headingId)?.title ?? "",
      ctx.find("toDos", toDo.parentId)?.title ?? "",
      tags.join("; "),
      toDo.priority,
      toDo.energy ?? "",
      toDo.estimate === null ? "" : String(toDo.estimate),
      slot ? `${clockTime(slot.start)}-${clockTime(slot.end)}` : "",
      toDo.repeat?.rrule ?? "",
      checklistText(toDo.id),
      String(store.all("attachments").filter((a) => a.toDoId === toDo.id).length),
      localMoment(toDo.createdAt),
      localMoment(toDo.finishedAt),
      yes(ctx.isInLogbook(toDo)),
      yes(ctx.isTrashed(toDo)),
      toDo.id,
    ];
  }

  return {
    /**
     * Every To-do as CSV text, to open in a spreadsheet: Sub-to-dos, the Logbook and
     * the Trash included, in list order. For looking at, not restoring (see exportAll).
     */
    toDosCsv(): string {
      const toDos = store.all("toDos").sort(byPosition);
      return csvText([[...csvHeaders], ...toDos.map(row)]);
    },
  };
}
