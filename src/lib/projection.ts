import type { DailyLog, ShareSettings, SharedDay } from './types';

/** Pure: what the partner is allowed to see from a private day. */
export function projectDay(uid: string, day: DailyLog, share: ShareSettings): Omit<SharedDay, 'updatedAt'> {
  const out: Omit<SharedDay, 'updatedAt'> = { ownerId: uid, date: day.date };
  if (share.steps && typeof day.steps === 'number') {
    out.steps = day.steps;
    out.stepGoal = day.stepGoal;
  }
  if (share.mood && day.mood) {
    const { emoji, label, stress, note, sharedMediaId } = day.mood;
    out.mood = { emoji, label, stress };
    if (note) out.mood.note = note;
    // A mood selfie/voice is shown only while photo & voice sharing is also on.
    if (share.media && sharedMediaId) out.mood.mediaId = sharedMediaId;
  }
  if (share.food && day.food && ((day.food.meals?.length ?? 0) > 0 || (day.food.water ?? 0) > 0)) {
    // Only what was eaten and how much water. Never timestamps or ids.
    out.food = {
      meals: (day.food.meals ?? []).map(({ kind, text }) => ({ kind, text })),
      water: day.food.water ?? 0,
    };
  }
  if (share.cycle && day.cycle) {
    const { phase, day: d, daysUntilNext, symptoms } = day.cycle;
    out.cycle = { phase, day: d, daysUntilNext, symptoms: symptoms ?? [] };
  }
  // Check-ins, vent, and private media are never part of a projection.
  return out;
}
