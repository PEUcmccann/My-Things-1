import { createMyThings, fixedClock, memoryStore, type MyThings, type Snapshot } from "./index";

/** The fixed "now" for core tests: Thursday 26 November 2026, mid-morning. */
export const NOW = "2026-11-26T10:00:00";
export const TODAY = "2026-11-26";
export const YESTERDAY = "2026-11-25";
export const TOMORROW = "2026-11-27";
export const NEXT_WEEK = "2026-12-03";

/** Predictable v4 UUIDs, a counter after a per-device prefix digit. */
export function uuidCounter(prefix = 0): () => string {
  let n = 0;
  return () => `${prefix}0000000-0000-4000-8000-${(++n).toString(16).padStart(12, "0")}`;
}

/** A fresh MyThings with a fixed clock, in-memory storage and predictable ids. */
export function setup(now = NOW): { app: MyThings; clock: ReturnType<typeof fixedClock> } {
  const clock = fixedClock(now);
  let n = 0;
  const app = createMyThings({
    clock,
    store: memoryStore(),
    newId: () => `id-${++n}`,
    newEditId: uuidCounter(),
  });
  return { app, clock };
}

/**
 * One device for sync tests: its own fixed clock, storage and edit ids. `prefix`
 * keeps each device's ids apart; `snapshot` starts it from saved data.
 */
export function device(prefix: number, opts: { now?: string; snapshot?: Snapshot } = {}) {
  const clock = fixedClock(opts.now ?? NOW);
  const store = memoryStore(opts.snapshot);
  let n = 0;
  const app = createMyThings({
    clock,
    store,
    newId: () => `${prefix}-id-${++n}`,
    newEditId: uuidCounter(prefix),
  });
  return { app, clock, store };
}

/** Sends every unsent edit from one device to another, as a sync would. */
export function send(from: MyThings, to: MyThings): void {
  const edits = from.unsentEdits();
  to.applyEdits(edits);
  from.markEditsSent(edits.map((e) => e.id));
}

/** Two devices that were both offline send each other everything at once. */
export function exchange(a: MyThings, b: MyThings): void {
  const fromA = a.unsentEdits();
  const fromB = b.unsentEdits();
  a.applyEdits(fromB);
  b.applyEdits(fromA);
  a.markEditsSent(fromA.map((e) => e.id));
  b.markEditsSent(fromB.map((e) => e.id));
}
