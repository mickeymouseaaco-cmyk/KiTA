/**
 * The living sky: what the sky looks like right now (time of day × weather),
 * a playful line for it, and little suggestions for the two of you from the
 * week's forecast. Pure (no network, no React), so it's easy to test.
 */
import type { ForecastDay, SkyKind } from './flood-pure';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** The hour (0–23.99) in Malaysia, where the weather areas are. */
export function hourInMalaysia(now = Date.now()): number {
  const d = new Date(now + 8 * 3600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Sunrise is about 7:10 and sunset about 19:20 all year round near the equator. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 6.5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18.5) return 'day';
  if (hour >= 18.5 && hour < 19.75) return 'dusk';
  return 'night';
}

/** Top and bottom colours of the sky. */
export function skyColors(kind: SkyKind, tod: TimeOfDay): [string, string] {
  const wet = kind === 'rain' || kind === 'drizzle';
  if (kind === 'storm') return tod === 'night' ? ['#121628', '#2C3350'] : ['#2B3452', '#5D6886'];
  if (tod === 'night') return wet || kind === 'cloud' || kind === 'fog' ? ['#161D33', '#36415E'] : ['#0A1238', '#2A3F7C'];
  if (tod === 'dawn') return wet ? ['#6E7FA0', '#D9A796'] : kind === 'cloud' || kind === 'fog' ? ['#9AA7BF', '#F2C6A8'] : ['#FF9F7A', '#FFD9A1'];
  if (tod === 'dusk') return wet ? ['#4F5A85', '#C88A8F'] : kind === 'cloud' || kind === 'fog' ? ['#6F6A9A', '#E9A48F'] : ['#5B4BC4', '#FF8F6B'];
  if (wet) return ['#4F6E92', '#93A9C2'];
  if (kind === 'fog') return ['#98A4B3', '#D2D8E0'];
  if (kind === 'cloud') return ['#6F8BB0', '#B7C8DC'];
  if (kind === 'partly') return ['#3F8CEB', '#9FCBF5'];
  return ['#2F86FF', '#8FD0FF'];
}

/** What to draw. */
export function skyLayers(kind: SkyKind, tod: TimeOfDay) {
  const night = tod === 'night';
  return {
    sun: !night && (kind === 'sun' || kind === 'partly'),
    moon: night && (kind === 'sun' || kind === 'partly' || kind === 'cloud'),
    stars: night && (kind === 'sun' || kind === 'partly') ? 16 : 0,
    clouds: kind === 'sun' ? 1 : kind === 'partly' ? 3 : kind === 'cloud' || kind === 'fog' ? 5 : 4,
    darkClouds: kind === 'rain' || kind === 'storm',
    rain: kind === 'drizzle' ? 12 : kind === 'rain' ? 26 : kind === 'storm' ? 32 : 0,
    lightning: kind === 'storm',
    fog: kind === 'fog',
  };
}

/** A playful line for the sky right now. Changes with a tap. */
export function skyLines(kind: SkyKind, tod: TimeOfDay, maxC: number | null, partner: string): string[] {
  const p = partner || 'your love';
  const hot = maxC !== null && maxC >= 33;
  const lines: Record<SkyKind, string[]> = {
    sun: [
      hot ? `Sizzling. Shade, cold drinks, and ${p}.` : 'Blue sky, no excuses. Go outside together.',
      'Sunglasses on. Main-character weather.',
      `Perfect light for a photo with ${p}.`,
    ],
    partly: ['A little sun, a little cloud. Just right.', 'Good walking weather. Hand-holding optional, but recommended.', 'Clouds are just the sky doing art.'],
    cloud: ['Soft grey sky. Cosy café weather.', 'No harsh sun today. Long walk, anyone?', 'The sky is wearing a blanket.'],
    fog: ['Hazy out there. Take it slow.', 'Mysterious sky. Stay close.', 'A good day for a mask and indoor plans.'],
    drizzle: ['Just a sprinkle. Bring a small umbrella.', 'Light rain, big hoodie energy.', `A drizzle is a good excuse to share an umbrella with ${p}.`],
    rain: [`Umbrella day. Pick one big enough for two.`, 'Rain on the roof, noodles in the bowl.', 'Pitter-patter. Stay dry, check in on each other.'],
    storm: ['Thunder about. A cosy night in sounds right.', `Storm outside, blanket fort inside. Invite ${p}.`, 'Stay indoors when it rumbles. Text each other when home safe.'],
  };
  const night = tod === 'night';
  const out = lines[kind].slice();
  if (night && (kind === 'sun' || kind === 'partly')) out.unshift('Clear night. Look up together: stars are out.');
  if (tod === 'dawn' && (kind === 'sun' || kind === 'partly')) out.unshift('Golden morning. Coffee together before the day starts?');
  if (tod === 'dusk' && (kind === 'sun' || kind === 'partly')) out.unshift('Sunset soon. Five minutes outside, just the two of you.');
  return out;
}

export type TipIcon = 'walk' | 'umbrella' | 'hot' | 'home' | 'weekend' | 'sunset';
export type CoupleTip = { icon: TipIcon; text: string };

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** Up to three ideas for the two of you from the week ahead. */
export function coupleTips(days: readonly ForecastDay[], partner: string, fmt: (c: number) => string = (c) => `${c}°`): CoupleTip[] {
  if (!days.length) return [];
  const p = partner || 'your love';
  const tips: CoupleTip[] = [];
  const today = days[0];
  const wet = (d: ForecastDay) => d.rainMm >= 5 || d.rainChance >= 70;
  if (today.maxHourlyMm >= 15 || today.code >= 95) tips.push({ icon: 'home', text: `Stormy today. A cosy night in with ${p}: a film and your favourite takeaway.` });
  else if (wet(today)) tips.push({ icon: 'umbrella', text: 'Rain likely today. Pack an umbrella big enough for two.' });
  if (today.maxC >= 33) tips.push({ icon: 'hot', text: `Hot one at ${fmt(today.maxC)}. Plan outdoor things for the evening, and stay in the shade.` });

  // The best day ahead for doing something outside together: dry first, then not too hot.
  const ahead = days.slice(1);
  const best = [...ahead].sort((a, b) => a.rainMm - b.rainMm || a.rainChance - b.rainChance || Math.abs(a.maxC - 30) - Math.abs(b.maxC - 30))[0];
  if (best && !wet(best)) tips.push({ icon: 'walk', text: `${weekday(best.date)} looks best for an outing together: ${best.rainChance}% rain, up to ${fmt(best.maxC)}.` });

  // Weekend: which day is nicer.
  const sat = ahead.find((d) => weekday(d.date) === 'Saturday');
  const sun = ahead.find((d) => weekday(d.date) === 'Sunday');
  if (sat && sun && Math.abs(sat.rainMm - sun.rainMm) >= 3) {
    const drier = sat.rainMm < sun.rainMm ? 'Saturday' : 'Sunday';
    tips.push({ icon: 'weekend', text: `This weekend, ${drier} is the drier day. Save your plans for then.` });
  }
  if (!wet(today) && today.code <= 2 && tips.length < 3) tips.push({ icon: 'sunset', text: 'Clear-ish evening ahead. Catch the sunset together.' });
  return tips.slice(0, 3);
}

/** Where a day's low and high sit on the week's temperature scale (0–1), for the range bars. */
export function rangeBar(d: Pick<ForecastDay, 'minC' | 'maxC'>, weekMin: number, weekMax: number): { from: number; to: number } {
  const span = Math.max(1, weekMax - weekMin);
  const from = Math.max(0, Math.min(1, (d.minC - weekMin) / span));
  const to = Math.max(from + 0.08, Math.min(1, (d.maxC - weekMin) / span));
  return { from, to: Math.min(1, to) };
}
