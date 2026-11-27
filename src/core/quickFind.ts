import { byPosition, type Context, type ToDoEntry } from "./context";
import type { Area, Heading, Project, Tag } from "./types";

/** Where a To-do matched the search. */
export type MatchField = "title" | "notes" | "checklist";

export interface ToDoMatch extends ToDoEntry {
  field: MatchField;
  /** The matching text, for notes and Checklist items. */
  excerpt: string | null;
}

export interface QuickFindResults {
  areas: Area[];
  projects: Project[];
  headings: { heading: Heading; projectTitle: string }[];
  tags: Tag[];
  toDos: ToDoMatch[];
}

export interface QuickFindOptions {
  /** Also search Completed and Cancelled items in the Logbook. */
  includeLogbook?: boolean;
}

/** Lower case without accents, so "Cafe" finds "café". */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const excerptRadius = 40;

function excerptAround(text: string, word: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = normalizeForSearch(flat).indexOf(word);
  const start = Math.max(0, at - excerptRadius);
  const end = Math.min(flat.length, at + word.length + excerptRadius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

export function quickFindQueries(ctx: Context) {
  const { store } = ctx;

  return {
    /**
     * Quick Find: searches To-do titles, notes and Checklist items, Area, Project
     * and Heading names, and Tags, ignoring capitals and accents. Every word must
     * appear somewhere in the same text. Results are grouped by type. Logbook items
     * only show when asked for, and the Trash never does.
     */
    quickFind(query: string, opts: QuickFindOptions = {}): QuickFindResults {
      const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
      const empty: QuickFindResults = {
        areas: [],
        projects: [],
        headings: [],
        tags: [],
        toDos: [],
      };
      if (words.length === 0) return empty;
      const matches = (text: string) => {
        const n = normalizeForSearch(text);
        return words.every((w) => n.includes(w));
      };
      const projectShown = (p: Project) =>
        !p.deletedAt && (opts.includeLogbook || !ctx.isInLogbook(p));

      const toDos: ToDoMatch[] = [];
      for (const t of store.all("toDos").sort(byPosition)) {
        if (ctx.isTrashed(t)) continue;
        if (!opts.includeLogbook && ctx.isInLogbook(t)) continue;
        if (matches(t.title)) {
          toDos.push({ ...ctx.entry(t), field: "title", excerpt: null });
        } else if (matches(t.notes ?? "")) {
          toDos.push({
            ...ctx.entry(t),
            field: "notes",
            excerpt: excerptAround(t.notes, words[0]),
          });
        } else {
          const item = store
            .all("checklistItems")
            .find((c) => c.toDoId === t.id && matches(c.title));
          if (item) toDos.push({ ...ctx.entry(t), field: "checklist", excerpt: item.title });
        }
      }

      return {
        areas: store
          .all("areas")
          .filter((a) => matches(a.title))
          .sort(byPosition),
        projects: store
          .all("projects")
          .filter((p) => projectShown(p) && matches(p.title))
          .sort(byPosition),
        headings: store
          .all("headings")
          .filter((h) => matches(h.title) && (opts.includeLogbook || !h.archivedAt))
          .map((heading) => ({ heading, project: ctx.find("projects", heading.projectId) }))
          .filter(({ project }) => project && projectShown(project))
          .map(({ heading, project }) => ({ heading, projectTitle: project!.title }))
          .sort((a, b) => byPosition(a.heading, b.heading)),
        tags: store
          .all("tags")
          .filter((t) => matches(t.title))
          .sort((a, b) => a.title.localeCompare(b.title)),
        toDos,
      };
    },
  };
}
