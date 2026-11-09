/** Pure: date night ideas and milestone maths/prompts. */
import { dayKey, fromDayKey } from './dates';

export type Budget = 0 | 1 | 2; // free, a little, a treat
export type Energy = 'cozy' | 'active';
export type TimeNeeded = 'short' | 'evening' | 'day';

export type DateIdea = { id: string; title: string; detail: string; budget: Budget; energy: Energy; time: TimeNeeded };

export const DATE_IDEAS: DateIdea[] = [
  { id: 'blanket-movie', title: 'Blanket fort movie night', detail: 'Pillows, a nostalgic film, and popcorn in a big bowl.', budget: 0, energy: 'cozy', time: 'evening' },
  { id: 'no-phone-dinner', title: 'No-phone dinner', detail: 'Cook something simple together and leave the phones in a drawer.', budget: 1, energy: 'cozy', time: 'evening' },
  { id: 'sunset-walk', title: 'Sunset walk', detail: 'Find the nearest spot with a view and just watch.', budget: 0, energy: 'active', time: 'short' },
  { id: 'questions', title: '20 questions, deep edition', detail: 'Take turns asking things you’ve never asked each other.', budget: 0, energy: 'cozy', time: 'short' },
  { id: 'picnic', title: 'Living-room picnic', detail: 'Lay a blanket on the floor and eat with your hands.', budget: 1, energy: 'cozy', time: 'evening' },
  { id: 'stargazing', title: 'Stargazing', detail: 'Drive a little out of town, bring a blanket and a flask of tea.', budget: 0, energy: 'active', time: 'evening' },
  { id: 'cook-new', title: 'Cook a dish from your next trip', detail: 'Pick the cuisine of a bucket-list place and try it at home.', budget: 1, energy: 'cozy', time: 'evening' },
  { id: 'museum', title: 'Museum, then coffee', detail: 'Each pick your favorite piece and tell the other why.', budget: 1, energy: 'active', time: 'day' },
  { id: 'spa-night', title: 'At-home spa night', detail: 'Face masks, a warm bath, and slow music.', budget: 1, energy: 'cozy', time: 'evening' },
  { id: 'bike', title: 'Bike to somewhere new', detail: 'Pick a cafe you’ve never been to and make it the destination.', budget: 1, energy: 'active', time: 'day' },
  { id: 'letters', title: 'Write each other letters', detail: 'Ten minutes, one page, then read them aloud.', budget: 0, energy: 'cozy', time: 'short' },
  { id: 'dance', title: 'Kitchen dance party', detail: 'Three songs each from the year you met.', budget: 0, energy: 'active', time: 'short' },
  { id: 'tasting', title: 'Tiny tasting menu', detail: 'Five little bites from the corner shop, ranked together.', budget: 1, energy: 'cozy', time: 'short' },
  { id: 'fancy', title: 'Dress up for dinner out', detail: 'Book somewhere a little special, just because.', budget: 2, energy: 'active', time: 'evening' },
  { id: 'daytrip', title: 'Spontaneous day trip', detail: 'Take the first train somewhere within two hours.', budget: 2, energy: 'active', time: 'day' },
  { id: 'class', title: 'Take a class together', detail: 'Pottery, salsa, or cooking: something neither of you has tried.', budget: 2, energy: 'active', time: 'evening' },
  { id: 'photos', title: 'Old photos evening', detail: 'Scroll back to your first year and tell the stories behind them.', budget: 0, energy: 'cozy', time: 'short' },
  { id: 'breakfast', title: 'Breakfast in bed', detail: 'Take turns: one cooks, one stays cozy.', budget: 1, energy: 'cozy', time: 'short' },
  { id: 'hike', title: 'Morning hike', detail: 'Pack snacks, find a trail, and have a slow lunch at the top.', budget: 0, energy: 'active', time: 'day' },
  { id: 'game', title: 'Board game tournament', detail: 'Best of three. The loser makes tea.', budget: 0, energy: 'cozy', time: 'evening' },
  { id: 'massage', title: 'Book a couples massage', detail: 'An hour of doing absolutely nothing, together.', budget: 2, energy: 'cozy', time: 'evening' },
  { id: 'market', title: 'Farmers market wander', detail: 'Each choose one ingredient and cook with them both.', budget: 1, energy: 'active', time: 'day' },
];

export type IdeaFilter = { budget?: Budget; energy?: Energy; time?: TimeNeeded };

export function matchingIdeas(f: IdeaFilter, ideas: DateIdea[] = DATE_IDEAS): DateIdea[] {
  return ideas.filter(
    (i) =>
      (f.budget === undefined || i.budget <= f.budget) &&
      (f.energy === undefined || i.energy === f.energy) &&
      (f.time === undefined || i.time === f.time),
  );
}

/** A random idea that isn't the one just shown. `rand` is injectable for tests. */
export function pickIdea(f: IdeaFilter, previousId?: string, rand: () => number = Math.random): DateIdea | null {
  const all = matchingIdeas(f);
  const pool = all.length > 1 ? all.filter((i) => i.id !== previousId) : all;
  if (!pool.length) return null;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

// ------------------------------------------------------------- milestones

export type MilestoneKind = 'anniversary' | 'birthday' | 'first-trip' | 'other';

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  anniversary: 'Anniversary',
  birthday: 'Birthday',
  'first-trip': 'First trip together',
  other: 'Special day',
};

/** The next time this date comes round (today counts), for yearly milestones. */
export function nextOccurrence(date: string, yearly: boolean, today: string = dayKey()): string | null {
  if (!yearly) return date >= today ? date : null;
  const [, m, d] = date.split('-');
  const t = fromDayKey(today);
  const thisYear = `${t.getFullYear()}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${t.getFullYear() + 1}-${m}-${d}`;
}

export function daysUntil(target: string, today: string = dayKey()): number {
  return Math.round((fromDayKey(target).getTime() - fromDayKey(today).getTime()) / 86_400_000);
}

export function yearsSince(date: string, on: string): number {
  return Number(on.slice(0, 4)) - Number(date.slice(0, 4));
}

/** A sweet, practical planning prompt that fits how close the day is. */
export function planningPrompt(kind: MilestoneKind, days: number, personName?: string): string {
  if (days === 0) {
    return kind === 'birthday' ? `It’s ${personName ?? 'their'} birthday! Make today feel easy and celebrated.` : 'It’s today! Take a moment to remember how it began.';
  }
  if (days === 1) return kind === 'birthday' ? 'Tomorrow. Write a card tonight while it’s quiet.' : 'Tomorrow. Write a few lines about your favorite memory together.';
  if (days <= 7) {
    return kind === 'anniversary'
      ? 'One week. Book a table, or plan a picnic of their favorite foods.'
      : kind === 'birthday'
        ? 'One week. Order the gift now so there’s no rush.'
        : 'One week. Pick one small way to mark it.';
  }
  if (days <= 30) {
    return kind === 'anniversary'
      ? 'A month away. Could you recreate your first date?'
      : kind === 'birthday'
        ? `A month away. Quietly ask a friend what ${personName ?? 'they'}’ve been wanting.`
        : kind === 'first-trip'
          ? 'Look back at the photos from that first trip together.'
          : 'Coming up. Start a little list of ideas.';
  }
  return 'Plenty of time. Just enjoy knowing it’s coming.';
}
