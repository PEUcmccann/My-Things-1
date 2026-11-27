import type { QuickEntryValue } from "../core";
import type { IconName } from "./components/Icon";
import { whenIcon, whenText } from "./format";

/**
 * What a highlight adds after the typed text, to show what it sets: the day and icon for a
 * date phrase ("tomorrow" shows Tomorrow, "12 Dec" shows Sat 12 Dec). Other shorthand
 * shows as typed, so it adds nothing.
 */
export function tokenHint(
  value: QuickEntryValue,
  today: string,
): { text: string; icon: IconName } | null {
  if (value.kind !== "when") return null;
  const { when } = value;
  const fields = {
    someday: when.kind === "someday",
    startDate: when.kind === "date" ? when.date : when.kind === "someday" ? null : today,
    evening: when.kind === "thisEvening",
  };
  return { text: whenText(fields, today), icon: whenIcon(fields, today) ?? "when" };
}

/**
 * Moves the offsets of tokens kept as text along with an edit to the text, so a tapped-away
 * token stays plain text as typing goes on before it. The edit is read as one changed run
 * between a shared start and a shared end; an offset inside that run is dropped.
 */
export function followEdit(offsets: readonly number[], before: string, after: string): number[] {
  const shortest = Math.min(before.length, after.length);
  let start = 0;
  while (start < shortest && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < shortest - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++;
  }
  const changedEnd = before.length - end;
  const shift = after.length - before.length;
  return offsets.flatMap((o) => {
    if (o < start) return [o];
    if (o >= changedEnd) return [o + shift];
    return [];
  });
}
