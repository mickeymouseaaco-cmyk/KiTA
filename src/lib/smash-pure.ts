/**
 * Stress Smash: the words and numbers behind the little game. Pure, so it's easy to test.
 * Nothing here is saved anywhere: the name lives only on the screen.
 */

export const HITS = 5;
export const NAME_MAX = 24;
export const DEFAULT_TARGET = 'Mr. Stress';

/** One word per bonk; the last one is the big one. */
export const BONK_WORDS: readonly string[] = ['BONK!', 'BOINK!', 'BONK!', 'POW!', 'MEGA BONK!'];
export const BONUS_WORDS: readonly string[] = ['BONK!', 'BOOP!', 'BONK!', 'SQUEAK!', 'BOINK!'];

export const CHEERS: readonly string[] = [
  'There you go! Feeling better? 😂',
  'Stress level: hopefully reduced!',
  'Deep breath. You’ve got this! ❤️',
  'Thoroughly bonked. Now go get a snack. 🍫',
  'That one was for your sanity. 😌',
  'Squeaky clean. On with your day! ✨',
];

/** The name to show on the dummy: tidy spaces, short enough to fit, or a friendly default. */
export function targetName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return name || DEFAULT_TARGET;
}

/** Longer names get smaller letters so they always fit on the dummy's tag. */
export function nameSize(name: string): number {
  if (name.length <= 8) return 19;
  if (name.length <= 14) return 15;
  return 12;
}

/** Each round gets the next message, so replays feel fresh. */
export function cheerFor(round: number): string {
  const n = CHEERS.length;
  return CHEERS[((round % n) + n) % n];
}

/** The stress meter after `hit` of `hits` bonks: 100 → 0. */
export function stressAfter(hit: number, hits = HITS): number {
  if (hits <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - hit / hits))));
}
