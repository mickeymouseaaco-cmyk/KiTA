/**
 * Flight tracking: turning what someone types ("MH 2520") into the callsign a
 * plane actually broadcasts ("MAS2520"), and tidying the live position that
 * comes back. Pure (no network), so it's easy to test.
 */

/** Airline ticket codes (IATA) → radio callsign codes (ICAO). The ones we fly most, plus the big ones. */
export const AIRLINES: Readonly<Record<string, string>> = {
  // Malaysia and neighbours
  MH: 'MAS', AK: 'AXM', D7: 'XAX', OD: 'MXD', FY: 'FFM', SQ: 'SIA', TR: 'TGW', '3K': 'JSA', BI: 'RBA',
  QZ: 'AWQ', GA: 'GIA', ID: 'BTK', JT: 'LNI', QG: 'CTV', IW: 'WON', SJ: 'SJY',
  TG: 'THA', FD: 'AIQ', XJ: 'TAX', SL: 'TLM', DD: 'NOK', PG: 'BKP', VZ: 'TVJ',
  VN: 'HVN', VJ: 'VJC', QH: 'BAV', PR: 'PAL', '5J': 'CEB', Z2: 'APG',
  // East Asia
  CX: 'CPA', HX: 'CRK', UO: 'HKE', BR: 'EVA', CI: 'CAL', JL: 'JAL', NH: 'ANA', MM: 'APJ',
  KE: 'KAL', OZ: 'AAR', '7C': 'JJA', TW: 'TWB', LJ: 'JNA', BX: 'ABL', CZ: 'CSN', MU: 'CES', CA: 'CCA', MF: 'CXA',
  // South Asia and the Gulf
  AI: 'AIC', '6E': 'IGO', IX: 'AXB', UL: 'ALK', EK: 'UAE', QR: 'QTR', EY: 'ETD', FZ: 'FDB', G9: 'ABY',
  SV: 'SVA', WY: 'OMA', GF: 'GFA', KU: 'KAC', TK: 'THY',
  // Further away
  QF: 'QFA', JQ: 'JST', NZ: 'ANZ', BA: 'BAW', LH: 'DLH', AF: 'AFR', KL: 'KLM', LX: 'SWR', AY: 'FIN', SK: 'SAS',
  IB: 'IBE', AZ: 'ITY', OS: 'AUA', TP: 'TAP', ET: 'ETH', UA: 'UAL', AA: 'AAL', DL: 'DAL', AC: 'ACA',
};

export type FlightQuery = {
  /** What was typed, tidied: "MH2520". */
  flight: string;
  /** Callsigns to look for, best guess first: ["MAS2520", "MH2520"]. */
  callsigns: string[];
};

/** "mh 2520", "MH-2520", "MAS2520" → what to look for. null when it isn't a flight number. */
export function normalizeFlight(raw: string): FlightQuery | null {
  const flight = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{3,8}$/.test(flight) || !/\d/.test(flight)) return null;
  // Already a radio callsign: three letters then the number.
  if (/^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(flight)) return { flight, callsigns: [flight] };
  // A ticket flight number: two-character airline code, then the number.
  const m = /^([A-Z][A-Z0-9]|[0-9][A-Z])(\d{1,4}[A-Z]?)$/.exec(flight);
  if (!m) return { flight, callsigns: [flight] };
  const num = m[2].replace(/^0+(?=\d)/, '');
  const icao = AIRLINES[m[1]];
  const callsigns = [...(icao ? [icao + num] : []), m[1] + num];
  if (!callsigns.includes(flight)) callsigns.push(flight);
  return { flight, callsigns };
}

/** One aircraft as the open ADS-B services report it (readsb "v2" format). */
export type RawAircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  seen?: number;
  seen_pos?: number;
};

export type FlightPosition = {
  callsign: string;
  lat: number;
  lon: number;
  /** Feet; null when unknown. */
  altFt: number | null;
  onGround: boolean;
  /** Knots over the ground. */
  speedKts: number | null;
  /** Degrees, 0 = north. */
  heading: number | null;
  /** Feet per minute; positive = climbing. */
  climbFpm: number | null;
  /** Seconds since this position was heard. */
  seenSec: number;
  reg: string | null;
  type: string | null;
  typeName: string | null;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The aircraft flying one of our callsigns (best guess first), if it has a position. */
export function pickAircraft(list: readonly RawAircraft[], callsigns: readonly string[]): RawAircraft | null {
  const withPos = list.filter((a) => num(a.lat) !== null && num(a.lon) !== null);
  for (const cs of callsigns) {
    const hit = withPos.filter((a) => (a.flight ?? '').trim().toUpperCase() === cs).sort((a, b) => (a.seen_pos ?? 0) - (b.seen_pos ?? 0))[0];
    if (hit) return hit;
  }
  return null;
}

export function toPosition(a: RawAircraft): FlightPosition {
  const onGround = a.alt_baro === 'ground';
  const alt = onGround ? 0 : (num(a.alt_baro) ?? num(a.alt_geom));
  const heading = num(a.track) ?? num(a.true_heading);
  return {
    callsign: (a.flight ?? '').trim().toUpperCase(),
    lat: Math.round((a.lat as number) * 1e4) / 1e4,
    lon: Math.round((a.lon as number) * 1e4) / 1e4,
    altFt: alt === null ? null : Math.round(alt),
    onGround,
    speedKts: num(a.gs) === null ? null : Math.round(a.gs as number),
    heading: heading === null ? null : Math.round(heading),
    climbFpm: num(a.baro_rate) ?? num(a.geom_rate),
    seenSec: Math.max(0, Math.round(num(a.seen_pos) ?? num(a.seen) ?? 0)),
    reg: a.r?.trim() || null,
    type: a.t?.trim() || null,
    typeName: a.desc?.trim() || null,
  };
}

export type Airport = { code: string; city: string; name: string; lat: number | null; lon: number | null };
export type FlightRoute = { airline: string | null; callsign: string | null; from: Airport | null; to: Airport | null };

/** The usual route for a callsign, from adsbdb.com's answer. null when it doesn't know. */
export function toRoute(json: unknown): FlightRoute | null {
  const fr = (json as { response?: { flightroute?: Record<string, unknown> } } | null)?.response?.flightroute;
  if (!fr || typeof fr !== 'object') return null;
  const airport = (v: unknown): Airport | null => {
    const a = v as Record<string, unknown> | null;
    if (!a || typeof a !== 'object') return null;
    const code = String(a.iata_code || a.icao_code || '').slice(0, 4);
    if (!code) return null;
    return { code, city: String(a.municipality || '').slice(0, 60), name: String(a.name || '').slice(0, 80), lat: num(a.latitude), lon: num(a.longitude) };
  };
  const from = airport(fr.origin);
  const to = airport(fr.destination);
  if (!from && !to) return null;
  const airline = (fr.airline as { name?: unknown } | null)?.name;
  const cs = typeof fr.callsign_icao === 'string' ? fr.callsign_icao : typeof fr.callsign === 'string' ? fr.callsign : null;
  return { airline: typeof airline === 'string' ? airline.slice(0, 60) : null, callsign: cs ? cs.toUpperCase().slice(0, 8) : null, from, to };
}
