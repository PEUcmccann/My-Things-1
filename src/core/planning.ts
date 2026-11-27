import type { Context } from "./context";
import { energies, priorities, type Energy, type Priority } from "./types";

/** Whether a number of minutes can be an Estimate: whole and positive. */
export function isValidEstimate(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0;
}

/** An Estimate as text: "15m" under an hour, then "1h" or "1h 30m". */
export function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Priority, Energy and Estimate: planning attributes of a To-do. */
export function planningActions(ctx: Context) {
  return {
    /** Sets a To-do's Priority; "none" clears it. */
    setPriority(id: string, priority: Priority): void {
      if (!priorities.includes(priority)) throw new Error(`Unknown Priority ${priority}`);
      ctx.update("toDos", id, { priority });
    },

    /** Sets a To-do's Energy, low or high; null clears it. */
    setEnergy(id: string, energy: Energy | null): void {
      if (energy !== null && !energies.includes(energy)) {
        throw new Error(`Unknown Energy ${energy}`);
      }
      ctx.update("toDos", id, { energy });
    },

    /** Sets a To-do's Estimate in whole, positive minutes; null clears it. */
    setEstimate(id: string, minutes: number | null): void {
      if (minutes !== null && !isValidEstimate(minutes)) {
        throw new Error("An Estimate is a whole, positive number of minutes");
      }
      ctx.update("toDos", id, { estimate: minutes });
    },
  };
}
