/**
 * Support ideas that adapt to what the partner chose to share.
 * Pure functions: easy to test, no network.
 */
import type { LoveLanguage, SharedDay } from './types';

export type SuggestionIcon = 'heart' | 'coffee' | 'moon' | 'gift' | 'bath' | 'phone-off' | 'sparkles' | 'utensils' | 'mic' | 'hand';

export type Suggestion = {
  id: string;
  icon: SuggestionIcon;
  title: string;
  detail: string;
  /** If set, the idea can be sent as a quick message in one tap. */
  quickText?: string;
};

export type GentleAlert = { kind: 'stress' | 'steps'; text: string };

const HEAVY_MOODS = new Set(['Sad', 'Worried', 'Frustrated', 'Tired']);
const BRIGHT_MOODS = new Set(['Happy', 'Loved', 'Calm']);

export function isHighSteps(day?: SharedDay): boolean {
  if (!day?.steps) return false;
  const goal = day.stepGoal || 8000;
  return day.steps >= 15000 || day.steps >= goal * 1.6;
}

/** A soft heads-up, never an alarm. Only from shared data. */
export function gentleAlert(name: string, day?: SharedDay): GentleAlert | null {
  if (day?.mood && day.mood.stress >= 4) {
    return { kind: 'stress', text: `${name} shared that today feels heavy. A little care could go a long way.` };
  }
  if (isHighSteps(day)) {
    return { kind: 'steps', text: `${name} has been on their feet a lot today. Maybe a cozy evening in?` };
  }
  return null;
}

export const LOVE_LANGUAGES: { key: LoveLanguage; label: string; detail: string }[] = [
  { key: 'words', label: 'Kind words', detail: 'Hearing "I appreciate you", notes, compliments' },
  { key: 'time', label: 'Quality time', detail: 'Undivided attention, doing things together' },
  { key: 'service', label: 'Helpful acts', detail: 'Someone taking a task off your plate' },
  { key: 'gifts', label: 'Little gifts', detail: 'Thoughtful surprises, big or tiny' },
  { key: 'touch', label: 'Touch', detail: 'Hugs, holding hands, a shoulder rub' },
];

/** One idea per love language, tuned to how heavy the day is. */
function languageIdea(lang: LoveLanguage, name: string, heavy: boolean): Suggestion {
  switch (lang) {
    case 'words':
      return heavy
        ? { id: 'll-words', icon: 'heart', title: 'Tell them what you admire', detail: `${name} feels loved through words.`, quickText: 'I\u2019m so proud of how you handle hard days.' }
        : { id: 'll-words', icon: 'heart', title: 'Write them something kind', detail: `${name} feels loved through words.`, quickText: 'You make ordinary days feel special.' };
    case 'time':
      return { id: 'll-time', icon: 'phone-off', title: heavy ? 'Offer 20 quiet minutes together' : 'Plan a little time together', detail: `${name} feels loved through time together.`, quickText: heavy ? 'Can I have 20 minutes with you tonight? Phones away.' : 'Walk with me tonight?' };
    case 'service':
      return { id: 'll-service', icon: 'utensils', title: 'Take a task off their list', detail: `${name} feels loved through helpful acts.`, quickText: 'I\u2019ll handle dinner and dishes tonight.' };
    case 'gifts':
      return { id: 'll-gifts', icon: 'gift', title: 'Bring home a tiny surprise', detail: `${name} feels loved through little gifts.` };
    case 'touch':
      return { id: 'll-touch', icon: 'hand', title: heavy ? 'Send a hug, then give a real one' : 'A long hug when you see them', detail: `${name} feels loved through touch.` };
  }
}

export function suggestionsFor(name: string, day?: SharedDay, languages: LoveLanguage[] = []): Suggestion[] {
  const out: Suggestion[] = [];
  const heavyDay = (day?.mood?.stress ?? 0) >= 3 || (!!day?.mood?.label && HEAVY_MOODS.has(day.mood.label));
  // Their own love languages come first: it's how they like to be cared for.
  languages.slice(0, 2).forEach((l) => out.push(languageIdea(l, name, heavyDay)));
  const stress = day?.mood?.stress;
  const label = day?.mood?.label;

  if (stress && stress >= 4) {
    out.push(
      { id: 'no-phone', icon: 'phone-off', title: 'Plan a no-phone evening', detail: 'Just the two of you, a blanket, and quiet.' },
      { id: 'dessert', icon: 'gift', title: 'Send their favorite dessert', detail: 'A small sweet thing says "I see you".' },
      { id: 'massage', icon: 'sparkles', title: 'Book a massage', detail: 'Or offer a shoulder rub tonight.' },
      { id: 'here', icon: 'heart', title: 'Let them know you’re here', detail: 'No need for them to reply.', quickText: "I'm here. No need to reply." },
    );
  } else if (stress === 3 || (label && HEAVY_MOODS.has(label))) {
    out.push(
      { id: 'warm-drink', icon: 'coffee', title: 'Make them a warm drink', detail: 'Tea, cocoa, or whatever feels like a hug in a mug.' },
      { id: 'dinner', icon: 'utensils', title: 'Take dinner off their plate', detail: 'One less thing to think about.', quickText: "Rest tonight, I've got dinner" },
      { id: 'thinking', icon: 'heart', title: 'Send a little hello', detail: 'Small words land softly.', quickText: 'Thinking of you' },
    );
  }

  if (isHighSteps(day)) {
    out.push(
      { id: 'bath', icon: 'bath', title: 'Run them a warm bath', detail: 'Tired feet will thank you.' },
      { id: 'proud-steps', icon: 'sparkles', title: 'Cheer them on', detail: 'They moved a lot today.', quickText: 'Proud of you, that’s a lot of walking!' },
    );
  }

  if (label && BRIGHT_MOODS.has(label) && (!stress || stress <= 2)) {
    out.push({ id: 'celebrate', icon: 'sparkles', title: 'Share the good mood', detail: 'Tell them it’s lovely to see.', quickText: 'Love seeing you happy' });
  }

  // Always-good gentle defaults, so there is never an empty list.
  out.push(
    { id: 'voice-hug', icon: 'mic', title: 'Send a voice hug', detail: `Ten seconds of your voice for ${name}.` },
    { id: 'good-moment', icon: 'moon', title: 'Ask about one good moment', detail: 'Tonight, over dinner or before sleep.', quickText: 'What was one good moment today?' },
  );

  // De-duplicate and keep the list short and calm.
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true))).slice(0, 5);
}
