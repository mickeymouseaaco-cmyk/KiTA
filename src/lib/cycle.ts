/**
 * Cycle tracking: pure, local calculations. Predictions are estimates, and the
 * copy says so. Private by default; only the computed day (phase, day number,
 * days until next, symptoms) is ever projected, and only if shared.
 */
import { addDays, dayKey, fromDayKey } from './dates';
import type { CycleDay, CyclePhase, CycleSettings } from './types';

export const DEFAULT_CYCLE: CycleSettings = { enabled: false, lastStart: '', cycleLength: 28, periodLength: 5 };

export const SYMPTOMS = ['Cramps', 'Tired', 'Headache', 'Bloated', 'Tender', 'Moody', 'Cravings', 'Low energy', 'Feeling good'] as const;

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Period',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export const PHASE_LINE: Record<CyclePhase, string> = {
  menstrual: 'Rest is productive too. Warmth and slow evenings help.',
  follicular: 'Energy often rises now. A nice time for something new.',
  ovulation: 'Many people feel bright and social around now.',
  luteal: 'Things can feel a little heavier. Be extra kind to yourself.',
};

function daysBetween(a: string, b: string): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);
}

export function phaseFor(day: number, cycleLength: number, periodLength: number): CyclePhase {
  const ovulationDay = Math.max(periodLength + 2, cycleLength - 14);
  if (day <= periodLength) return 'menstrual';
  if (Math.abs(day - ovulationDay) <= 1) return 'ovulation';
  if (day < ovulationDay) return 'follicular';
  return 'luteal';
}

/** Where today sits in the cycle, or null if not set up (or the start date is in the future). */
export function cycleToday(s: CycleSettings, today: string = dayKey(), symptoms: string[] = []): CycleDay | null {
  if (!s.enabled || !s.lastStart) return null;
  const length = Math.min(60, Math.max(18, s.cycleLength || 28));
  const period = Math.min(10, Math.max(1, s.periodLength || 5));
  const since = daysBetween(s.lastStart, today);
  if (since < 0) return null;
  const day = (since % length) + 1;
  return { phase: phaseFor(day, length, period), day, daysUntilNext: length - day + 1, symptoms };
}

export function nextPeriod(s: CycleSettings, today: string = dayKey()): string | null {
  const c = cycleToday(s, today);
  return c ? dayKey(addDays(fromDayKey(today), c.daysUntilNext)) : null;
}

export function predictionLine(c: CycleDay): string {
  if (c.phase === 'menstrual') return `Day ${c.day} of your period.`;
  if (c.daysUntilNext <= 1) return 'Your period may start around tomorrow.';
  if (c.daysUntilNext <= 3) return `Your period may start in about ${c.daysUntilNext} days.`;
  return `Next period expected in about ${c.daysUntilNext} days.`;
}

export type CycleTip = { id: string; text: string; quickText?: string };

/** Gentle ideas for the partner, from what was shared. */
export function partnerCycleTips(name: string, c: CycleDay): CycleTip[] {
  const tips: CycleTip[] = [];
  const has = (s: string) => c.symptoms.includes(s);
  if (c.phase === 'menstrual' || has('Cramps')) {
    tips.push({ id: 'warm', text: 'Bring a warm drink or a heat pad', quickText: 'Want a hot water bottle? I’ll bring one.' });
    tips.push({ id: 'snacks', text: `Stock up on ${name}’s favorite snacks` });
  }
  if (c.phase === 'luteal' || has('Moody')) {
    tips.push({ id: 'patience', text: 'Extra patience and soft words go a long way' });
  }
  if (has('Cravings')) tips.push({ id: 'treat', text: 'Surprise them with a little treat' });
  if (has('Tired') || has('Low energy')) {
    tips.push({ id: 'chores', text: 'Take a chore off their list tonight', quickText: 'I’ve got the chores tonight. Rest up.' });
  }
  if (has('Headache')) tips.push({ id: 'quiet', text: 'Plan a quiet, dim evening' });
  if (c.phase === 'follicular' || c.phase === 'ovulation' || has('Feeling good')) {
    tips.push({ id: 'plan', text: 'A nice moment to plan something fun together' });
  }
  if (tips.length === 0) tips.push({ id: 'ask', text: 'Ask how they’re feeling, and just listen', quickText: 'How are you feeling today, love?' });
  const seen = new Set<string>();
  return tips.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).slice(0, 4);
}
