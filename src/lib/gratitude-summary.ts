import type { Gratitude } from './types';

export type WeeklyAppreciation = { mine: number; theirs: number; line: string };

/** Pure: a warm one-line summary of the week. Celebrates, never compares. */
export function weeklyAppreciation(items: Pick<Gratitude, 'ownerId' | 'date'>[], uid: string, partnerName: string, weekKeys: string[]): WeeklyAppreciation {
  const inWeek = items.filter((g) => weekKeys.includes(g.date));
  const mine = inWeek.filter((g) => g.ownerId === uid).length;
  const theirs = inWeek.length - mine;
  const total = mine + theirs;
  let line: string;
  if (total === 0) line = 'A fresh week for thank-yous. The smallest one counts.';
  else if (total === 1) line = 'One thank-you this week. A lovely start.';
  else if (mine > 0 && theirs > 0) line = `You thanked each other ${total} times this week. That’s a lot of noticing.`;
  else if (theirs > 0) line = `${partnerName} thanked you ${theirs} times this week.`;
  else line = `You thanked ${partnerName} ${mine} times this week.`;
  return { mine, theirs, line };
}
