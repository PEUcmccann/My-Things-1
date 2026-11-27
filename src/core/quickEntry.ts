import type { ListRef } from "./ordering";
import type { Taggable, TagNode } from "./tags";
import { isValidEstimate } from "./planning";
import { endOfDay, isValidTimeSlot, type NewToDo } from "./toDos";
import type { Priority, TimeSlot } from "./types";

/** A word of quick entry text: a run of non-space characters and where it sits. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

/** What a piece of shorthand sets on the new To-do. */
export type QuickEntryValue =
  | { kind: "tag"; path: string[] }
  | { kind: "priority"; priority: Exclude<Priority, "none"> }
  | { kind: "estimate"; minutes: number }
  /** Minutes from 00:00. With no end, the slot lasts the Estimate, or 30 minutes. */
  | { kind: "timeSlot"; start: number; end: number | null };

export type QuickEntryKind = QuickEntryValue["kind"];

/** A recognised piece of shorthand: its text, where it sits, and what it sets. */
export interface QuickEntryToken {
  text: string;
  start: number;
  end: number;
  value: QuickEntryValue;
}

/**
 * Recognises shorthand starting at `words[index]`. It can take one word or several (as a
 * date phrase like "next friday" would), and returns how many words it took and what they
 * set, or null if the words there are plain text.
 */
export type Recogniser = (
  words: Word[],
  index: number,
) => { words: number; value: QuickEntryValue } | null;

/** Matches one word against a pattern; `read` turns the match into a value, or null. */
function wordRecogniser(
  pattern: RegExp,
  read: (match: RegExpExecArray) => QuickEntryValue | null,
): Recogniser {
  return (words, index) => {
    const match = pattern.exec(words[index].text);
    const value = match && read(match);
    return value ? { words: 1, value } : null;
  };
}

/** `#errand`, `#day-off` or `#home/garden`: `#` and a letter, then a path of names. */
const tag = wordRecogniser(/^#(\p{L}[\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}][\p{L}\p{N}_-]*)*)$/u, (m) => ({
  kind: "tag",
  path: m[1].split("/"),
}));

const priorityWords: Record<string, Exclude<Priority, "none">> = {
  low: "low",
  med: "medium",
  medium: "medium",
  high: "high",
};

/** `!low`, `!med`, `!medium` or `!high`, in any case. */
const priority = wordRecogniser(/^!(\p{L}+)$/u, (m) => {
  const word = m[1].toLowerCase();
  return Object.hasOwn(priorityWords, word)
    ? { kind: "priority", priority: priorityWords[word] }
    : null;
});

/** `~15m`, `~1h` or `~1h30m`: whole hours and minutes, as Estimates are shown. */
const estimate = wordRecogniser(/^~(?:(\d+)h)?(?:(\d+)m)?$/i, (m) => {
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return isValidEstimate(minutes) ? { kind: "estimate", minutes } : null;
});

/** A 24-hour time, `9:00` or `09:00`, as minutes from 00:00; 24:00 only as an end. */
function clockTime(hours: string, minutes: string, isEnd: boolean): number | null {
  const time = Number(hours) * 60 + Number(minutes);
  return Number(minutes) < 60 && (time < endOfDay || (isEnd && time === endOfDay)) ? time : null;
}

/** `@14:00` or `@14:00-14:30`: a Time slot, by the same rules as the detail's. */
const timeSlot = wordRecogniser(/^@(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/, (m) => {
  const start = clockTime(m[1], m[2], false);
  if (start === null) return null;
  if (m[3] === undefined) return { kind: "timeSlot", start, end: null };
  const end = clockTime(m[3], m[4], true);
  return end !== null && isValidTimeSlot({ start, end }) ? { kind: "timeSlot", start, end } : null;
});

/**
 * Every kind of shorthand, tried in order at each word. Add a Recogniser here for a new
 * kind, with a case for it in createFromQuickEntry.
 */
export const recognisers: Recogniser[] = [tag, priority, estimate, timeSlot];

/** Kinds where only the last token counts; earlier ones stay in the title as text. */
const lastWins: ReadonlySet<QuickEntryKind> = new Set<QuickEntryKind>([
  "priority",
  "estimate",
  "timeSlot",
]);

function wordsOf(text: string): Word[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

export interface ParsedQuickEntry {
  /** The title with the shorthand taken out. */
  title: string;
  tokens: QuickEntryToken[];
}

/**
 * Reads shorthand out of quick entry text. A token is whole words: it starts the text or
 * follows a space, and ends at a space or the end. Tokens starting at an offset in
 * `ignored` are kept as plain text, which is how a tapped-away highlight stays in the title.
 */
export function parseQuickEntry(text: string, ignored: readonly number[] = []): ParsedQuickEntry {
  const words = wordsOf(text);
  const found: QuickEntryToken[] = [];
  for (let i = 0; i < words.length; i++) {
    if (ignored.includes(words[i].start)) continue;
    for (const recognise of recognisers) {
      const match = recognise(words, i);
      if (!match) continue;
      const last = words[i + match.words - 1];
      found.push({
        text: text.slice(words[i].start, last.end),
        start: words[i].start,
        end: last.end,
        value: match.value,
      });
      i += match.words - 1;
      break;
    }
  }
  const tokens = found.filter(
    (t, i) =>
      !lastWins.has(t.value.kind) || !found.slice(i + 1).some((u) => u.value.kind === t.value.kind),
  );
  let title = "";
  let from = 0;
  for (const t of tokens) {
    title += text.slice(from, t.start) + " ";
    from = t.end;
  }
  title += text.slice(from);
  return { title: title.replace(/\s+/g, " ").trim(), tokens };
}

/** A Tag name compared loosely: case ignored, `-` and `_` read as spaces. */
const loose = (name: string) =>
  name.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

/** A Tag name as typed, with `-` and `_` turned into spaces, for a new Tag. */
const typedName = (name: string) => name.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

/** How a Tag path in quick entry matches the Tag tree. */
export interface TagMatch {
  /** The existing Tag the whole path names, or null if some of it is new. */
  tagId: string | null;
  /** The deepest existing Tag the path starts from, under which the rest is created. */
  parentId: string | null;
  /** The names still to create, outermost first. */
  missing: string[];
}

/**
 * Finds the Tag a path names, matching by title at any depth (the first in Tag-tree order),
 * with each earlier name in the path naming the Tag's parent, grandparent and so on. If the
 * whole path is not there, the longest start of it that is says where to create the rest.
 */
export function matchTagPath(tree: TagNode[], path: string[]): TagMatch {
  const byId = new Map(tree.map((n) => [n.tag.id, n.tag]));
  const endsWith = (tagId: string, names: string[]) => {
    let tag = byId.get(tagId);
    for (let i = names.length - 1; i >= 0; i--) {
      if (!tag || loose(tag.title) !== loose(names[i])) return false;
      tag = tag.parentId ? byId.get(tag.parentId) : undefined;
    }
    return true;
  };
  for (let k = path.length; k > 0; k--) {
    const found = tree.find((n) => endsWith(n.tag.id, path.slice(0, k)));
    if (found) {
      return k === path.length
        ? { tagId: found.tag.id, parentId: found.tag.parentId, missing: [] }
        : { tagId: null, parentId: found.tag.id, missing: path.slice(k).map(typedName) };
    }
  }
  return { tagId: null, parentId: null, missing: path.map(typedName) };
}

/** A token as the new To-do sheet shows it; a Tag token says whether the Tag is new. */
export type QuickEntryPreviewToken = QuickEntryToken & { newTag?: boolean };

export interface QuickEntryPreview {
  title: string;
  tokens: QuickEntryPreviewToken[];
}

export interface QuickEntryOptions {
  /** Where the To-do is filed and its "When", as for createToDo. */
  placement?: Omit<NewToDo, "title">;
  /** A spot in a list to put the To-do at. */
  at?: { list: ListRef; beforeId: string | null };
  /** Offsets of tokens to keep as plain text. */
  ignored?: readonly number[];
}

/** The actions quick entry builds on. */
interface Base {
  createToDo(input: NewToDo & { at?: QuickEntryOptions["at"] }): string;
  tagTree(): TagNode[];
  createTag(title: string, parentId?: string | null): string;
  addTag(target: Taggable, tagId: string): void;
  setPriority(id: string, priority: Priority): void;
  setEstimate(id: string, minutes: number | null): void;
  setTimeSlot(id: string, slot: TimeSlot | null): void;
  suggestedSlotEnd(id: string, start: number): number;
}

/** Quick entry: a new To-do's title with shorthand that sets its properties. */
export function quickEntryActions(base: Base) {
  function ensureTag(path: string[]): string {
    const match = matchTagPath(base.tagTree(), path);
    if (match.tagId) return match.tagId;
    let parentId = match.parentId;
    for (const name of match.missing) parentId = base.createTag(name, parentId);
    return parentId!;
  }

  return {
    /** What quick entry text would create: the cleaned title and the shorthand found. */
    previewQuickEntry(text: string, ignored: readonly number[] = []): QuickEntryPreview {
      const { title, tokens } = parseQuickEntry(text, ignored);
      const tree = base.tagTree();
      return {
        title,
        tokens: tokens.map((t) =>
          t.value.kind === "tag" ? { ...t, newTag: !matchTagPath(tree, t.value.path).tagId } : t,
        ),
      };
    },

    /**
     * Creates a To-do from quick entry text, applying its shorthand. Returns the new
     * To-do's id, or null when nothing is left for a title.
     */
    createFromQuickEntry(text: string, options: QuickEntryOptions = {}): string | null {
      const { title, tokens } = parseQuickEntry(text, options.ignored);
      if (!title) return null;
      const id = base.createToDo({ ...options.placement, title, at: options.at });
      // The Time slot goes last, so a slot with no end can use the Estimate.
      const ordered = [...tokens].sort(
        (a, b) => Number(a.value.kind === "timeSlot") - Number(b.value.kind === "timeSlot"),
      );
      for (const { value } of ordered) {
        switch (value.kind) {
          case "tag":
            base.addTag({ kind: "toDo", id }, ensureTag(value.path));
            break;
          case "priority":
            base.setPriority(id, value.priority);
            break;
          case "estimate":
            base.setEstimate(id, value.minutes);
            break;
          case "timeSlot":
            base.setTimeSlot(id, {
              start: value.start,
              end: value.end ?? base.suggestedSlotEnd(id, value.start),
            });
            break;
        }
      }
      return id;
    },
  };
}
