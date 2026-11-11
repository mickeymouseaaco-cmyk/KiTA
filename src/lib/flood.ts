/**
 * Live weather and flood watch for Shah Alam and Klang. Every source can fail
 * (offline, an API is down), so each is fetched on its own and the screen
 * shows whatever arrived, with a gentle note and the official links.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  AREAS,
  floodStatus,
  forecastUrl,
  parseCurrent,
  parseForecast,
  parseStations,
  parseWarnings,
  type AreaId,
  type FloodStatus,
  type CurrentWeather,
  type ForecastDay,
  type OpenMeteo,
  type RiverStation,
  type Warning,
} from './flood-pure';

export * from './flood-pure';

const DATA_GOV = 'https://api.data.gov.my';
const CACHE_MS = 15 * 60_000;

async function getJson<T>(url: string, ms = 12_000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** "YYYY-MM-DD 00:00:00" in Malaysia time, some days back (for the warnings filter). */
export function sinceMY(daysBack: number, now = Date.now()): string {
  const d = new Date(now + 8 * 3600_000 - daysBack * 86_400_000);
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
}

/** data.gov.my answers with a plain array, or { data: [...] } when meta is on. */
const rowsOf = <T,>(json: unknown): T[] => (Array.isArray(json) ? json : ((json as { data?: T[] })?.data ?? [])) as T[];

export type FloodData = {
  fetchedAt: number;
  forecast: Partial<Record<AreaId, ForecastDay[]>>;
  /** The weather right now, per area (when the forecast service sent it). */
  now?: Partial<Record<AreaId, CurrentWeather | null>>;
  warnings: Warning[];
  stations: RiverStation[];
  /** Which sources answered. */
  ok: { forecast: boolean; warnings: boolean; rivers: boolean };
};

let cache: FloodData | null = null;
let inflight: Promise<FloodData> | null = null;

export async function loadFloodData(force = false): Promise<FloodData> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [fc, warn, rivers] = await Promise.allSettled([
      Promise.all(AREAS.map(async (a) => [a.id, await getJson<OpenMeteo>(forecastUrl(a))] as const)),
      getJson(`${DATA_GOV}/weather/warning?limit=50&timestamp_start=${encodeURIComponent(sinceMY(3))}@warning_issue__issued`).then((j) => parseWarnings(rowsOf(j))),
      getJson(`${DATA_GOV}/flood-warning?filter=Selangor@state&limit=300`).then((j) => parseStations(rowsOf(j))),
    ]);
    const data: FloodData = {
      fetchedAt: Date.now(),
      forecast: fc.status === 'fulfilled' ? Object.fromEntries(fc.value.map(([id, j]) => [id, parseForecast(j)])) : {},
      now: fc.status === 'fulfilled' ? Object.fromEntries(fc.value.map(([id, j]) => [id, parseCurrent(j)])) : {},
      warnings: warn.status === 'fulfilled' ? warn.value : [],
      stations: rivers.status === 'fulfilled' ? rivers.value : [],
      ok: { forecast: fc.status === 'fulfilled', warnings: warn.status === 'fulfilled', rivers: rivers.status === 'fulfilled' },
    };
    cache = data;
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useFloodWatch() {
  const [data, setData] = useState<FloodData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async (force = true) => {
    setLoading(true);
    try {
      setData(await loadFloodData(force));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadFloodData()
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    const t = setInterval(() => {
      loadFloodData(true).then((d) => alive && setData(d));
    }, 30 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Judged at the time the data was fetched, so rendering stays pure.
  const status = Object.fromEntries(
    AREAS.map((a) => [a.id, data ? floodStatus(a, { days: data.forecast[a.id] ?? [], warnings: data.warnings, stations: data.stations }, data.fetchedAt) : null]),
  ) as Record<AreaId, FloodStatus | null>;

  return { data, status, loading, refresh };
}
