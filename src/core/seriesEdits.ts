import type { Context } from "./context";
import { addDays, daysBetween } from "./dates";
import type { LocalDate, SeriesField, SeriesPart, SeriesValues, ToDo } from "./types";

/**
 * Editing a repeating To-do: "this one" changes only the current occurrence, and the
 * next occurrence is created from the series as it was; "all future ones" changes
 * the current occurrence, so every later one copies the change.
 */
export type SeriesScope = "thisOne" | "allFuture";

const seriesFields: SeriesField[] = [
  "title",
  "notes",
  "priority",
  "energy",
  "estimate",
  "timeSlot",
];

/** A Checklist item or Sub-to-do, as far as the series is concerned. */
interface Part {
  id: string;
  title: string;
  position: number;
  toDo?: ToDo;
}

type Removed = Extract<SeriesPart, { kind: "removed" }>;

/** What the next occurrence copies from the current one, as far as edits can change it. */
interface Copied {
  fields: Pick<ToDo, SeriesField>;
  deadlineGap: number | null;
  tagIds: string[];
  checklist: Part[];
  subToDos: Part[];
}

function deadlineGap(item: ToDo): number | null {
  return item.deadline && item.startDate ? daysBetween(item.startDate, item.deadline) : null;
}

function checklistParts(ctx: Context, toDoId: string): Part[] {
  return ctx.store
    .all("checklistItems")
    .filter((c) => c.toDoId === toDoId)
    .map(({ id, title, position }) => ({ id, title, position }));
}

function subToDosOf(ctx: Context, parentId: string): ToDo[] {
  return ctx.store.all("toDos").filter((t) => t.parentId === parentId && !t.deletedAt);
}

function copiedFrom(ctx: Context, item: ToDo): Copied {
  const fields = {} as Record<SeriesField, unknown>;
  for (const f of seriesFields) fields[f] = item[f];
  return {
    fields: fields as Pick<ToDo, SeriesField>,
    deadlineGap: deadlineGap(item),
    tagIds: [...item.tagIds],
    checklist: checklistParts(ctx, item.id),
    subToDos: subToDosOf(ctx, item.id).map((t) => ({
      id: t.id,
      title: t.title,
      position: t.position,
      toDo: t,
    })),
  };
}

/** A deep copy of plain, saved data. */
function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function noValues(): SeriesValues {
  return { fields: {}, tags: {}, checklist: {}, subToDos: {} };
}

function isEmpty(values: SeriesValues): boolean {
  return (
    Object.keys(values.fields).length === 0 &&
    !("deadlineGap" in values) &&
    Object.keys(values.tags).length === 0 &&
    Object.keys(values.checklist).length === 0 &&
    Object.keys(values.subToDos).length === 0
  );
}

/**
 * Keeps a value the series had, for "this one", or drops it, for "all future ones".
 * The first "this one" change keeps the series' value; changing back to it drops it.
 */
function recordValue<K extends string>(
  kept: Partial<Record<K, unknown>>,
  key: K,
  before: unknown,
  after: unknown,
  scope: SeriesScope,
): void {
  if (same(before, after)) return;
  if (scope === "thisOne" && !(key in kept)) kept[key] = before;
  if (scope === "allFuture" || same(kept[key], after)) delete kept[key];
}

/** A Tag added for "this one" and then removed again (or the other way round) cancels out. */
function recordTags(
  kept: SeriesValues["tags"],
  before: string[],
  after: string[],
  scope: SeriesScope,
): void {
  const change = (tagId: string, kind: "added" | "removed") => {
    if (scope === "allFuture" || (kept[tagId] && kept[tagId] !== kind)) delete kept[tagId];
    else kept[tagId] = kind;
  };
  for (const t of after) if (!before.includes(t)) change(t, "added");
  for (const t of before) if (!after.includes(t)) change(t, "removed");
}

/**
 * Records added, removed and renamed Checklist items or Sub-to-dos. For "this one"
 * the series keeps what it had; "all future ones" makes the change the series' own.
 */
function recordParts(
  kept: Record<string, SeriesPart>,
  before: Part[],
  after: Part[],
  scope: SeriesScope,
): void {
  const afterById = new Map(after.map((p) => [p.id, p]));
  const beforeIds = new Set(before.map((p) => p.id));
  const changed: { id: string; part: SeriesPart | null }[] = [];
  for (const p of after) {
    if (!beforeIds.has(p.id)) changed.push({ id: p.id, part: { kind: "added" } });
  }
  for (const p of before) {
    const now = afterById.get(p.id);
    const was = kept[p.id];
    if (!now) {
      const title = was?.kind === "renamed" ? was.title : p.title;
      const removed: Removed = { kind: "removed", title, position: p.position };
      if (p.toDo) removed.toDo = { ...p.toDo, title };
      changed.push({ id: p.id, part: was?.kind === "added" ? null : removed });
    } else if (now.title !== p.title) {
      const renamed = was ?? { kind: "renamed", title: p.title };
      const back = renamed.kind === "renamed" && renamed.title === now.title;
      changed.push({ id: p.id, part: back ? null : renamed });
    }
  }
  for (const { id, part } of changed) {
    if (scope === "allFuture" || !part) delete kept[id];
    else kept[id] = part;
  }
}

function recordEdit(
  values: SeriesValues,
  before: Copied,
  after: Copied,
  scope: SeriesScope,
): SeriesValues {
  const next = copyOf(values);
  for (const f of seriesFields) {
    recordValue(next.fields, f, before.fields[f], after.fields[f], scope);
  }
  recordValue(
    next as { deadlineGap?: unknown },
    "deadlineGap",
    before.deadlineGap,
    after.deadlineGap,
    scope,
  );
  recordTags(next.tags, before.tagIds, after.tagIds, scope);
  recordParts(next.checklist, before.checklist, after.checklist, scope);
  recordParts(next.subToDos, before.subToDos, after.subToDos, scope);
  return next;
}

/**
 * What the next occurrence takes from a list of parts: the current ones, less those
 * added for "this one", with the series' titles, plus those removed for "this one".
 */
function partsFor<T extends { id: string; title: string; position: number }>(
  current: T[],
  kept: Record<string, SeriesPart>,
  removed: (id: string, was: Removed) => T | undefined,
): T[] {
  const parts: T[] = [];
  for (const p of current) {
    const was = kept[p.id];
    if (was?.kind === "added") continue;
    parts.push(was?.kind === "renamed" ? { ...p, title: was.title } : p);
  }
  for (const [id, was] of Object.entries(kept)) {
    if (was.kind !== "removed") continue;
    const part = removed(id, was);
    if (part) parts.push(part);
  }
  return parts.sort((a, b) => a.position - b.position);
}

/**
 * The series' own values for the next occurrence, on `date`, where the current one
 * was changed for "this one" only.
 */
export function seriesFieldsFor(ctx: Context, current: ToDo, date: LocalDate): Partial<ToDo> {
  const values = current.seriesValues;
  if (!values) return {};
  const fields: Partial<ToDo> = copyOf(values.fields);
  const { tags } = values;
  fields.tagIds = [
    ...current.tagIds.filter((t) => tags[t] !== "added"),
    ...Object.keys(tags).filter((t) => tags[t] === "removed" && ctx.find("tags", t)),
  ];
  if ("deadlineGap" in values) {
    const gap = values.deadlineGap ?? null;
    fields.deadline = gap === null ? null : addDays(date, gap);
  }
  return fields;
}

/** The Checklist the next occurrence copies from `from`, in order. */
export function seriesChecklist(ctx: Context, from: ToDo): { title: string; position: number }[] {
  const kept = from.seriesValues?.checklist ?? {};
  return partsFor(checklistParts(ctx, from.id), kept, (id, was) => ({
    id,
    title: was.title,
    position: was.position,
  }));
}

/**
 * The Sub-to-dos the next occurrence copies from `from`, with the series' titles. One
 * removed for "this one" comes from the Trash, or as it was if it has been erased.
 */
export function seriesSubToDos(ctx: Context, from: ToDo): ToDo[] {
  const kept = from.seriesValues?.subToDos ?? {};
  return partsFor(subToDosOf(ctx, from.id), kept, (id, was) => {
    const toDo = ctx.find("toDos", id) ?? was.toDo;
    return toDo && { ...toDo, title: was.title };
  });
}

export function seriesEditActions(ctx: Context) {
  return {
    /**
     * Whether editing a field the next occurrence copies asks "this one or all
     * future ones": the To-do is the current occurrence of a repeating To-do.
     */
    asksThisOneOrAllFuture(id: string): boolean {
      return Boolean(ctx.require("toDos", id).repeat);
    },

    /**
     * Makes an edit to a repeating To-do (its fields, Tags, Checklist or Sub-to-dos)
     * for this occurrence only or for all future ones. A To-do that doesn't repeat is
     * just edited.
     */
    editOccurrence(id: string, scope: SeriesScope, edit: () => void): void {
      const item = ctx.require("toDos", id);
      if (!item.repeat) {
        edit();
        return;
      }
      const before = copiedFrom(ctx, item);
      edit();
      const edited = ctx.require("toDos", id);
      const values = recordEdit(
        edited.seriesValues ?? noValues(),
        before,
        copiedFrom(ctx, edited),
        scope,
      );
      ctx.update("toDos", id, { seriesValues: isEmpty(values) ? null : values });
    },
  };
}
