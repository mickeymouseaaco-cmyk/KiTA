/**
 * Weather for anywhere: the place each person follows (kept on this phone),
 * °C or °F, finding "near me", searching cities, and the forecast for any place.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { parseCurrent, parseForecast, type CurrentWeather, type ForecastDay, type OpenMeteo } from './flood-pure';
import { currentPosition } from './location';
import { cleanPlace, defaultPlace, parseCities, placeForecastUrl, unitsFor, type CitySuggestion, type Units, type WeatherPlace } from './place-pure';

export * from './place-pure';

const PLACE_KEY = 'kita.weatherPlace';
const UNITS_KEY = 'kita.units';

// ------------------------------------------------------- tiny shared stores

function store<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(v: T) {
      value = v;
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

const deviceTimeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
})();
const deviceLocale = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
})();

/** undefined until this phone's saved choice has been read. */
const placeStore = store<WeatherPlace | null | undefined>(undefined);
const unitsStore = store<Units>(unitsFor(deviceLocale));

AsyncStorage.multiGet([PLACE_KEY, UNITS_KEY])
  .then(([[, place], [, units]]) => {
    placeStore.set(place ? (cleanPlace(JSON.parse(place)) ?? defaultPlace(deviceTimeZone)) : defaultPlace(deviceTimeZone));
    if (units === 'C' || units === 'F') unitsStore.set(units);
  })
  .catch(() => placeStore.set(defaultPlace(deviceTimeZone)));

export function useWeatherPlace(): [WeatherPlace | null | undefined, (p: WeatherPlace) => void] {
  const place = useSyncExternalStore(placeStore.subscribe, placeStore.get, placeStore.get);
  const set = useCallback((p: WeatherPlace) => {
    placeStore.set(p);
    AsyncStorage.setItem(PLACE_KEY, JSON.stringify(p)).catch(() => {});
  }, []);
  return [place, set];
}

export function useUnits(): [Units, (u: Units) => void] {
  const units = useSyncExternalStore(unitsStore.subscribe, unitsStore.get, unitsStore.get);
  const set = useCallback((u: Units) => {
    unitsStore.set(u);
    AsyncStorage.setItem(UNITS_KEY, u).catch(() => {});
  }, []);
  return [units, set];
}

// ---------------------------------------------------------- finding places

/** "Near me": asks for location once, then names the town (OpenStreetMap). */
export async function locateMe(): Promise<WeatherPlace> {
  const fix = await currentPosition();
  let name = 'Near you';
  let country: string | undefined;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${fix.lat}&lon=${fix.lng}`);
    if (res.ok) {
      const j = (await res.json()) as { name?: string; address?: Record<string, string> };
      const a = j.address ?? {};
      name = a.city || a.town || a.village || a.municipality || a.county || j.name || a.state || name;
      country = a.country;
    }
  } catch {
    // The weather still works without a name.
  }
  return cleanPlace({ kind: 'here', name, country, lat: fix.lat, lon: fix.lng })!;
}

export async function searchCities(q: string): Promise<CitySuggestion[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=${encodeURIComponent(q.trim())}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCities(await res.json());
}

// ------------------------------------------------- the forecast anywhere

export type PlaceWeather = { days: ForecastDay[]; now: CurrentWeather | null; fetchedAt: number };

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, PlaceWeather>();

async function loadPlace(lat: number, lon: number, force: boolean): Promise<PlaceWeather> {
  const key = `${lat},${lon}`;
  const kept = cache.get(key);
  if (!force && kept && Date.now() - kept.fetchedAt < CACHE_MS) return kept;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(placeForecastUrl(lat, lon), { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as OpenMeteo;
    const data = { days: parseForecast(json), now: parseCurrent(json), fetchedAt: Date.now() };
    cache.set(key, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** The weather at a place anywhere (not used for the Malaysian flood-watch areas). */
export function usePlaceWeather(place: WeatherPlace | null | undefined) {
  const coords = place && place.kind !== 'area' ? { lat: place.lat, lon: place.lon } : null;
  const key = coords ? `${coords.lat},${coords.lon}` : '';
  const [state, setState] = useState<{ key: string; data: PlaceWeather | null; failed: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!coords) return;
    let alive = true;
    loadPlace(coords.lat, coords.lon, tick > 0)
      .then((data) => alive && setState({ key, data, failed: false }))
      .catch(() => alive && setState((s) => ({ key, data: s?.key === key ? s.data : null, failed: true })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  const mine = state && state.key === key ? state : null;
  return { data: mine?.data ?? null, failed: !!mine?.failed, loading: !!coords && !mine, refresh: () => setTick((n) => n + 1) };
}
