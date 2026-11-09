/** Pure trip helpers: countdown, daily mini tasks, packing, rest days, mood recap. */
import { addDays, dayKey, fromDayKey } from './dates';

export type ItemCategory = 'documents' | 'bookings' | 'packing' | 'other';

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  documents: 'Documents',
  bookings: 'Bookings',
  packing: 'Packing',
  other: 'Little things',
};

export const STARTER_ITEMS: { text: string; category: ItemCategory }[] = [
  { text: 'Passports / ID', category: 'documents' },
  { text: 'Travel insurance', category: 'documents' },
  { text: 'Tickets', category: 'bookings' },
  { text: 'Where we’re staying', category: 'bookings' },
  { text: 'Getting to the airport or station', category: 'bookings' },
];

export function daysBetween(a: string, b: string): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);
}

export type TripPhase = 'upcoming' | 'during' | 'after';

export function tripPhase(start: string, end: string, today = dayKey()): TripPhase {
  if (today < start) return 'upcoming';
  if (today > end) return 'after';
  return 'during';
}

export function countdownLine(start: string, end: string, today = dayKey()): string {
  const phase = tripPhase(start, end, today);
  if (phase === 'during') return `Day ${daysBetween(start, today) + 1} of your trip. Enjoy it.`;
  if (phase === 'after') return 'Welcome home. What a lovely thing to remember.';
  const n = daysBetween(today, start);
  if (n === 1) return 'Tomorrow!';
  return `${n} days to go`;
}

const MINI_TASKS: { atOrBelow: number; text: string }[] = [
  { atOrBelow: 0, text: 'You’re off! Take one photo of each other today.' },
  { atOrBelow: 1, text: 'Charge everything and get an early night.' },
  { atOrBelow: 2, text: 'Download offline maps and your tickets.' },
  { atOrBelow: 3, text: 'Do a gentle laundry so favorite clothes are ready.' },
  { atOrBelow: 5, text: 'Start a little packing pile in a corner.' },
  { atOrBelow: 7, text: 'Check the weather and update the packing list.' },
  { atOrBelow: 10, text: 'Plan one special meal or moment together.' },
  { atOrBelow: 14, text: 'Let your bank know you’re traveling.' },
  { atOrBelow: 21, text: 'Sort out getting to and from the airport.' },
  { atOrBelow: 30, text: 'Check passports and IDs are still valid.' },
];

/** One small, doable task for today. No pressure, no "overdue". */
export function miniTaskFor(daysLeft: number): string {
  if (daysLeft > 30) return 'Daydream together: pick one thing you’re most excited about.';
  return MINI_TASKS.find((t) => daysLeft <= t.atOrBelow)?.text ?? MINI_TASKS[MINI_TASKS.length - 1].text;
}

export type WeatherSummary = {
  minC: number;
  maxC: number;
  rainyDays: number;
  days: number;
  source: 'forecast' | 'last-year' | 'chosen';
};

/** Rough weather from a simple choice, for when we can't look it up. */
export function weatherFromChoice(choice: 'hot' | 'mild' | 'cold' | 'rainy', days: number): WeatherSummary {
  const base = { hot: [22, 33, 0], mild: [12, 22, 1], cold: [-2, 8, 1], rainy: [10, 18, Math.max(2, Math.ceil(days / 2))] }[choice];
  return { minC: base[0], maxC: base[1], rainyDays: base[2], days, source: 'chosen' };
}

export function weatherLine(w: WeatherSummary): string {
  const temp = `${Math.round(w.minC)}–${Math.round(w.maxC)}°C`;
  const rain = w.rainyDays === 0 ? 'mostly dry' : w.rainyDays === 1 ? 'one rainy day' : `${w.rainyDays} rainy days`;
  const src = w.source === 'forecast' ? 'forecast' : w.source === 'last-year' ? 'same dates last year' : 'what you expect';
  return `${temp}, ${rain} (${src})`;
}

/** Packing suggestions that adapt to the weather and trip length. */
export function packingFor(w: WeatherSummary): string[] {
  const nights = Math.max(1, w.days);
  const out = [
    `Underwear and socks for ${nights + 1} days`,
    'Toothbrush and toiletries',
    'Phone chargers and a power bank',
    'Any medicines you take',
    'Comfy walking shoes',
  ];
  if (w.maxC >= 24) out.push('Light, breathable clothes', 'Sunscreen', 'Sunglasses and a hat', 'Refillable water bottle');
  if (w.maxC >= 27) out.push('Swimsuit');
  if (w.minC < 12) out.push('A warm layer for evenings');
  if (w.minC < 4) out.push('Warm coat, hat and gloves');
  if (w.rainyDays > 0) out.push('Rain jacket or umbrella');
  if (w.rainyDays >= 2) out.push('Shoes that don’t mind puddles');
  if (nights >= 5) out.push('Small laundry bag');
  out.push('Something cozy for the journey');
  return out;
}

/** Gentle rest-day suggestion: roughly one slow day every four days. */
export function suggestRestDays(start: string, end: string): string[] {
  const len = daysBetween(start, end) + 1;
  if (len < 4) return [];
  const out: string[] = [];
  for (let d = 3; d < len - 1; d += 4) out.push(dayKey(addDays(fromDayKey(start), d)));
  return out;
}

export function tripDays(start: string, end: string): string[] {
  const n = Math.max(0, daysBetween(start, end)) + 1;
  return Array.from({ length: Math.min(n, 60) }, (_, i) => dayKey(addDays(fromDayKey(start), i)));
}

export function stressReply(level: number, otherLevel?: number): string {
  if (level >= 4 && (otherLevel ?? 0) >= 4) return 'You’re both feeling it. Maybe plan a slow first day and keep evenings free.';
  if (level >= 4) return 'Totally normal before a trip. Let’s add a rest day and keep the plan light.';
  if (level === 3) return 'A little nervous excitement. A checklist and an early night help.';
  return 'Feeling calm. Lovely. Enjoy the anticipation.';
}

/** Trip mood recap from journal entries (emoji counts, most common first). */
export function moodRecap(moods: (string | undefined)[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  moods.forEach((m) => m && counts.set(m, (counts.get(m) ?? 0) + 1));
  return [...counts.entries()].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count);
}
