/** Local-calendar date helpers. Day keys are YYYY-MM-DD in the user's own timezone. */

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** The last `n` day keys, oldest first, ending today. */
export function lastNDays(n: number, today: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - (n - 1))));
}

export function shortWeekday(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function friendlyDate(key: string): string {
  const today = dayKey();
  if (key === today) return 'Today';
  if (key === dayKey(addDays(new Date(), -1))) return 'Yesterday';
  return fromDayKey(key).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function timeOfDay(d: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function relativeTime(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return 'Sending…';
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
