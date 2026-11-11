/**
 * Flight tracking: the words and maths the Flight screen shows. Pure (no
 * network), so it's easy to test. The lookup itself runs on the server
 * (functions/src/index.ts → trackFlight).
 */
import { distanceM } from './location-pure';

export type FlightPosition = {
  callsign: string;
  lat: number;
  lon: number;
  altFt: number | null;
  onGround: boolean;
  speedKts: number | null;
  heading: number | null;
  climbFpm: number | null;
  seenSec: number;
  reg: string | null;
  type: string | null;
  typeName: string | null;
};
export type Airport = { code: string; city: string; name: string; lat: number | null; lon: number | null };
export type FlightRoute = { airline: string | null; callsign: string | null; from: Airport | null; to: Airport | null };
export type FlightAnswer = { flight: string; found: boolean; position: FlightPosition | null; route: FlightRoute | null; source: string | null; at: number };

/** "mh 2520" → "MH2520". null when it can't be a flight number. */
export function cleanFlightNo(raw: string): string | null {
  const f = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{3,8}$/.test(f) && /\d/.test(f) && /[A-Z]/.test(f) ? f : null;
}

/** "MH2520" → "MH 2520" for showing. */
export function prettyFlightNo(f: string): string {
  const m = /^([A-Z]{3}|[A-Z0-9]{2})(\d.*)$/.exec(f);
  return m ? `${m[1]} ${m[2]}` : f;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export function compass(deg: number): string {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export const ktsToKmh = (kts: number) => Math.round(kts * 1.852);
export const ftToM = (ft: number) => Math.round(ft * 0.3048);

/** "Climbing", "Descending", "Level", or "On the ground". */
export function phaseWord(p: Pick<FlightPosition, 'onGround' | 'climbFpm' | 'altFt' | 'speedKts'>): string {
  if (p.onGround) return (p.speedKts ?? 0) > 40 ? 'On the runway' : 'On the ground';
  if ((p.climbFpm ?? 0) > 400) return 'Climbing';
  if ((p.climbFpm ?? 0) < -400) return 'Descending';
  return 'Cruising';
}

export type Progress = { fraction: number; remainingKm: number; etaMin: number | null };

/** How far along the usual route the plane is, and a rough time to landing. */
export function routeProgress(route: FlightRoute | null, p: FlightPosition | null): Progress | null {
  const a = route?.from;
  const b = route?.to;
  if (!p || !a || !b || a.lat === null || a.lon === null || b.lat === null || b.lon === null) return null;
  const from = { lat: a.lat, lng: a.lon };
  const to = { lat: b.lat, lng: b.lon };
  const here = { lat: p.lat, lng: p.lon };
  const total = distanceM(from, to);
  const left = distanceM(here, to);
  const done = distanceM(from, here);
  if (total < 20_000) return null;
  // Far off the line between the two airports: this callsign is flying something else today.
  if (done + left > total * 1.6 + 150_000) return null;
  const fraction = Math.max(0, Math.min(1, done / (done + left)));
  const remainingKm = Math.round(left / 1000);
  // Planes slow down to land, so add a little for the approach.
  const speedKmh = p.speedKts && p.speedKts > 80 ? p.speedKts * 1.852 : null;
  const etaMin = p.onGround || !speedKmh ? null : Math.max(1, Math.round((remainingKm / speedKmh) * 60 + 8));
  return { fraction, remainingKm, etaMin };
}

export function etaWords(min: number): string {
  if (min < 60) return `about ${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return m ? `about ${h} h ${m} min` : `about ${h} h`;
}

/** The same flight on Flightradar24: the live plane when we know its callsign, else the flight's page. */
export function fr24Url(flight: string, callsign?: string | null): string {
  return callsign ? `https://www.flightradar24.com/${encodeURIComponent(callsign)}` : `https://www.flightradar24.com/data/flights/${encodeURIComponent(flight.toLowerCase())}`;
}

/** How wide a map to show: closer in near the ground, wider at cruise. Degrees of longitude either side. */
export function mapSpan(p: Pick<FlightPosition, 'altFt' | 'onGround'>): number {
  if (p.onGround) return 0.03;
  const alt = p.altFt ?? 30000;
  return alt < 5000 ? 0.12 : alt < 15000 ? 0.4 : 1.2;
}
