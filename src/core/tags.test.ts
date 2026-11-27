import { beforeEach, describe, expect, it } from "vitest";
import type { MyThings } from "./index";
import { setup } from "./testSetup";

let app: MyThings;

beforeEach(() => {
  ({ app } = setup());
});

const tree = () => app.tagTree().map((n) => `${"  ".repeat(n.depth)}${n.tag.title}`);
const titles = (entries: { toDo: { title: string } }[]) => entries.map((e) => e.toDo.title);
const filtered = (tagIds: string[]) => titles(app.filterByTags(app.inbox(), tagIds));

describe("creating and nesting Tags", () => {
  it("nests Tags under a parent", () => {
    const out = app.createTag("Out");
    app.createTag("Errand", out);
    app.createTag("Home");
    expect(tree()).toEqual(["Home", "Out", "  Errand"]);
  });

  it("can rename, nest and un-nest a Tag", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Erand");
    app.renameTag(errand, "Errand");
    app.setTagParent(errand, out);
    expect(tree()).toEqual(["Out", "  Errand"]);
    app.setTagParent(errand, null);
    expect(tree()).toEqual(["Errand", "Out"]);
  });

  it("cannot nest a Tag under itself or one of its children", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const shop = app.createTag("Shop", errand);
    expect(() => app.setTagParent(out, out)).toThrow();
    expect(() => app.setTagParent(out, shop)).toThrow();
    expect(tree()).toEqual(["Out", "  Errand", "    Shop"]);
  });
});

describe("tagging", () => {
  it("adds and removes Tags on To-dos, Projects and Areas", () => {
    const tag = app.createTag("Urgent");
    const toDo = app.createToDo({ title: "Pay rent" });
    const project = app.createProject({ title: "Move house" });
    const area = app.createArea("Home");
    for (const target of [
      { kind: "toDo" as const, id: toDo },
      { kind: "project" as const, id: project },
      { kind: "area" as const, id: area },
    ]) {
      app.addTag(target, tag);
      expect(app.tagsOf(target).map((t) => t.title)).toEqual(["Urgent"]);
      app.removeTag(target, tag);
      expect(app.tagsOf(target)).toEqual([]);
    }
  });

  it("adds a Tag only once", () => {
    const tag = app.createTag("Urgent");
    const toDo = app.createToDo({ title: "Pay rent" });
    app.addTag({ kind: "toDo", id: toDo }, tag);
    app.addTag({ kind: "toDo", id: toDo }, tag);
    expect(app.tagsOf({ kind: "toDo", id: toDo })).toHaveLength(1);
  });
});

describe("filtering by Tag", () => {
  it("keeps To-dos with any of the selected Tags", () => {
    const home = app.createTag("Home");
    const work = app.createTag("Work");
    const other = app.createTag("Other");
    const a = app.createToDo({ title: "Fix tap" });
    const b = app.createToDo({ title: "Send report" });
    app.createToDo({ title: "Untagged" });
    const d = app.createToDo({ title: "Other thing" });
    app.addTag({ kind: "toDo", id: a }, home);
    app.addTag({ kind: "toDo", id: b }, work);
    app.addTag({ kind: "toDo", id: d }, other);
    expect(filtered([home, work])).toEqual(["Fix tap", "Send report"]);
  });

  it("keeps everything when no Tag is selected", () => {
    app.createToDo({ title: "Untagged" });
    expect(filtered([])).toEqual(["Untagged"]);
  });

  it("includes To-dos tagged with a child of the selected Tag", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const id = app.createToDo({ title: "Buy stamps" });
    app.addTag({ kind: "toDo", id }, errand);
    expect(filtered([out])).toEqual(["Buy stamps"]);
    expect(filtered([errand])).toEqual(["Buy stamps"]);
  });

  it("does not include a parent's To-dos when filtering by the child", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const id = app.createToDo({ title: "Go for a walk" });
    app.addTag({ kind: "toDo", id }, out);
    expect(filtered([errand])).toEqual([]);
  });

  it("counts the Tags of a To-do's Project and Area without storing them on it", () => {
    const work = app.createTag("Work");
    const urgent = app.createTag("Urgent");
    const area = app.createArea("Job");
    const project = app.createProject({ title: "Launch", areaId: area });
    app.addTag({ kind: "area", id: area }, work);
    app.addTag({ kind: "project", id: project }, urgent);
    const id = app.createToDo({ title: "Write press release", projectId: project });
    const filter = (tags: string[]) => titles(app.filterByTags(app.projectToDos(project), tags));
    expect(filter([work])).toEqual(["Write press release"]);
    expect(filter([urgent])).toEqual(["Write press release"]);
    expect(app.tagsOf({ kind: "toDo", id })).toEqual([]);
  });

  it("filters Projects by their own and their Area's Tags", () => {
    const work = app.createTag("Work");
    const area = app.createArea("Job");
    app.addTag({ kind: "area", id: area }, work);
    app.createProject({ title: "Launch", areaId: area });
    app.createProject({ title: "Holiday" });
    const projects = app.filterProjectsByTags(app.projectsIn("anytime"), [work]);
    expect(projects.map((p) => p.title)).toEqual(["Launch"]);
  });

  it("lists everything with a Tag on the Tag's screen", () => {
    const out = app.createTag("Out");
    const errand = app.createTag("Errand", out);
    const area = app.createArea("Town");
    app.addTag({ kind: "area", id: area }, out);
    const project = app.createProject({ title: "Christmas shopping" });
    app.addTag({ kind: "project", id: project }, errand);
    app.createToDo({ title: "Buy cards", projectId: project });
    const tagged = app.tagged(out);
    expect(tagged.areas.map((a) => a.title)).toEqual(["Town"]);
    expect(tagged.projects.map((p) => p.title)).toEqual(["Christmas shopping"]);
    expect(titles(tagged.toDos)).toEqual(["Buy cards"]);
  });
});

describe("deleting a Tag", () => {
  it("removes it from every item", () => {
    const tag = app.createTag("Urgent");
    const toDo = app.createToDo({ title: "Pay rent" });
    const project = app.createProject({ title: "Move house" });
    app.addTag({ kind: "toDo", id: toDo }, tag);
    app.addTag({ kind: "project", id: project }, tag);
    app.deleteTag(tag);
    expect(app.tagsOf({ kind: "toDo", id: toDo })).toEqual([]);
    expect(app.tagsOf({ kind: "project", id: project })).toEqual([]);
    expect(tree()).toEqual([]);
  });

  it("moves its child Tags up to its parent", () => {
    const a = app.createTag("Out");
    const b = app.createTag("Errand", a);
    app.createTag("Shop", b);
    app.deleteTag(b);
    expect(tree()).toEqual(["Out", "  Shop"]);
  });
});
