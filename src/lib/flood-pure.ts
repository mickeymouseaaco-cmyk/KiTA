/**
 * Weather and flood watch for home (Shah Alam and Klang). Pure logic, no network.
 *
 * Three sources, combined:
 * - Open-Meteo: 7-day local forecast with rain amounts (free, no key).
 * - MET Malaysia official weather warnings, via api.data.gov.my.
 * - JPS river water levels, via api.data.gov.my. Only readings from the last
 *   few hours are used; older ones are ignored rather than shown as "live".
 *
 * Our "keep an eye out" level is a gentle guide built from rain amounts. Only
 * MET warnings and river levels at warning/danger count as a flood warning.
 */

export type AreaId = 'shahalam' | 'klang';
export type Area = {
  id: AreaId;
  name: string;
  lat: number;
  lon: number;
  districts: string[];
  keywords: string[];
  /** Searches that open recent public posts on Threads about flooding here. */
  threads: { label: string; query: string }[];
};

export const AREAS: Area[] = [
  {
    id: 'shahalam',
    name: 'i-City, Shah Alam',
    // Forecast centred on i-City (Seksyen 7), a known flash-flood spot.
    lat: 3.0647,
    lon: 101.4847,
    districts: ['petaling', 'shah alam'],
    keywords: ['shah alam', 'petaling', 'i-city'],
    threads: [
      { label: 'Banjir i-City', query: 'banjir i-City' },
      { label: 'i-City flood', query: 'i-City Shah Alam flood' },
      { label: 'Banjir Shah Alam', query: 'banjir Shah Alam' },
    ],
  },
  {
    id: 'klang',
    name: 'Klang',
    lat: 3.0449,
    lon: 101.4456,
    districts: ['klang'],
    keywords: ['klang'],
    threads: [
      { label: 'Banjir Klang', query: 'banjir Klang' },
      { label: 'Klang flood', query: 'Klang flood' },
      { label: 'Jalan ditutup Klang', query: 'jalan ditutup banjir Klang' },
    ],
  },
];

export type FloodLevel = 'calm' | 'watch' | 'warning';

export type ForecastDay = {
  date: string;
  minC: number;
  maxC: number;
  /** Total rain for the day, mm. */
  rainMm: number;
  /** Highest chance of rain in the day, 0–100. */
  rainChance: number;
  /** Heaviest single hour of rain, mm. Flash floods follow short, heavy bursts. */
  maxHourlyMm: number;
  code: number;
};

export type Warning = {
  title: string;
  heading: string;
  text: string;
  instruction: string;
  validFrom: string | null;
  validTo: string | null;
  issued: string | null;
};

export type RiverStation = {
  name: string;
  district: string;
  state: string;
  basin: string;
  levelM: number | null;
  normalM: number | null;
  alertM: number | null;
  warningM: number | null;
  dangerM: number | null;
  trend: string;
  updated: string | null;
};

export type RiverLevel = 'normal' | 'alert' | 'warning' | 'danger' | 'unknown';

// ---------------------------------------------------------------- forecast

export type OpenMeteo = {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
    weather_code: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
  };
  /** The place's offset from UTC (Open-Meteo always sends it). */
  utc_offset_seconds?: number;
  hourly?: { time: string[]; precipitation: (number | null)[] };
  current?: { temperature_2m?: number | null; apparent_temperature?: number | null; weather_code?: number | null; is_day?: number | null; relative_humidity_2m?: number | null; wind_speed_10m?: number | null };
};

/** The weather right now (Open-Meteo "current"). */
export type CurrentWeather = {
  tempC: number;
  feelsC: number | null;
  code: number;
  isDay: boolean;
  humidity: number | null;
  windKmh: number | null;
  /** Local to the place: hours since midnight (e.g. 7.08), and its offset from UTC. */
  sunrise: number | null;
  sunset: number | null;
  utcOffsetSec: number | null;
};

function hourOfIso(iso: string | null | undefined): number | null {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

export function parseCurrent(json: OpenMeteo): CurrentWeather | null {
  const c = json.current;
  if (!c || typeof c.temperature_2m !== 'number') return null;
  const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
  return {
    tempC: Math.round(c.temperature_2m),
    feelsC: n(c.apparent_temperature),
    code: typeof c.weather_code === 'number' ? c.weather_code : 0,
    isDay: c.is_day !== 0,
    humidity: n(c.relative_humidity_2m),
    windKmh: n(c.wind_speed_10m),
    sunrise: hourOfIso(json.daily?.sunrise?.[0]),
    sunset: hourOfIso(json.daily?.sunset?.[0]),
    utcOffsetSec: typeof json.utc_offset_seconds === 'number' ? json.utc_offset_seconds : null,
  };
}

export function forecastUrl(a: Area): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&timezone=Asia%2FKuala_Lumpur&forecast_days=7` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset&hourly=precipitation' +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m'
  );
}

export function parseForecast(json: OpenMeteo): ForecastDay[] {
  const d = json.daily;
  if (!d?.time?.length) return [];
  const maxHour: Record<string, number> = {};
  json.hourly?.time.forEach((t, i) => {
    const day = t.slice(0, 10);
    maxHour[day] = Math.max(maxHour[day] ?? 0, json.hourly!.precipitation[i] ?? 0);
  });
  return d.time.map((date, i) => ({
    date,
    minC: Math.round(d.temperature_2m_min[i] ?? 0),
    maxC: Math.round(d.temperature_2m_max[i] ?? 0),
    rainMm: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
    rainChance: d.precipitation_probability_max[i] ?? 0,
    maxHourlyMm: Math.round((maxHour[date] ?? 0) * 10) / 10,
    code: d.weather_code[i] ?? 0,
  }));
}

/** WMO weather codes in plain words. */
export function weatherWords(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Hazy or foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return code >= 65 ? 'Heavy rain' : 'Rain';
  if (code >= 80 && code <= 82) return code === 82 ? 'Heavy showers' : 'Showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed';
}

/** The sky in one word, for picking an icon or animation. */
export type SkyKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'storm';

export function skyKind(code: number): SkyKind {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 95) return 'storm';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloud';
}

/** How much rain a day brings: a gentle 0–3 scale. */
export function rainRisk(d: Pick<ForecastDay, 'rainMm' | 'maxHourlyMm'>): 0 | 1 | 2 | 3 {
  if (d.maxHourlyMm >= 30 || d.rainMm >= 60) return 3; // intense bursts: flash floods possible in low spots
  if (d.maxHourlyMm >= 15 || d.rainMm >= 30) return 2;
  if (d.rainMm >= 5) return 1;
  return 0;
}

// ---------------------------------------------------------------- MET warnings

type RawWarning = {
  warning_issue?: { issued?: string; title_en?: string; title_bm?: string };
  valid_from?: string | null;
  valid_to?: string | null;
  heading_en?: string;
  text_en?: string;
  instruction_en?: string;
};

export function parseWarnings(rows: RawWarning[]): Warning[] {
  return rows.map((r) => ({
    title: r.warning_issue?.title_en || r.warning_issue?.title_bm || 'Weather warning',
    heading: r.heading_en ?? '',
    text: r.text_en ?? '',
    instruction: r.instruction_en ?? '',
    validFrom: r.valid_from ?? null,
    validTo: r.valid_to ?? null,
    issued: r.warning_issue?.issued ?? null,
  }));
}

/** MET times have no zone; they're Malaysia time (UTC+8). */
export function myTime(s: string | null): number | null {
  if (!s) return null;
  const iso = s.trim().replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}+08:00`;
  const t = Date.parse(withZone);
  return Number.isNaN(t) ? null : t;
}

export function isActive(w: Pick<Warning, 'validFrom' | 'validTo' | 'issued'>, now: number): boolean {
  const to = myTime(w.validTo);
  if (to !== null) return to >= now;
  // No end time: treat as current for 12 hours after it was issued.
  const from = myTime(w.validFrom) ?? myTime(w.issued);
  return from !== null && now - from < 12 * 3600_000;
}

/** Active warnings that mention this area, or Selangor as a whole. */
export function warningsFor(a: Area, all: Warning[], now: number): { local: Warning[]; state: Warning[] } {
  const local: Warning[] = [];
  const state: Warning[] = [];
  for (const w of all) {
    if (!isActive(w, now)) continue;
    const body = `${w.title} ${w.heading} ${w.text}`.toLowerCase();
    if (a.keywords.some((k) => body.includes(k))) local.push(w);
    else if (body.includes('selangor')) state.push(w);
  }
  return { local, state };
}

/** An official warning in a few words, with an icon kind and how serious it is. */
export type WarningKind = 'storm' | 'rain' | 'wind' | 'cyclone' | 'flood' | 'other';
export type WarningLevel = 'advisory' | 'alert' | 'severe' | 'danger';
export type WarningBrief = { kind: WarningKind; label: string; level: WarningLevel; untilMs: number | null };

export const WARNING_LEVEL_LABEL: Record<WarningLevel, string> = { advisory: 'Heads-up', alert: 'Alert', severe: 'Severe', danger: 'Danger' };

export function warningBrief(w: Pick<Warning, 'title' | 'heading' | 'validTo'>): WarningBrief {
  const s = `${w.title} ${w.heading}`.toLowerCase();
  const kind: WarningKind = /cyclone|siklon|tropical storm/.test(s)
    ? 'cyclone'
    : /thunder|ribut petir/.test(s)
      ? 'storm'
      : /flood|banjir/.test(s)
        ? 'flood'
        : /continuous rain|heavy rain|hujan/.test(s)
          ? 'rain'
          : /wind|sea|angin|laut/.test(s)
            ? 'wind'
            : 'other';
  const label = {
    cyclone: 'Tropical storm',
    storm: 'Thunderstorms',
    flood: 'Flood',
    rain: 'Non-stop rain',
    wind: 'Strong wind & rough seas',
    other: 'Bad weather',
  }[kind];
  const level: WarningLevel = /danger|bahaya/.test(s) ? 'danger' : /severe|buruk/.test(s) ? 'severe' : /alert|waspada/.test(s) ? 'alert' : 'advisory';
  return { kind, label, level, untilMs: myTime(w.validTo) };
}

// ---------------------------------------------------------------- JPS rivers

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseStations(rows: Record<string, unknown>[]): RiverStation[] {
  return rows.map((r) => ({
    name: String(r.station_name ?? 'River station'),
    district: String(r.district ?? ''),
    state: String(r.state ?? ''),
    basin: String(r.main_basin ?? r.sub_basin ?? ''),
    levelM: num(r.water_level_current),
    normalM: num(r.water_level_normal_level),
    alertM: num(r.water_level_alert_level),
    warningM: num(r.water_level_warning_level),
    dangerM: num(r.water_level_danger_level),
    trend: String(r.water_level_trend ?? ''),
    updated: (r.water_level_update_datetime as string | undefined) ?? null,
  }));
}

/** Compare the reading with the station's own thresholds. */
export function riverLevel(s: RiverStation): RiverLevel {
  if (s.levelM === null) return 'unknown';
  if (s.dangerM !== null && s.levelM >= s.dangerM) return 'danger';
  if (s.warningM !== null && s.levelM >= s.warningM) return 'warning';
  if (s.alertM !== null && s.levelM >= s.alertM) return 'alert';
  return s.normalM !== null || s.alertM !== null ? 'normal' : 'unknown';
}

export const FRESH_HOURS = 6;

export function isFresh(s: Pick<RiverStation, 'updated'>, now: number): boolean {
  const t = myTime(s.updated);
  return t !== null && now - t <= FRESH_HOURS * 3600_000 && t - now < 3600_000;
}

/** Fresh readings from this area's districts, most worrying first. */
export function stationsFor(a: Area, all: RiverStation[], now: number): RiverStation[] {
  const rank: Record<RiverLevel, number> = { danger: 0, warning: 1, alert: 2, normal: 3, unknown: 4 };
  return all
    .filter((s) => s.state.toLowerCase().includes('selangor') && a.districts.some((d) => s.district.toLowerCase().includes(d)) && isFresh(s, now))
    .sort((x, y) => rank[riverLevel(x)] - rank[riverLevel(y)]);
}

// ---------------------------------------------------------------- status

export type FloodStatus = { level: FloodLevel; headline: string; reasons: string[] };

export function floodStatus(
  a: Area,
  input: { days: ForecastDay[]; warnings: Warning[]; stations: RiverStation[] },
  now: number,
): FloodStatus {
  const reasons: string[] = [];
  const { local, state } = warningsFor(a, input.warnings, now);
  const rivers = stationsFor(a, input.stations, now);
  const high = rivers.filter((s) => ['warning', 'danger'].includes(riverLevel(s)));
  const alert = rivers.filter((s) => riverLevel(s) === 'alert');
  const next2 = input.days.slice(0, 2);
  const heavy = next2.filter((d) => rainRisk(d) === 3);
  const wet = next2.filter((d) => rainRisk(d) === 2);

  for (const w of local) reasons.push(`MET Malaysia: ${w.title}`);
  for (const s of high) reasons.push(`${s.name} river is at ${riverLevel(s)} level`);
  if (local.length || high.length) {
    return { level: 'warning', headline: `Flood warning near ${a.name}. Please stay safe and check on each other.`, reasons };
  }

  for (const s of alert) reasons.push(`${s.name} river is above its alert level`);
  for (const w of state) reasons.push(`MET Malaysia warning for Selangor: ${w.title}`);
  if (heavy.length) reasons.push(`Very heavy rain possible ${heavy[0] === input.days[0] ? 'today' : 'tomorrow'} (up to ${Math.max(...heavy.map((d) => d.maxHourlyMm))} mm in an hour)`);
  if (alert.length || state.length || heavy.length) {
    return { level: 'watch', headline: `Keep an eye out in ${a.name}. Low roads can flood quickly in heavy rain.`, reasons };
  }

  if (wet.length) reasons.push(`Heavy showers likely ${wet[0] === input.days[0] ? 'today' : 'tomorrow'}`);
  return {
    level: 'calm',
    headline: wet.length ? `Rainy, but no flood warnings for ${a.name}. Maybe take an umbrella.` : `All calm in ${a.name}. No flood warnings right now.`,
    reasons,
  };
}

export const LEVEL_LABEL: Record<FloodLevel, string> = { calm: 'All calm', watch: 'Keep an eye out', warning: 'Flood warning' };

export function worst(levels: FloodLevel[]): FloodLevel {
  return levels.includes('warning') ? 'warning' : levels.includes('watch') ? 'watch' : 'calm';
}

/** Practical, calm steps for each level. */
export const SAFETY_TIPS: Record<FloodLevel, string[]> = {
  calm: ['Keep a small bag ready in rainy season: IC, phone charger, medicine, a torch.', 'Know which roads near you flood first, and another way home.'],
  watch: [
    'Charge your phones and a power bank.',
    'Park your car on higher ground if your street floods easily.',
    'Keep important documents in a waterproof bag, up high.',
    'Avoid underpasses and low roads during heavy rain.',
  ],
  warning: [
    'If water is rising, move to higher ground now. Don’t wait.',
    'Never walk or drive through flood water. 15 cm can knock you over; 60 cm can float a car.',
    'Switch off electricity at the main switch if water may enter the house.',
    'Call 999 in an emergency.',
  ],
};

/** A Threads web search link. On phones with Threads installed it opens in the app. */
export function threadsSearchUrl(query: string): string {
  return `https://www.threads.com/search?q=${encodeURIComponent(query)}&serp_type=default`;
}

export const SOURCE_LINKS = {
  jps: 'https://publicinfobanjir.water.gov.my/',
  met: 'https://www.met.gov.my/',
};
