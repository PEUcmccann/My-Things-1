import { beforeEach, describe, expect, it } from "vitest";
import { createMyThings, fixedClock, memoryStore, type MyThings } from "../core";
import {
  backupDateText,
  backupDue,
  backupErrorText,
  backupRowText,
  backupName,
  backupPath,
  backupsToDelete,
  backupTime,
  createBackups,
  type Backup,
} from "./backups";
import { fakeStorage, StorageError, type FileStorage } from "./fileStorage";

const user = "00000000-0000-4000-8000-0000000000aa";
const day = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-11-28T10:00:00Z");

const backup = (at: number): Backup => ({ path: backupPath(user, at), at, size: 100 });

describe("backup names", () => {
  it("are the UTC time to the second, in the account's folder", () => {
    expect(backupPath(user, Date.parse("2026-11-28T09:05:07.900Z"))).toBe(
      `${user}/mythings-backup-2026-11-28T09-05-07Z.json`,
    );
  });

  it("read back as the time they were made", () => {
    expect(backupTime(backupName(now))).toBe(now);
    expect(backupTime("notes.json")).toBeNull();
    expect(backupTime("mythings-backup-2026-13-45T99-00-00Z.json")).toBeNull();
  });
});

describe("backups in Settings", () => {
  it("show their local date, time and size", () => {
    const at = new Date(2026, 10, 28, 14, 5, 9).getTime();
    expect(backupDateText({ at })).toBe("28 November 2026");
    expect(backupRowText({ path: "x", at, size: 12_800 })).toBe("28 November 2026, 14:05 · 13 KB");
  });

  it("explain being offline apart from other failures", () => {
    expect(backupErrorText(new StorageError("offline", "Failed to fetch"))).toBe(
      "You're offline. MyThings will back up when it next opens online.",
    );
    expect(backupErrorText(new StorageError("failed", "Payload too large"))).toBe(
      "Backup failed. MyThings will try again when it next opens.",
    );
  });
});

describe("a backup is due", () => {
  it("when there are none", () => {
    expect(backupDue([], now)).toBe(true);
  });

  it("not when the newest is 6 days 23 hours old", () => {
    const old = [backup(now - 20 * day), backup(now - 6 * day - 23 * 60 * 60 * 1000)];
    expect(backupDue(old, now)).toBe(false);
  });

  it("when the newest is exactly 7 days old", () => {
    expect(backupDue([backup(now - 14 * day), backup(now - 7 * day)], now)).toBe(true);
  });
});

describe("after an upload", () => {
  const nine = Array.from({ length: 9 }, (_, i) => backup(now - i * 7 * day));

  it("backups beyond the 8 newest are deleted", () => {
    expect(backupsToDelete([...nine].reverse(), true)).toEqual([nine[8]]);
  });

  it("a failed upload deletes nothing", () => {
    expect(backupsToDelete(nine, false)).toEqual([]);
  });
});

/** A storage whose uploads can fail, counting the calls that reached it. */
function watched(inner: FileStorage) {
  const calls = { upload: 0, remove: 0, list: 0, failUploads: false };
  const storage: FileStorage = {
    ...inner,
    async upload(path, body, type) {
      calls.upload++;
      if (calls.failUploads) throw new StorageError("offline", "Failed to fetch");
      await inner.upload(path, body, type);
    },
    async remove(paths) {
      calls.remove++;
      await inner.remove(paths);
    },
    async list(folder) {
      calls.list++;
      return inner.list(folder);
    },
  };
  return { storage, calls };
}

let app: MyThings;
let clockAt: number;

beforeEach(() => {
  app = createMyThings({ clock: fixedClock("2026-11-28T10:00:00"), store: memoryStore() });
  app.changeOwner(user);
  clockAt = now;
});

function setUp(inner = fakeStorage()) {
  const { storage, calls } = watched(inner);
  const backups = createBackups({
    storage,
    owner: user,
    exportText: () => JSON.stringify(app.exportAll()),
    now: () => clockAt,
  });
  return { backups, calls, storage: inner };
}

describe("the backup check", () => {
  it("makes a backup when the account has none", async () => {
    const { backups } = setUp();
    app.createToDo({ title: "Kept" });
    const list = await backups.check();
    expect(list.map((b) => b.path)).toEqual([backupPath(user, now)]);
    expect(list[0].size).toBeGreaterThan(0);
    const restored = JSON.parse(await backups.read(list[0]));
    expect(restored).toMatchObject({ format: "mythings-export", version: 1 });
  });

  it("skips when the newest is less than 7 days old", async () => {
    const { backups, calls } = setUp();
    await backups.check();
    clockAt = now + 6 * day;
    const list = await backups.check();
    expect(list).toHaveLength(1);
    expect(calls.upload).toBe(1);
  });

  it("backs up again once the newest is 7 days old, newest first", async () => {
    const { backups } = setUp();
    await backups.check();
    clockAt = now + 7 * day;
    const list = await backups.check();
    expect(list.map((b) => b.at)).toEqual([now + 7 * day, now]);
  });

  it("keeps the 8 newest after an upload", async () => {
    const { backups } = setUp();
    for (let week = 0; week < 10; week++) {
      clockAt = now + week * 7 * day;
      await backups.check();
    }
    const list = await backups.check();
    expect(list).toHaveLength(8);
    expect(list[0].at).toBe(now + 9 * 7 * day);
    expect(list[7].at).toBe(now + 2 * 7 * day);
  });

  it("deletes nothing when the upload fails", async () => {
    const { backups, calls } = setUp();
    for (let week = 0; week < 8; week++) {
      clockAt = now + week * 7 * day;
      await backups.check();
    }
    calls.failUploads = true;
    clockAt = now + 8 * 7 * day;
    await expect(backups.check()).rejects.toMatchObject({ kind: "offline" });
    calls.failUploads = false;
    clockAt = now + 8 * 7 * day + 1;
    expect(await backups.list()).toHaveLength(8);
    expect(calls.remove).toBe(0);
  });

  it("runs one check at a time", async () => {
    const { backups, calls } = setUp();
    const [a, b] = await Promise.all([backups.check(), backups.check()]);
    expect(a).toEqual(b);
    expect(calls.upload).toBe(1);
  });

  it("backs up now even when not due, with a later name than the newest", async () => {
    const { backups } = setUp();
    await backups.check();
    const list = await backups.backUpNow();
    expect(list.map((b) => b.at)).toEqual([now + 1000, now]);
  });

  it("only lists backups in the account's folder", async () => {
    const shared = fakeStorage();
    await shared.upload(`${user}/notes.json`, new Blob(["{}"]), "application/json");
    await shared.upload(`other/${backupName(now)}`, new Blob(["{}"]), "application/json");
    const { backups } = setUp(shared);
    expect(await backups.list()).toEqual([]);
  });
});

describe("restoring a backup", () => {
  it("replaces everything with the backup's data", async () => {
    const { backups } = setUp();
    app.createToDo({ title: "In the backup" });
    const [first] = await backups.check();
    app.createToDo({ title: "Added since" });
    app.restoreExport(await backups.read(first));
    const titles = app.inbox().map((e) => e.toDo.title);
    expect(titles).toEqual(["In the backup"]);
  });
});
