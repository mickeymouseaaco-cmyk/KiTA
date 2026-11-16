/**
 * The bucket list: things to do together, not just places to go. Each item has
 * a kind; older items (from when it was a map of places) count as places.
 * Pure, so it's easy to test.
 */

export type BucketKind = 'do' | 'go' | 'eat' | 'learn' | 'watch';

export const BUCKET_KINDS: { id: BucketKind; label: string; hint: string }[] = [
  { id: 'do', label: 'Do', hint: 'Watch a sunrise, go stargazing…' },
  { id: 'go', label: 'Go', hint: 'Kyoto, the Northern Lights…' },
  { id: 'eat', label: 'Eat', hint: 'Omakase, cook a feast together…' },
  { id: 'learn', label: 'Learn', hint: 'A dance class, pottery…' },
  { id: 'watch', label: 'See', hint: 'A concert, a musical…' },
];

export function kindOf(item: { kind?: string }): BucketKind {
  return BUCKET_KINDS.some((k) => k.id === item.kind) ? (item.kind as BucketKind) : 'go';
}

/** Ideas to tap and add, a few per kind. */
export const BUCKET_IDEAS: { kind: BucketKind; text: string }[] = [
  { kind: 'do', text: 'Watch the sunrise together' },
  { kind: 'do', text: 'A night of stargazing' },
  { kind: 'do', text: 'A road trip with no plan' },
  { kind: 'do', text: 'Volunteer for a day together' },
  { kind: 'do', text: 'Plant a tree together' },
  { kind: 'do', text: 'A whole day with phones off' },
  { kind: 'eat', text: 'Cook a three-course dinner together' },
  { kind: 'eat', text: 'Try a food we’ve never had' },
  { kind: 'eat', text: 'A picnic at the beach' },
  { kind: 'learn', text: 'Take a dance class' },
  { kind: 'learn', text: 'Learn to make kuih together' },
  { kind: 'learn', text: 'A pottery class' },
  { kind: 'watch', text: 'See a concert together' },
  { kind: 'watch', text: 'A movie marathon of our favourites' },
  { kind: 'go', text: 'See the Northern Lights' },
  { kind: 'go', text: 'Climb Mount Kinabalu' },
];

/** Ideas not already on the list (case-insensitive), for the chosen kind or all. */
export function freshIdeas(have: { name: string }[], kind: BucketKind | 'all', n = 6): { kind: BucketKind; text: string }[] {
  const taken = new Set(have.map((h) => h.name.trim().toLowerCase()));
  return BUCKET_IDEAS.filter((i) => (kind === 'all' || i.kind === kind) && !taken.has(i.text.toLowerCase())).slice(0, n);
}

/** "3 dreams · 1 done together". */
export function bucketSummary(items: { visited: boolean }[]): string {
  if (!items.length) return 'Things you’d love to do together, big and small.';
  const done = items.filter((i) => i.visited).length;
  return `${items.length - done} to do · ${done} done together`;
}
