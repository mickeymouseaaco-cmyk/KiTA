/** Pure helpers for the plant and couple streaks (no Firebase). */

export type PlantStage = { index: number; name: string; line: string; next: number | null; floor: number };

const STAGES: { at: number; name: string; line: string }[] = [
  { at: 0, name: 'Seed', line: 'A tiny seed, waiting for a little care.' },
  { at: 5, name: 'Sprout', line: 'A sprout! Every kind thing helps it grow.' },
  { at: 15, name: 'Seedling', line: 'Growing steadily, just like you two.' },
  { at: 35, name: 'Little plant', line: 'Leafy and happy. You’re looking after each other.' },
  { at: 75, name: 'In bloom', line: 'It’s blooming. So much care in here.' },
  { at: 150, name: 'Flourishing', line: 'Flourishing, thanks to both of you.' },
];

/** Pure. The plant only ever grows: no wilting, no guilt. */
export function plantStage(points: number): PlantStage {
  let i = 0;
  while (i + 1 < STAGES.length && points >= STAGES[i + 1].at) i++;
  return { index: i, name: STAGES[i].name, line: STAGES[i].line, floor: STAGES[i].at, next: STAGES[i + 1]?.at ?? null };
}

/** Consecutive days (up to today) on which you both did something caring. Pure. */
export function coupleStreak(careDays: Record<string, string[]>, members: string[], days: string[]): number {
  const both = (d: string) => members.every((m) => careDays[d]?.includes(m));
  const list = [...days].reverse();
  let i = both(list[0]) ? 0 : 1; // today isn't over yet
  let n = 0;
  for (; i < list.length && both(list[i]); i++) n++;
  return n;
}

