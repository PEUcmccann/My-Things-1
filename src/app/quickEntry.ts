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
