import type { Context } from "./context";
import {
  collectionNames,
  defaultSettings,
  recordDefaults,
  type CollectionName,
  type Snapshot,
} from "./store";
import type { Moment, Settings } from "./types";

export const exportFormat = "mythings-export";
/** The newest export version this core reads, and the one it writes. */
export const exportVersion = 1;

/**
 * Everything in MyThings as one portable file: the records and settings, without the
 * sync bookkeeping, which belongs to one device. Weekly backups use the same format.
 */
export interface ExportFile {
  format: typeof exportFormat;
  version: typeof exportVersion;
  exportedAt: Moment;
  records: Snapshot["records"];
  settings: Settings;
}

/** Why a file can't be restored. */
export type RestoreProblem = "notJson" | "notAnExport" | "newerVersion";

export class RestoreError extends Error {
  constructor(readonly problem: RestoreProblem) {
    super(
      {
        notJson: "The file isn't valid JSON",
        notAnExport: "The file isn't a MyThings export",
        newerVersion: "The export is from a newer version of MyThings",
      }[problem],
    );
    this.name = "RestoreError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads an export file's text, or throws a RestoreError. Collections and fields the
 * file lacks (it may be from before they existed) get the same defaults as an old
 * snapshot.
 */
export function readExport(text: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RestoreError("notJson");
  }
  if (!isObject(parsed) || parsed.format !== exportFormat) throw new RestoreError("notAnExport");
  const { version, exportedAt, records = {}, settings = {} } = parsed;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new RestoreError("notAnExport");
  }
  if (version > exportVersion) throw new RestoreError("newerVersion");
  if (typeof exportedAt !== "string" || !isObject(records) || !isObject(settings)) {
    throw new RestoreError("notAnExport");
  }
  const read = {} as Record<CollectionName, unknown[]>;
  for (const name of collectionNames) {
    const list = records[name] ?? [];
    if (!Array.isArray(list)) throw new RestoreError("notAnExport");
    read[name] = list.map((record: unknown) => {
      if (!isObject(record) || typeof record.id !== "string") {
        throw new RestoreError("notAnExport");
      }
      return { ...recordDefaults[name], ...record };
    });
  }
  return {
    format: exportFormat,
    version: exportVersion,
    exportedAt,
    records: read as unknown as Snapshot["records"],
    settings: { ...defaultSettings, ...settings } as Settings,
  };
}

/** Replaces every record and the settings, as edits other devices follow (sync.ts). */
export type ReplaceEverything = (records: Snapshot["records"], settings: Settings) => void;

export function exportActions(ctx: Context, replaceEverything: ReplaceEverything) {
  const { store } = ctx;
  return {
    /** Everything in MyThings as an export file, to save as JSON. */
    exportAll(): ExportFile {
      const records = {} as Record<CollectionName, unknown[]>;
      for (const name of collectionNames) records[name] = store.all(name);
      return JSON.parse(
        JSON.stringify({
          format: exportFormat,
          version: exportVersion,
          exportedAt: ctx.now(),
          records,
          settings: store.settings(),
        }),
      ) as ExportFile;
    },

    /**
     * Replaces everything with an export file's contents, or throws a RestoreError and
     * changes nothing. Every restored record belongs to the current owner, and the
     * restore syncs to other devices as edits made now.
     */
    restoreExport(text: string): void {
      const file = readExport(text);
      const records = {} as Record<CollectionName, unknown[]>;
      for (const name of collectionNames) {
        records[name] = file.records[name].map((r) => ({ ...r, owner: ctx.owner }));
      }
      replaceEverything(records as unknown as Snapshot["records"], file.settings);
    },
  };
}
