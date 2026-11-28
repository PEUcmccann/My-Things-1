import { formatFileSize } from "./attachments";
import { exportDateText } from "./dataFiles";
import { StorageError, type FileStorage } from "./fileStorage";
import { formatTime } from "./format";

// Weekly Backups (M3-08): JSON exports (M3-06) kept in the account's folder of the
// `backups` bucket. There is no background task: state.tsx runs a check when the app
// opens or comes to the foreground, after a sync, and the device deletes all but the
// newest 8 once a new one is uploaded.

/** A backup in Storage. */
export interface Backup {
  /** Its path in the bucket: <user id>/mythings-backup-<UTC time>.json. */
  path: string;
  /** When it was made, from its name (milliseconds since 1970, to the second). */
  at: number;
  /** Its size in bytes. */
  size: number;
}

/** A backup is due when the newest is this old or more. */
export const backupEveryMs = 7 * 24 * 60 * 60 * 1000;
/** How many backups are kept. */
export const backupsKept = 8;

const backupType = "application/json";
const namePattern = /^mythings-backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.json$/;

/** A backup's file name, e.g. "mythings-backup-2026-11-28T09-05-07Z.json" (UTC). */
export function backupName(at: number): string {
  const time = new Date(at).toISOString().slice(0, 19).replace(/:/g, "-");
  return `mythings-backup-${time}Z.json`;
}

export function backupPath(userId: string, at: number): string {
  return `${userId}/${backupName(at)}`;
}

/** When the backup with this file name was made, or null if it isn't a backup's name. */
export function backupTime(name: string): number | null {
  const match = namePattern.exec(name);
  if (!match) return null;
  const [, date, h, m, s] = match;
  const at = Date.parse(`${date}T${h}:${m}:${s}Z`);
  return Number.isNaN(at) || backupName(at) !== name ? null : at;
}

const newestFirst = (backups: readonly Backup[]) => [...backups].sort((a, b) => b.at - a.at);

/** True when there is no backup, or the newest is 7 days old or more. */
export function backupDue(backups: readonly Backup[], now: number): boolean {
  const newest = newestFirst(backups)[0];
  return !newest || now - newest.at >= backupEveryMs;
}

/**
 * The backups to delete once an upload finished: those beyond the 8 newest. When the
 * upload failed, none.
 */
export function backupsToDelete(backups: readonly Backup[], uploaded: boolean): Backup[] {
  return uploaded ? newestFirst(backups).slice(backupsKept) : [];
}

export interface Backups {
  /** The account's backups, newest first. Throws a StorageError. */
  list(): Promise<Backup[]>;
  /**
   * Lists the backups and makes one if due, then returns them newest first. One check
   * runs at a time: a call while one is under way gets that one. Throws a StorageError.
   */
  check(): Promise<Backup[]>;
  /** Makes a backup whether or not one is due, after any check under way. */
  backUpNow(): Promise<Backup[]>;
  /** A backup's contents, an export file's text. Throws a StorageError. */
  read(backup: Backup): Promise<string>;
}

export function createBackups({
  storage,
  userId,
  exportText,
  now = Date.now,
}: {
  /** The `backups` bucket, opened so uploads don't replace files. */
  storage: FileStorage;
  userId: string;
  /** Everything as an export file's text, at the time of the backup. */
  exportText: () => string;
  now?: () => number;
}): Backups {
  let running: Promise<Backup[]> | null = null;

  async function list(): Promise<Backup[]> {
    const files = await storage.list(userId);
    const backups: Backup[] = [];
    for (const file of files) {
      const at = backupTime(file.name);
      if (at !== null) backups.push({ path: `${userId}/${file.name}`, at, size: file.size });
    }
    return newestFirst(backups);
  }

  async function upload(backups: Backup[]): Promise<Backup[]> {
    // Names are to the second: one made within a second of the newest goes a second later.
    const newest = backups[0]?.at ?? -Infinity;
    const at = Math.max(Math.floor(now() / 1000) * 1000, newest + 1000);
    const body = new TextEncoder().encode(exportText());
    const made: Backup = { path: backupPath(userId, at), at, size: body.byteLength };
    // A failed upload throws here, before anything is deleted.
    await storage.upload(made.path, body.buffer as ArrayBuffer, backupType);
    const all = [made, ...backups];
    const old = backupsToDelete(all, true);
    if (!old.length) return all;
    try {
      await storage.remove(old.map((b) => b.path));
    } catch (error) {
      // They go after the next backup instead.
      console.warn("Could not delete old backups", error);
      return all;
    }
    return all.filter((b) => !old.includes(b));
  }

  function exclusive(work: () => Promise<Backup[]>): Promise<Backup[]> {
    const next = (running ?? Promise.resolve([]))
      .catch(() => [])
      .then(work)
      .finally(() => {
        if (running === next) running = null;
      });
    running = next;
    return next;
  }

  return {
    list,
    check() {
      if (running) return running;
      return exclusive(async () => {
        const backups = await list();
        return backupDue(backups, now()) ? upload(backups) : backups;
      });
    },
    backUpNow: () => exclusive(async () => upload(await list())),
    async read(backup) {
      return storage.readText(backup.path);
    },
  };
}

/** When a backup was made, as "28 November 2026" in local time. */
export function backupDateText(backup: Pick<Backup, "at">): string {
  return exportDateText(new Date(backup.at).toISOString());
}

/** A backup in the list: "28 November 2026, 14:05 · 12 KB", in local time. */
export function backupRowText(backup: Backup): string {
  const made = new Date(backup.at);
  const time = formatTime(made.getHours() * 60 + made.getMinutes());
  return `${backupDateText(backup)}, ${time} · ${formatFileSize(backup.size)}`;
}

/** What Settings → Data says when a backup can't be listed, made or read. */
export function backupErrorText(error: unknown): string {
  if (error instanceof StorageError && error.kind === "offline") {
    return "You're offline. MyThings will back up when it next opens online.";
  }
  return "Backup failed. MyThings will try again when it next opens.";
}
