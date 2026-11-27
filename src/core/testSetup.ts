import { createMyThings, fixedClock, memoryStore, type MyThings } from "./index";

/** The fixed "now" for core tests: Thursday 26 November 2026, mid-morning. */
export const NOW = "2026-11-26T10:00:00";
export const TODAY = "2026-11-26";
export const YESTERDAY = "2026-11-25";
export const TOMORROW = "2026-11-27";
export const NEXT_WEEK = "2026-12-03";

/** A fresh MyThings with a fixed clock, in-memory storage and predictable ids. */
export function setup(now = NOW): { app: MyThings; clock: ReturnType<typeof fixedClock> } {
  const clock = fixedClock(now);
  let n = 0;
  const app = createMyThings({ clock, store: memoryStore(), newId: () => `id-${++n}` });
  return { app, clock };
}
