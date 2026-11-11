/**
 * Love Notes shows the time once per little "burst" of notes, like WhatsApp:
 * notes from the same person, each sent within an hour of the one before, on
 * the same day, share one time under the newest of them.
 */

export const GROUP_GAP_MS = 60 * 60_000;

export type Stamp = { from: string; at: number };

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * `items` are newest first (as the Notes list keeps them). Returns, for each,
 * whether the time should show under it: true for the newest note of each burst.
 */
export function showTimeFlags(items: readonly Stamp[]): boolean[] {
  return items.map((it, i) => {
    const newer = items[i - 1];
    if (!newer) return true;
    if (newer.from !== it.from) return true;
    if (newer.at - it.at > GROUP_GAP_MS) return true;
    return !sameDay(newer.at, it.at);
  });
}
