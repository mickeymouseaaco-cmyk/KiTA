/**
 * Flight tracking: asking the server where a flight is (it reads free,
 * community-run live aircraft data), and the flights saved on a trip.
 */
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { db, functions } from './firebase';
import type { FlightAnswer } from './flight-pure';

export * from './flight-pure';

export const FLIGHT_REFRESH_MS = 20_000;

export async function trackFlight(flight: string): Promise<FlightAnswer> {
  const res = await httpsCallable<{ flight: string }, FlightAnswer>(functions, 'trackFlight')({ flight });
  return res.data;
}

export type FlightWatch = {
  /** undefined while the first answer is on its way. */
  answer: FlightAnswer | undefined;
  /** The last check failed (we keep showing the last good answer). */
  failed: boolean;
  refresh: () => void;
};

/** Follows a flight while the screen is open: checks now, then every 20 seconds. */
export function useFlightWatch(flight: string | null): FlightWatch {
  const [state, setState] = useState<{ flight: string; answer?: FlightAnswer; failed: boolean } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!flight) return;
    let alive = true;
    const check = () => {
      if (AppState.currentState !== 'active') return;
      trackFlight(flight)
        .then((answer) => alive && setState({ flight, answer, failed: false }))
        .catch(() => alive && setState((s) => ({ flight, answer: s?.flight === flight ? s.answer : undefined, failed: true })));
    };
    check();
    const timer = setInterval(check, FLIGHT_REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [flight, tick]);

  const mine = state && state.flight === flight ? state : null;
  return { answer: mine?.answer, failed: !!mine?.failed, refresh: () => setTick((n) => n + 1) };
}

// ------------------------------------------------- flights saved on a trip

export type TripFlight = { id: string; flight: string; label: string | null; addedBy: string; createdAt: Timestamp | null };

const flightsCol = (cid: string, tripId: string) => collection(db, 'couples', cid, 'trips', tripId, 'flights');

export function useTripFlights(cid: string | null, tripId: string): TripFlight[] {
  const [state, setState] = useState<{ key: string; list: TripFlight[] } | null>(null);
  const key = cid ? `${cid}/${tripId}` : '';
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      query(flightsCol(cid, tripId), orderBy('createdAt')),
      (s) => setState({ key, list: s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as TripFlight) }),
      () => setState({ key, list: [] }),
    );
  }, [cid, tripId, key]);
  return state && state.key === key ? state.list : [];
}

export async function addTripFlight(cid: string, tripId: string, uid: string, flight: string, label: string) {
  await addDoc(flightsCol(cid, tripId), { flight, label: label.trim().slice(0, 60) || null, addedBy: uid, createdAt: serverTimestamp() });
}

export async function removeTripFlight(cid: string, tripId: string, id: string) {
  await deleteDoc(doc(db, 'couples', cid, 'trips', tripId, 'flights', id));
}
