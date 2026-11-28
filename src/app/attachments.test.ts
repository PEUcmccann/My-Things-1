import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, RestoreError, type MyThings } from "../core";
import {
  attachmentKind,
  deleteAttachmentFiles,
  formatFileSize,
  openAttachmentUrl,
  restoreEverything,
  uploadAttachment,
  UploadError,
  type PickedFile,
} from "./attachments";
import { fakeStorage, StorageError, storageError, type FileStorage } from "./fileStorage";

const account = "00000000-0000-4000-8000-0000000000aa";
let app: MyThings;
let clock: ReturnType<typeof fixedClock>;
let toDo: string;

beforeEach(() => {
  let n = 0;
  clock = fixedClock("2026-11-28T10:00:00");
  app = createMyThings({
    clock,
    store: memoryStore(),
    newId: () => `id-${++n}`,
  });
  app.changeOwner(account);
  toDo = app.createToDo({ title: "Holiday" });
});

const bytes = (text: string) => new Blob([text], { type: "text/plain" });

const textFile: PickedFile = {
  name: "notes.txt",
  mimeType: "text/plain",
  size: 5,
  read: async () => bytes("hello"),
};

const photo: PickedFile = {
  name: "Beach day.jpg",
  mimeType: "image/jpeg",
  size: 2_000,
  width: 4000,
  height: 3000,
  read: async () => bytes("big"),
  thumbnail: async () => bytes("small"),
};

/** A storage whose uploads can be made to fail, recording what the core held at each call. */
function watched(inner: FileStorage, fail: { on?: (path: string) => boolean } = {}) {
  const log: string[] = [];
  const storage: FileStorage = {
    ...inner,
    async upload(path, body, contentType) {
      log.push(`upload ${path} (records: ${app.attachments(toDo).length})`);
      if (fail.on?.(path)) throw new StorageError("offline", "Failed to fetch");
      return inner.upload(path, body, contentType);
    },
    async remove(paths) {
      log.push(`remove ${paths.join(", ")}`);
      return inner.remove(paths);
    },
    signedUrl: (path, seconds) => inner.signedUrl(path, seconds),
  };
  return { storage, log };
}

describe("adding an Attachment", () => {
  it("uploads the file first and adds the record only once it is stored", async () => {
    const { storage, log } = watched(fakeStorage());
    const id = await uploadAttachment(app, storage, toDo, textFile);
    expect(log).toEqual([`upload ${account}/${id}/notes.txt (records: 0)`]);
    expect(app.attachments(toDo)).toEqual([
      expect.objectContaining({ id, name: "notes.txt", thumbnailPath: null }),
    ]);
  });

  it("uploads an image's thumbnail with it", async () => {
    const inner = fakeStorage();
    const { storage, log } = watched(inner);
    const id = await uploadAttachment(app, storage, toDo, photo);
    expect(log).toEqual([
      `upload ${account}/${id}/Beach_day.jpg (records: 0)`,
      `upload ${account}/${id}/thumbnail.jpg (records: 0)`,
    ]);
    expect(app.attachments(toDo)[0]).toMatchObject({ width: 4000, height: 3000 });
    expect(await inner.signedUrl(`${account}/${id}/thumbnail.jpg`, 3600)).toBeTruthy();
  });

  it("leaves nothing behind when the upload fails", async () => {
    const { storage } = watched(fakeStorage(), { on: () => true });
    const upload = uploadAttachment(app, storage, toDo, textFile);
    await expect(upload).rejects.toThrow(UploadError);
    await expect(upload).rejects.toThrow("Couldn't upload notes.txt. Try again.");
    expect(app.attachments(toDo)).toEqual([]);
  });

  it("deletes the uploaded file when its thumbnail fails, and adds no record", async () => {
    const inner = fakeStorage();
    const { storage, log } = watched(inner, { on: (p) => p.endsWith("thumbnail.jpg") });
    await expect(uploadAttachment(app, storage, toDo, photo)).rejects.toThrow(
      "Couldn't upload Beach day.jpg. Try again.",
    );
    expect(app.attachments(toDo)).toEqual([]);
    const file = log[0].split(" ")[1];
    expect(log[2]).toBe(`remove ${file}`);
    await expect(inner.signedUrl(file, 3600)).rejects.toMatchObject({ kind: "missing" });
  });

  it("refuses a file over 25 MB before anything is uploaded", async () => {
    const { storage, log } = watched(fakeStorage());
    const huge = { ...textFile, size: 26_214_401 };
    await expect(uploadAttachment(app, storage, toDo, huge)).rejects.toThrow(
      "Files can be up to 25 MB",
    );
    expect(log).toEqual([]);
  });
});

describe("removing an Attachment", () => {
  it("deletes its file and thumbnail", async () => {
    const inner = fakeStorage();
    const id = await uploadAttachment(app, inner, toDo, photo);
    const removed = app.removeAttachment(id);
    await deleteAttachmentFiles(inner, [removed]);
    await expect(inner.signedUrl(removed.storagePath, 3600)).rejects.toMatchObject({
      kind: "missing",
    });
    await expect(inner.signedUrl(removed.thumbnailPath!, 3600)).rejects.toMatchObject({
      kind: "missing",
    });
  });

  it("leaves the files in Storage, without failing, when they can't be deleted", async () => {
    const offline: FileStorage = {
      ...fakeStorage(),
      remove: async () => {
        throw new StorageError("offline", "Failed to fetch");
      },
    };
    await expect(
      deleteAttachmentFiles(offline, [{ storagePath: "a/b/c.txt", thumbnailPath: null } as never]),
    ).resolves.toBeUndefined();
  });
});

describe("restoring an export", () => {
  const isStored = (storage: FileStorage, path: string) =>
    storage.signedUrl(path, 60).then(
      () => true,
      () => false,
    );

  it("deletes the files of Attachments the file doesn't hold", async () => {
    const storage = fakeStorage();
    const kept = await uploadAttachment(app, storage, toDo, textFile);
    const text = JSON.stringify(app.exportAll());
    const added = await uploadAttachment(app, storage, toDo, photo);
    const [keptPath, addedPath] = app.attachments(toDo).map((a) => a.storagePath);
    await restoreEverything(app, storage, text);
    expect(app.attachments(toDo).map((a) => a.id)).toEqual([kept]);
    expect(added).not.toBe(kept);
    expect(await isStored(storage, keptPath!)).toBe(true);
    expect(await isStored(storage, addedPath!)).toBe(false);
  });

  it("deletes the files of Attachments on To-dos the restore empties from the Trash", async () => {
    const storage = fakeStorage();
    await uploadAttachment(app, storage, toDo, textFile);
    const [path] = app.attachments(toDo).map((a) => a.storagePath);
    app.delete(toDo);
    const text = JSON.stringify(app.exportAll());
    clock.set("2027-01-05T10:00:00");
    await restoreEverything(app, storage, text);
    expect(app.trash()).toEqual([]);
    expect(await isStored(storage, path!)).toBe(false);
  });

  it("refuses a file that isn't an export, changing nothing", async () => {
    const storage = fakeStorage();
    await uploadAttachment(app, storage, toDo, textFile);
    expect(() => restoreEverything(app, storage, "not json")).toThrow(RestoreError);
    expect(app.attachments(toDo)).toHaveLength(1);
  });
});

describe("opening an Attachment", () => {
  it("gives a link valid for an hour", async () => {
    const asked: number[] = [];
    const inner = fakeStorage();
    const storage: FileStorage = {
      ...inner,
      signedUrl: (path, seconds) => (asked.push(seconds), inner.signedUrl(path, seconds)),
    };
    const id = await uploadAttachment(app, storage, toDo, textFile);
    const result = await openAttachmentUrl(storage, app.attachments(toDo)[0]);
    expect(result).toEqual({ kind: "url", url: expect.any(String) });
    expect(asked).toEqual([3600]);
    expect(id).toBeTruthy();
  });

  it("says 'File not available' when the file isn't in Storage, as after a restore", async () => {
    const result = await openAttachmentUrl(fakeStorage(), {
      storagePath: "another-account/x/notes.txt",
    } as never);
    expect(result).toEqual({ kind: "problem", text: "File not available" });
  });

  it("says when it can't be opened while offline", async () => {
    const offline: FileStorage = {
      ...fakeStorage(),
      signedUrl: async () => {
        throw new StorageError("offline", "Failed to fetch");
      },
    };
    expect(await openAttachmentUrl(offline, { storagePath: "a/b/c" } as never)).toEqual({
      kind: "problem",
      text: "You're offline",
    });
  });
});

describe("Storage errors from supabase-js", () => {
  it("tells a missing file, being offline and other failures apart", () => {
    expect(storageError({ message: "Object not found", statusCode: "404" }).kind).toBe("missing");
    expect(storageError({ message: "Failed to fetch" }).kind).toBe("offline");
    expect(storageError({ message: "Network request failed" }).kind).toBe("offline");
    expect(storageError({ message: "new row violates row-level security policy" }).kind).toBe(
      "failed",
    );
  });
});

describe("how an Attachment is shown", () => {
  it("shows sizes in bytes, KB and MB", () => {
    expect(formatFileSize(12)).toBe("12 bytes");
    expect(formatFileSize(1)).toBe("1 byte");
    expect(formatFileSize(2_048)).toBe("2 KB");
    expect(formatFileSize(2_516_582)).toBe("2.4 MB");
    expect(formatFileSize(26_214_400)).toBe("25 MB");
  });

  it("picks an icon by kind", () => {
    expect(attachmentKind("image/png", "a.png")).toBe("image");
    expect(attachmentKind("application/pdf", "a.pdf")).toBe("pdf");
    expect(attachmentKind("text/csv", "a.csv")).toBe("spreadsheet");
    expect(
      attachmentKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a"),
    ).toBe("spreadsheet");
    expect(attachmentKind("application/octet-stream", "Budget.numbers")).toBe("spreadsheet");
    expect(attachmentKind("text/plain", "notes.txt")).toBe("document");
    expect(attachmentKind("application/msword", "a.doc")).toBe("document");
    expect(attachmentKind("application/zip", "a.zip")).toBe("other");
  });
});
