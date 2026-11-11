/**
 * Trip itinerary: the day-by-day plan. Pure helpers (no Firebase), so they're easy to test.
 */

export const STOP_LIMITS = { title: 120, place: 200, note: 500 } as const;

export type StopLike = { id: string; day: string; time?: string | null; createdAt?: { toMillis?: () => number } | null };

/**
 * Friendly time typing: "9", "930", "9:30", "9.30pm", "2 pm", "14:30" all work.
 * Returns "HH:MM", null when left empty (any time that day), or 'invalid'.
 */
export function parseTime(raw: string): string | null | 'invalid' {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '').replace('.', ':');
  if (!s) return null;
  const m = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(s);
  if (!m) return 'invalid';
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.[0];
  if (min > 59) return 'invalid';
  if (ap) {
    if (h < 1 || h > 12) return 'invalid';
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
  } else if (h > 23) return 'invalid';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "14:30" → "2:30 PM" (in the phone's own style). */
export function timeLabel(t: string, locale?: string): string {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** Within a day: timed stops by time, then "any time" ones in the order they were added. */
export function sortStops<T extends StopLike>(stops: readonly T[]): T[] {
  const added = (s: T) => s.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  return [...stops].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return added(a) - added(b);
  });
}

/** Stops for each trip day, plus any left on days outside the trip (if the dates changed). */
export function stopsByDay<T extends StopLike>(stops: readonly T[], days: readonly string[]): { byDay: Map<string, T[]>; other: T[] } {
  const byDay = new Map<string, T[]>(days.map((d) => [d, []]));
  const other: T[] = [];
  for (const s of sortStops(stops)) (byDay.get(s.day) ?? other).push(s);
  return { byDay, other };
}

/** A maps search for a stop, near the trip's destination when we know it. */
export function mapsUrl(place: string, destination?: string): string {
  const q = destination && !place.toLowerCase().includes(destination.toLowerCase()) ? `${place}, ${destination}` : place;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
