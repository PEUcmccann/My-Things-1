import { beforeEach, describe, expect, it } from "vitest";
import { AttachmentError, maxAttachmentSize, type fixedClock, type MyThings } from "./index";
import { device, send, setup } from "./testSetup";

const account = "user-1";
let app: MyThings;
let clock: ReturnType<typeof fixedClock>;

beforeEach(() => {
  ({ app, clock } = setup());
  app.changeOwner(account);
});

const photo = { name: "Beach day.jpg", mimeType: "image/jpeg", size: 2_400_000 };

/** Prepares and adds an Attachment, as the app does once its file is uploaded. */
function attach(toDoId: string, details: Parameters<MyThings["prepareAttachment"]>[1] = photo) {
  return app.addAttachment(app.prepareAttachment(toDoId, details));
}

const names = (toDoId: string) => app.attachments(toDoId).map((a) => a.name);

describe("adding an Attachment", () => {
  it("keeps the file's details, with where its file and thumbnail are stored", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const id = attach(toDo, { ...photo, width: 4000, height: 3000, thumbnail: true });
    expect(app.attachments(toDo)).toEqual([
      expect.objectContaining({
        id,
        owner: account,
        toDoId: toDo,
        name: "Beach day.jpg",
        mimeType: "image/jpeg",
        size: 2_400_000,
        width: 4000,
        height: 3000,
        storagePath: `${account}/${id}/Beach_day.jpg`,
        thumbnailPath: `${account}/${id}/thumbnail.jpg`,
      }),
    ]);
  });

  it("knows where the files go before the Attachment is added", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const prepared = app.prepareAttachment(toDo, {
      name: "Ünïcode & spaces (1).pdf",
      mimeType: "application/pdf",
      size: 10,
    });
    expect(prepared.storagePath).toBe(`${account}/${prepared.id}/_n_code___spaces__1_.pdf`);
    expect(prepared.thumbnailPath).toBeNull();
    expect(app.attachments(toDo)).toEqual([]);
    app.addAttachment(prepared);
    expect(names(toDo)).toEqual(["Ünïcode & spaces (1).pdf"]);
  });

  it("has no size in pixels for a file that isn't an image", () => {
    const toDo = app.createToDo({ title: "Taxes" });
    attach(toDo, { name: "notes.txt", mimeType: "text/plain", size: 12 });
    expect(app.attachments(toDo)[0]).toMatchObject({ width: null, height: null });
  });

  it("accepts a file of exactly 25 MB and refuses a larger one", () => {
    const toDo = app.createToDo({ title: "Video" });
    expect(maxAttachmentSize).toBe(26_214_400);
    attach(toDo, { name: "a.mov", mimeType: "video/quicktime", size: 26_214_400 });
    const tooLarge = () =>
      app.prepareAttachment(toDo, { name: "b.mov", mimeType: "video/quicktime", size: 26_214_401 });
    expect(tooLarge).toThrow(AttachmentError);
    expect(tooLarge).toThrow("Attachments can be up to 25 MB");
    expect(names(toDo)).toEqual(["a.mov"]);
  });

  it("refuses an Attachment over 25 MB even when it was prepared elsewhere", () => {
    const toDo = app.createToDo({ title: "Video" });
    const prepared = app.prepareAttachment(toDo, photo);
    expect(() => app.addAttachment({ ...prepared, size: maxAttachmentSize + 1 })).toThrow(
      "Attachments can be up to 25 MB",
    );
    expect(names(toDo)).toEqual([]);
  });

  it("needs a signed-in account, whose folder the files go in", () => {
    const signedOut = setup().app;
    const toDo = signedOut.createToDo({ title: "Holiday" });
    expect(() => signedOut.prepareAttachment(toDo, photo)).toThrow("Sign in to add attachments");
  });

  it("needs the To-do to exist", () => {
    expect(() => app.prepareAttachment("missing", photo)).toThrow();
  });

  it("puts no limit on how many a To-do has, and lists them oldest first", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    for (const n of [1, 2, 3, 4, 5]) {
      clock.set(`2026-11-26T10:0${n}:00`);
      attach(toDo, { ...photo, name: `${n}.jpg` });
    }
    expect(names(toDo)).toEqual(["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]);
  });

  it("shows which To-dos have Attachments", () => {
    const withOne = app.createToDo({ title: "Holiday" });
    const without = app.createToDo({ title: "Taxes" });
    attach(withOne);
    expect(app.hasAttachments(withOne)).toBe(true);
    expect(app.hasAttachments(without)).toBe(false);
  });
});

describe("removing an Attachment", () => {
  it("removes it and returns it, so its files can be deleted", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const keep = attach(toDo, { ...photo, name: "keep.jpg" });
    const gone = attach(toDo, { ...photo, name: "gone.jpg", thumbnail: true });
    const removed = app.removeAttachment(gone);
    expect(removed).toMatchObject({
      storagePath: `${account}/${gone}/gone.jpg`,
      thumbnailPath: `${account}/${gone}/thumbnail.jpg`,
    });
    expect(app.attachments(toDo).map((a) => a.id)).toEqual([keep]);
    expect(app.hasAttachments(toDo)).toBe(true);
  });

  it("removes it on other devices too", () => {
    const phone = device(1);
    const web = device(2);
    phone.app.changeOwner(account);
    web.app.changeOwner(account);
    const toDo = phone.app.createToDo({ title: "Holiday" });
    const id = phone.app.addAttachment(phone.app.prepareAttachment(toDo, photo));
    send(phone.app, web.app);
    expect(web.app.attachments(toDo).map((a) => a.name)).toEqual(["Beach day.jpg"]);
    phone.app.removeAttachment(id);
    send(phone.app, web.app);
    expect(web.app.attachments(toDo)).toEqual([]);
  });
});

describe("the Trash", () => {
  it("removes a To-do's Attachments, and its Sub-to-dos', when the Trash is emptied", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const child = app.createToDo({ title: "Pack", parentId: toDo });
    const kept = app.createToDo({ title: "Taxes" });
    const a = attach(toDo);
    const b = attach(child);
    attach(kept);
    app.delete(toDo);
    expect(app.hasAttachments(toDo)).toBe(true);
    const removed = app.emptyTrash();
    expect(removed.map((r) => r.id).sort()).toEqual([a, b].sort());
    expect(app.attachments(toDo)).toEqual([]);
    expect(app.attachments(child)).toEqual([]);
    expect(app.hasAttachments(kept)).toBe(true);
  });

  it("removes the Attachments of a Project's To-dos when the Project is emptied from the Trash", () => {
    const project = app.createProject({ title: "Move house" });
    const toDo = app.createToDo({ title: "Book van", projectId: project });
    const id = attach(toDo);
    app.deleteProject(project);
    expect(app.emptyTrash().map((r) => r.id)).toEqual([id]);
    expect(app.attachments(toDo)).toEqual([]);
  });

  it("removes them when a To-do expires from the Trash after 30 days", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const id = attach(toDo);
    app.delete(toDo);
    clock.set("2026-12-20T10:00:00");
    expect(app.purgeExpiredTrash()).toEqual([]);
    expect(app.hasAttachments(toDo)).toBe(true);
    clock.set("2026-12-27T10:00:00");
    expect(app.purgeExpiredTrash().map((r) => r.id)).toEqual([id]);
    expect(app.attachments(toDo)).toEqual([]);
  });
});

describe("repeating To-dos", () => {
  it("doesn't copy Attachments to the next occurrence", () => {
    const toDo = app.createToDo({ title: "Water plants" });
    app.setRepeat(toDo, { freq: "daily", interval: 1 });
    app.addChecklistItem(toDo, "Fern");
    attach(toDo);
    app.complete(toDo);
    const next = app
      .exportAll()
      .records.toDos.find((t) => t.title === "Water plants" && t.outcome === "active")!;
    expect(next.id).not.toBe(toDo);
    expect(app.checklist(next.id).map((c) => c.title)).toEqual(["Fern"]);
    expect(app.attachments(next.id)).toEqual([]);
    expect(app.hasAttachments(next.id)).toBe(false);
    expect(names(toDo)).toEqual(["Beach day.jpg"]);
  });
});

describe("export and restore", () => {
  it("exports each Attachment's details, never the file's contents", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const id = attach(toDo, { ...photo, width: 40, height: 30, thumbnail: true });
    const file = app.exportAll();
    expect(file.records.attachments).toEqual([
      {
        id,
        owner: account,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        toDoId: toDo,
        name: "Beach day.jpg",
        mimeType: "image/jpeg",
        size: 2_400_000,
        width: 40,
        height: 30,
        storagePath: `${account}/${id}/Beach_day.jpg`,
        thumbnailPath: `${account}/${id}/thumbnail.jpg`,
      },
    ]);
  });

  it("returns the Attachments a restore removes, so their files can be deleted", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const kept = attach(toDo);
    const text = JSON.stringify(app.exportAll());
    const added = attach(toDo, { ...photo, name: "Sea.jpg" });
    const removed = app.restoreExport(text);
    expect(removed.map((a) => a.id)).toEqual([added]);
    expect(app.attachments(toDo).map((a) => a.id)).toEqual([kept]);
  });

  it("removes nothing to delete when restoring a file with the same Attachments", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    attach(toDo);
    expect(app.restoreExport(JSON.stringify(app.exportAll()))).toEqual([]);
  });

  it("restores Attachments with the storage path they had", () => {
    const toDo = app.createToDo({ title: "Holiday" });
    const id = attach(toDo);
    const text = JSON.stringify(app.exportAll());
    const other = setup().app;
    other.changeOwner("user-2");
    other.restoreExport(text);
    expect(other.attachments(toDo)).toEqual([
      expect.objectContaining({ owner: "user-2", storagePath: `${account}/${id}/Beach_day.jpg` }),
    ]);
  });
});
