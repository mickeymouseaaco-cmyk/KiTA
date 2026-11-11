/** "Is typing…" timing. Pure, so it's easy to test. */

/** How often the marker is refreshed while typing, and how long it counts as "now". */
export const TYPING_REFRESH_MS = 3000;
export const TYPING_FRESH_MS = 7000;

/** Is a marker set at `atMs` still "typing" at `nowMs`? (A little leeway for clock differences.) */
export function isTyping(atMs: number | null, nowMs: number): boolean {
  return atMs !== null && nowMs - atMs < TYPING_FRESH_MS && atMs - nowMs < 60_000;
}
