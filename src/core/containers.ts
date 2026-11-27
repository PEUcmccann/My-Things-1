import { byPosition, type Context, type ToDoEntry } from "./context";
import { whenFields, type When } from "./toDos";
import type { Area, LocalDate, Project } from "./types";

export interface NewProject {
  title: string;
  areaId?: string;
}

export interface Progress {
  completed: number;
  /** Every To-do in the Project except Cancelled ones. */
  total: number;
}

export interface AreaContents {
  projects: Project[];
  toDos: ToDoEntry[];
}

export interface SidebarArea {
  area: Area;
  projects: Project[];
}

export interface SidebarTree {
  /** Projects with no Area. */
  projects: Project[];
  areas: SidebarArea[];
}

export function containerActions(ctx: Context) {
  const { store } = ctx;

  const projectInLists = (p: Project) => ctx.isProjectOpenInLists(p);

  return {
    createArea(title: string): string {
      const meta = ctx.meta();
      store.put("areas", {
        ...meta,
        title: title.trim() || "New Area",
        tagIds: [],
        position: ctx.nextPosition("areas"),
      });
      return meta.id;
    },

    renameArea(id: string, title: string): void {
      if (title.trim()) ctx.update("areas", id, { title: title.trim() });
    },

    /**
     * Deletes an Area. Its Projects are kept with no Area and the To-dos filed
     * directly in it go back to the Inbox.
     */
    deleteArea(id: string): void {
      ctx.require("areas", id);
      for (const p of store.all("projects")) {
        if (p.areaId === id) ctx.update("projects", p.id, { areaId: null });
      }
      for (const t of store.all("toDos")) {
        if (t.areaId === id) ctx.update("toDos", t.id, { areaId: null });
      }
      store.remove("areas", id);
    },

    getArea(id: string): Area {
      return ctx.require("areas", id);
    },

    findArea(id: string): Area | undefined {
      return ctx.find("areas", id);
    },

    areas(): Area[] {
      return store.all("areas").sort(byPosition);
    },

    createProject(input: NewProject): string {
      const meta = ctx.meta();
      store.put("projects", {
        ...meta,
        position: ctx.nextPosition("projects"),
        title: input.title.trim() || "New Project",
        notes: "",
        tagIds: [],
        areaId: input.areaId ? ctx.require("areas", input.areaId).id : null,
        outcome: "active",
        finishedAt: null,
        loggedAt: null,
        startDate: null,
        someday: false,
        deadline: null,
        deletedAt: null,
      });
      return meta.id;
    },

    renameProject(id: string, title: string): void {
      if (title.trim()) ctx.update("projects", id, { title: title.trim() });
    },

    setProjectNotes(id: string, notes: string): void {
      ctx.update("projects", id, { notes });
    },

    /** Moves a Project into an Area, or out of any Area with null. */
    moveProject(id: string, areaId: string | null): void {
      ctx.update("projects", id, { areaId: areaId ? ctx.require("areas", areaId).id : null });
    },

    moveProjectToSomeday(id: string): void {
      ctx.update("projects", id, { startDate: null, someday: true });
    },

    /** Sets a Project's "When". Projects have no This Evening, so it means Today. */
    setProjectWhen(id: string, when: When): void {
      const { startDate, someday } = whenFields(
        when.kind === "thisEvening" ? { kind: "today" } : when,
        ctx.clock.today(),
      );
      ctx.update("projects", id, { startDate, someday });
    },

    setProjectDeadline(id: string, date: LocalDate | null): void {
      ctx.update("projects", id, { deadline: date });
    },

    getProject(id: string): Project {
      return ctx.require("projects", id);
    },

    findProject(id: string): Project | undefined {
      return ctx.find("projects", id);
    },

    /** The To-dos filed in a Project, as shown on its screen. */
    projectToDos(id: string): ToDoEntry[] {
      return store
        .all("toDos")
        .filter((t) => t.projectId === id && ctx.isOpenInLists(t))
        .sort(byPosition)
        .map(ctx.entry);
    },

    /** How much of a Project is Completed. Cancelled To-dos count on neither side. */
    projectProgress(id: string): Progress {
      const toDos = store.all("toDos").filter((t) => t.projectId === id && !ctx.isTrashed(t));
      return {
        completed: toDos.filter((t) => t.outcome === "completed").length,
        total: toDos.filter((t) => t.outcome !== "cancelled").length,
      };
    },

    /** An Area's Projects and the To-dos filed directly in it. */
    areaContents(id: string): AreaContents {
      return {
        projects: store
          .all("projects")
          .filter((p) => p.areaId === id && projectInLists(p))
          .sort(byPosition),
        toDos: store
          .all("toDos")
          .filter((t) => t.areaId === id && !t.projectId && ctx.isOpenInLists(t))
          .sort(byPosition)
          .map(ctx.entry),
      };
    },

    /** Areas with their Projects nested underneath, plus Projects with no Area. */
    sidebar(): SidebarTree {
      const projects = store.all("projects").filter(projectInLists).sort(byPosition);
      return {
        projects: projects.filter((p) => !p.areaId),
        areas: store
          .all("areas")
          .sort(byPosition)
          .map((area) => ({ area, projects: projects.filter((p) => p.areaId === area.id) })),
      };
    },
  };
}
