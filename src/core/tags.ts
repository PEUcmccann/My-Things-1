import { byCreation, byPosition, type Context, type ToDoEntry } from "./context";
import type { Area, Project, Tag, ToDo } from "./types";

/** Something a Tag can be attached to. */
export type Taggable =
  { kind: "toDo"; id: string } | { kind: "project"; id: string } | { kind: "area"; id: string };

/** A Tag in the Tag tree, with how deeply it is nested. */
export interface TagNode {
  tag: Tag;
  depth: number;
}

export interface TaggedItems {
  areas: Area[];
  projects: Project[];
  toDos: ToDoEntry[];
}

const collectionOf = { toDo: "toDos", project: "projects", area: "areas" } as const;

export function tagActions(ctx: Context) {
  const { store } = ctx;

  const own = (item: { tagIds?: string[] }) => item.tagIds ?? [];

  function childrenOf(id: string | null): Tag[] {
    return store
      .all("tags")
      .filter((t) => t.parentId === id)
      .sort((a, b) => a.title.localeCompare(b.title) || byCreation(a, b));
  }

  /** The Tag and every Tag nested under it, at any depth. */
  function withDescendants(ids: string[]): Set<string> {
    const found = new Set<string>();
    const visit = (id: string) => {
      if (found.has(id)) return;
      found.add(id);
      for (const child of childrenOf(id)) visit(child.id);
    };
    ids.forEach(visit);
    return found;
  }

  function projectTags(project: Project | undefined): string[] {
    if (!project) return [];
    return [...own(project), ...own(ctx.find("areas", project.areaId) ?? {})];
  }

  /** A To-do's own Tags plus those of its Project and Area, used for filtering. */
  function effectiveToDoTags(item: ToDo): string[] {
    return [
      ...own(item),
      ...projectTags(ctx.find("projects", item.projectId)),
      ...own(ctx.find("areas", item.areaId) ?? {}),
    ];
  }

  const hasAny = (tags: string[], wanted: Set<string>) => tags.some((t) => wanted.has(t));

  function setTagIds(target: Taggable, tagIds: string[]): void {
    for (const t of tagIds) ctx.require("tags", t);
    ctx.update(collectionOf[target.kind], target.id, { tagIds: [...new Set(tagIds)] });
  }

  function tagIdsOf(target: Taggable): string[] {
    return own(ctx.require(collectionOf[target.kind], target.id));
  }

  return {
    createTag(title: string, parentId: string | null = null): string {
      if (parentId) ctx.require("tags", parentId);
      const meta = ctx.meta();
      store.put("tags", { ...meta, title: title.trim() || "New Tag", parentId });
      return meta.id;
    },

    renameTag(id: string, title: string): void {
      if (title.trim()) ctx.update("tags", id, { title: title.trim() });
    },

    /**
     * Nests a Tag under another, or takes it out of any parent with null. A Tag
     * cannot be nested under itself or one of its own children.
     */
    setTagParent(id: string, parentId: string | null): void {
      ctx.require("tags", id);
      if (parentId !== null) {
        ctx.require("tags", parentId);
        if (withDescendants([id]).has(parentId)) {
          throw new Error("A Tag cannot be nested under itself or one of its children");
        }
      }
      ctx.update("tags", id, { parentId });
    },

    /**
     * Deletes a Tag and removes it from every item. Tags nested under it move up
     * to its parent.
     */
    deleteTag(id: string): void {
      const tag = ctx.require("tags", id);
      for (const child of childrenOf(id)) ctx.update("tags", child.id, { parentId: tag.parentId });
      for (const name of ["toDos", "projects", "areas"] as const) {
        for (const item of store.all(name)) {
          if (own(item).includes(id)) {
            ctx.update(name, item.id, { tagIds: own(item).filter((t) => t !== id) });
          }
        }
      }
      store.remove("tags", id);
    },

    getTag(id: string): Tag {
      return ctx.require("tags", id);
    },

    findTag(id: string): Tag | undefined {
      return ctx.find("tags", id);
    },

    /** Every Tag, with nested Tags under their parent, alphabetically at each level. */
    tagTree(): TagNode[] {
      const out: TagNode[] = [];
      const walk = (parentId: string | null, depth: number) => {
        for (const tag of childrenOf(parentId)) {
          out.push({ tag, depth });
          walk(tag.id, depth + 1);
        }
      };
      walk(null, 0);
      return out;
    },

    /** The Tags attached to a To-do, Project or Area. */
    tagsOf(target: Taggable): Tag[] {
      return tagIdsOf(target)
        .map((t) => ctx.find("tags", t))
        .filter((t): t is Tag => Boolean(t));
    },

    setTags: setTagIds,

    addTag(target: Taggable, tagId: string): void {
      setTagIds(target, [...tagIdsOf(target), tagId]);
    },

    removeTag(target: Taggable, tagId: string): void {
      setTagIds(
        target,
        tagIdsOf(target).filter((t) => t !== tagId),
      );
    },

    /**
     * Keeps the To-dos that have any of the Tags, counting Tags nested under
     * them and Tags on the To-do's Project and Area. No Tags keeps everything.
     */
    filterByTags<E extends { toDo: ToDo }>(entries: E[], tagIds: string[]): E[] {
      if (tagIds.length === 0) return entries;
      const wanted = withDescendants(tagIds);
      return entries.filter((e) => hasAny(effectiveToDoTags(e.toDo), wanted));
    },

    /** Keeps the Projects that have any of the Tags, themselves or through their Area. */
    filterProjectsByTags(projects: Project[], tagIds: string[]): Project[] {
      if (tagIds.length === 0) return projects;
      const wanted = withDescendants(tagIds);
      return projects.filter((p) => hasAny(projectTags(p), wanted));
    },

    /** Everything with a Tag (or a Tag nested under it), for the Tag's own screen. */
    tagged(tagId: string): TaggedItems {
      const wanted = withDescendants([tagId]);
      return {
        areas: store
          .all("areas")
          .filter((a) => hasAny(own(a), wanted))
          .sort(byPosition),
        projects: store
          .all("projects")
          .filter((p) => ctx.isProjectOpenInLists(p) && hasAny(projectTags(p), wanted))
          .sort(byPosition),
        toDos: store
          .all("toDos")
          .filter((t) => ctx.isOpenInLists(t) && hasAny(effectiveToDoTags(t), wanted))
          .sort(byPosition)
          .map(ctx.entry),
      };
    },
  };
}
