/**
 * Weather for anywhere: which place the weather is for, °C or °F, and the
 * local time of day there. Pure (no network, no storage), so it's easy to test.
 */
import type { AreaId } from './flood-pure';
import type { TimeOfDay } from './sky-pure';

/** A Malaysian flood-watch area (with warnings and rivers), or any place on Earth. */
export type WeatherPlace =
  | { kind: 'area'; id: AreaId }
  | { kind: 'here' | 'city'; name: string; country?: string; lat: number; lon: number };

export type Units = 'C' | 'F';

const AREA_IDS: readonly AreaId[] = ['shahalam', 'klang'];

/** A saved place, checked (an older or newer app version may have written it). */
export function cleanPlace(raw: unknown): WeatherPlace | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.kind === 'area' && AREA_IDS.includes(r.id as AreaId)) return { kind: 'area', id: r.id as AreaId };
  if ((r.kind === 'here' || r.kind === 'city') && typeof r.lat === 'number' && typeof r.lon === 'number' && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180) {
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 80) : 'Near you';
    const country = typeof r.country === 'string' && r.country.trim() ? r.country.trim().slice(0, 60) : undefined;
    return { kind: r.kind, name, ...(country ? { country } : {}), lat: Math.round(r.lat * 1e3) / 1e3, lon: Math.round(r.lon * 1e3) / 1e3 };
  }
  return null;
}

/** First time: people in Malaysia start with the Shah Alam flood watch; everyone else chooses. */
export function defaultPlace(timeZone: string | undefined): WeatherPlace | null {
  return timeZone === 'Asia/Kuala_Lumpur' || timeZone === 'Asia/Kuching' ? { kind: 'area', id: 'shahalam' } : null;
}

/** °F where people use it (US and a few others); °C everywhere else. */
export function unitsFor(locale: string | undefined): Units {
  const region = (locale ?? '').split(/[-_]/)[1]?.toUpperCase();
  return region && ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'].includes(region) ? 'F' : 'C';
}

export const toF = (c: number) => Math.round((c * 9) / 5 + 32);

/** "31°" or "88°". */
export function temp(c: number, units: Units): string {
  return `${units === 'F' ? toF(c) : Math.round(c)}°`;
}

/** "14 km/h" or "9 mph". */
export function speed(kmh: number, units: Units): string {
  return units === 'F' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
}

/** "13.5 mm" or "0.53 in". */
export function rainAmount(mm: number, units: Units): string {
  return units === 'F' ? `${Math.round((mm / 25.4) * 100) / 100} in` : `${mm} mm`;
}

/** The forecast for any place, in its own time zone, with sunrise and sunset. */
export function placeForecastUrl(lat: number, lon: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=7` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset&hourly=precipitation' +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m'
  );
}

/** "2026-11-11T07:05" → 7.083 (hours, local to the place). */
export function hourOf(iso: string | null | undefined): number | null {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

/** The hour (0–23.99) at a place, from its offset from UTC. */
export function localHour(nowMs: number, utcOffsetSec: number): number {
  const d = new Date(nowMs + utcOffsetSec * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Dawn and dusk are the hour or so around sunrise and sunset. */
export function timeOfDayAt(hour: number, sunrise: number, sunset: number): TimeOfDay {
  if (hour >= sunrise - 0.5 && hour < sunrise + 0.75) return 'dawn';
  if (hour >= sunrise + 0.75 && hour < sunset - 0.75) return 'day';
  if (hour >= sunset - 0.75 && hour < sunset + 0.5) return 'dusk';
  return 'night';
}

export type CitySuggestion = { name: string; country?: string; region?: string; lat: number; lon: number };

/** Open-Meteo's place search answer → a short, tidy list. */
export function parseCities(json: unknown): CitySuggestion[] {
  const list = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r.name === 'string' && typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .slice(0, 8)
    .map((r) => ({
      name: String(r.name),
      ...(typeof r.country === 'string' ? { country: r.country } : {}),
      ...(typeof r.admin1 === 'string' && r.admin1 !== r.name ? { region: r.admin1 } : {}),
      lat: r.latitude as number,
      lon: r.longitude as number,
    }));
}

type SunInfo = { isDay: boolean; sunrise: number | null; sunset: number | null; utcOffsetSec: number | null };

/**
 * Dawn, day, dusk or night at the place right now: from its own sunrise and
 * sunset when we have them, kept consistent with the service's day/night flag.
 */
export function todFor(now: SunInfo | null, fallback: TimeOfDay, nowMs = Date.now()): TimeOfDay {
  if (!now) return fallback;
  const fromSun = now.sunrise !== null && now.sunset !== null && now.utcOffsetSec !== null ? timeOfDayAt(localHour(nowMs, now.utcOffsetSec), now.sunrise, now.sunset) : fallback;
  if (!now.isDay && fromSun === 'day') return 'night';
  if (now.isDay && fromSun === 'night') return 'day';
  return fromSun;
}

export function placeLabel(p: WeatherPlace, areaName: (id: AreaId) => string): string {
  return p.kind === 'area' ? areaName(p.id) : p.name;
}
