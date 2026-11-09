/**
 * Place search and weather from Open-Meteo (free, no API key, no account).
 * Every call can fail (offline, abroad), so callers always have a manual
 * fallback: "What weather are you expecting?"
 */
import { dayKey, fromDayKey } from './dates';
import { daysBetween, type WeatherSummary } from './trip-logic';

export type Place = { name: string; country?: string; lat: number; lon: number };

export async function findPlace(q: string): Promise<Place | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(q.trim())}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
  const r = json.results?.[0];
  return r ? { name: r.name, country: r.country, lat: r.latitude, lon: r.longitude } : null;
}

type Daily = { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum?: number[]; precipitation_probability_max?: number[] };

function summarize(d: Daily, source: WeatherSummary['source'], days: number): WeatherSummary {
  const max = d.temperature_2m_max.filter((x) => x !== null);
  const min = d.temperature_2m_min.filter((x) => x !== null);
  const rain = d.precipitation_probability_max
    ? d.precipitation_probability_max.filter((p) => p >= 50).length
    : (d.precipitation_sum ?? []).filter((p) => p >= 2).length;
  return {
    minC: Math.min(...min),
    maxC: Math.max(...max),
    rainyDays: rain,
    days,
    source,
  };
}

/**
 * Weather for the trip dates: the real forecast when the trip is within ~2
 * weeks, otherwise the same dates last year as a gentle guide.
 */
export async function tripWeather(lat: number, lon: number, start: string, end: string, today = dayKey()): Promise<WeatherSummary | null> {
  const days = Math.max(1, daysBetween(start, end) + 1);
  const ahead = daysBetween(today, start);
  if (ahead >= 0 && daysBetween(today, end) <= 15) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    if (res.ok) return summarize(((await res.json()) as { daily: Daily }).daily, 'forecast', days);
  }
  const lastYear = (k: string) => {
    const d = fromDayKey(k);
    d.setFullYear(d.getFullYear() - 1);
    return dayKey(d);
  };
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&timezone=auto` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&start_date=${lastYear(start)}&end_date=${lastYear(end)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return summarize(((await res.json()) as { daily: Daily }).daily, 'last-year', days);
}
