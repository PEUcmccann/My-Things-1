import type { LocalDate } from "./types";

export interface Clock {
  /** The current moment. */
  now(): Date;
  /** Today's date in the user's time zone. */
  today(): LocalDate;
}

export function toLocalDate(moment: Date): LocalDate {
  const y = moment.getFullYear();
  const m = String(moment.getMonth() + 1).padStart(2, "0");
  const d = String(moment.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => toLocalDate(new Date()),
};

/** A clock frozen at a given local date and time, for tests. */
export function fixedClock(isoLocal: string): Clock & { set(isoLocal: string): void } {
  let moment = new Date(isoLocal);
  return {
    now: () => new Date(moment),
    today: () => toLocalDate(moment),
    set(next) {
      moment = new Date(next);
    },
  };
}
