/** Trips, shared checklists, travel journal, and the bucket list (Firestore). */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { STOP_LIMITS } from './itinerary-pure';
import { STARTER_ITEMS, type ItemCategory, type WeatherSummary } from './trip-logic';

export type Trip = {
  id: string;
  title: string;
  destination?: string;
  lat?: number;
  lon?: number;
  startDate: string;
  endDate: string;
  weather?: WeatherSummary;
  stress?: Record<string, number>;
  restDays?: string[];
  createdBy: string;
};

export type TripItem = {
  id: string;
  text: string;
  category: ItemCategory;
  done: boolean;
  doneBy?: string;
  suggested?: boolean;
  addedBy: string;
  createdAt: Timestamp | null;
};

export type TripEntry = {
  id: string;
  ownerId: string;
  type: 'photo' | 'video' | 'voice' | 'note';
  mediaId?: string;
  caption?: string;
  mood?: string;
  date: string;
  createdAt: Timestamp | null;
};

export type TripStop = {
  id: string;
  day: string;
  time: string | null;
  title: string;
  place: string | null;
  note: string | null;
  addedBy: string;
  createdAt: Timestamp | null;
};

export type StopInput = { day: string; time: string | null; title: string; place?: string; note?: string };

export type BucketPin = {
  id: string;
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
  note?: string;
  visited: boolean;
  addedBy: string;
};

const tripsCol = (cid: string) => collection(db, 'couples', cid, 'trips');

function useCollection<T>(path: string[] | null, order?: string): { data: T[]; ready: boolean } {
  const [state, setState] = useState<{ key: string; data: T[] } | null>(null);
  const key = path?.join('/') ?? '';
  useEffect(() => {
    if (!path) return;
    const col = collection(db, path[0], ...path.slice(1));
    const q = order ? query(col, orderBy(order)) : col;
    return onSnapshot(
      q,
      (s) => setState({ key, data: s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as T) }),
      () => setState({ key, data: [] }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, order]);
  return { data: state?.key === key ? state.data : [], ready: state?.key === key };
}

export function useTrips(cid: string | null) {
  return useCollection<Trip>(cid ? ['couples', cid, 'trips'] : null, 'startDate');
}

/** One trip. `undefined` while loading (including while the app is still finding your couple, e.g. after a refresh). */
export function useTrip(cid: string | null, id: string | undefined) {
  const [state, setState] = useState<{ key: string; trip: Trip | null } | null>(null);
  const key = cid && id ? `${cid}/${id}` : '';
  useEffect(() => {
    if (!cid || !id) return;
    return onSnapshot(
      doc(db, 'couples', cid, 'trips', id),
      (s) => setState({ key, trip: s.exists() ? ({ id: s.id, ...s.data() } as Trip) : null }),
      () => setState({ key, trip: null }),
    );
  }, [cid, id, key]);
  return state && state.key === key ? state.trip : undefined;
}

// These wait for the couple to be known (null path = not yet).
export function useTripItems(cid: string | null, tripId: string) {
  return useCollection<TripItem>(cid ? ['couples', cid, 'trips', tripId, 'items'] : null, 'createdAt');
}

export function useTripEntries(cid: string | null, tripId: string) {
  return useCollection<TripEntry>(cid ? ['couples', cid, 'trips', tripId, 'entries'] : null, 'createdAt');
}

export function useTripStops(cid: string | null, tripId: string) {
  return useCollection<TripStop>(cid ? ['couples', cid, 'trips', tripId, 'stops'] : null, 'day');
}

function cleanStop(s: StopInput) {
  const opt = (v: string | undefined, max: number) => (v?.trim() ? v.trim().slice(0, max) : null);
  return {
    day: s.day,
    time: s.time,
    title: s.title.trim().slice(0, STOP_LIMITS.title),
    place: opt(s.place, STOP_LIMITS.place),
    note: opt(s.note, STOP_LIMITS.note),
  };
}

export async function addStop(cid: string, tripId: string, uid: string, s: StopInput) {
  await addDoc(collection(db, 'couples', cid, 'trips', tripId, 'stops'), { ...cleanStop(s), addedBy: uid, createdAt: serverTimestamp() });
}

export async function updateStop(cid: string, tripId: string, id: string, s: StopInput) {
  await updateDoc(doc(db, 'couples', cid, 'trips', tripId, 'stops', id), { ...cleanStop(s), updatedAt: serverTimestamp() });
}

export async function removeStop(cid: string, tripId: string, id: string) {
  await deleteDoc(doc(db, 'couples', cid, 'trips', tripId, 'stops', id));
}

export function useBucket(cid: string | null) {
  return useCollection<BucketPin>(cid ? ['couples', cid, 'bucket'] : null, 'name');
}

export async function createTrip(
  cid: string,
  uid: string,
  t: { title: string; destination?: string; lat?: number; lon?: number; startDate: string; endDate: string },
): Promise<string> {
  const ref = doc(tripsCol(cid));
  const data: Record<string, unknown> = {
    title: t.title.trim(),
    startDate: t.startDate,
    endDate: t.endDate,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };
  if (t.destination?.trim()) data.destination = t.destination.trim();
  if (typeof t.lat === 'number' && typeof t.lon === 'number') {
    data.lat = t.lat;
    data.lon = t.lon;
  }
  const batch = writeBatch(db);
  batch.set(ref, data);
  STARTER_ITEMS.forEach((it) =>
    batch.set(doc(collection(ref, 'items')), { ...it, done: false, addedBy: uid, createdAt: serverTimestamp() }),
  );
  await batch.commit();
  return ref.id;
}

export async function updateTrip(cid: string, id: string, patch: Partial<Omit<Trip, 'id' | 'createdBy'>>) {
  await updateDoc(doc(db, 'couples', cid, 'trips', id), { ...patch, updatedAt: serverTimestamp() });
}

export async function setMyTripStress(cid: string, id: string, uid: string, level: number) {
  await updateDoc(doc(db, 'couples', cid, 'trips', id), { [`stress.${uid}`]: level, updatedAt: serverTimestamp() });
}

export async function deleteTrip(cid: string, id: string) {
  await deleteDoc(doc(db, 'couples', cid, 'trips', id));
}

export async function addItem(cid: string, tripId: string, uid: string, text: string, category: ItemCategory, suggested = false) {
  await addDoc(collection(db, 'couples', cid, 'trips', tripId, 'items'), {
    text: text.trim().slice(0, 200),
    category,
    done: false,
    suggested,
    addedBy: uid,
    createdAt: serverTimestamp(),
  });
}

/** Add weather-based packing suggestions, skipping any already on the list. */
export async function addPackingSuggestions(cid: string, tripId: string, uid: string, texts: string[], existing: TripItem[]) {
  const have = new Set(existing.map((i) => i.text.toLowerCase()));
  const batch = writeBatch(db);
  texts
    .filter((t) => !have.has(t.toLowerCase()))
    .forEach((text) =>
      batch.set(doc(collection(db, 'couples', cid, 'trips', tripId, 'items')), {
        text,
        category: 'packing',
        done: false,
        suggested: true,
        addedBy: uid,
        createdAt: serverTimestamp(),
      }),
    );
  await batch.commit();
}

export async function toggleItem(cid: string, tripId: string, item: TripItem, uid: string) {
  await updateDoc(doc(db, 'couples', cid, 'trips', tripId, 'items', item.id), {
    done: !item.done,
    doneBy: !item.done ? uid : '',
  });
}

export async function removeItem(cid: string, tripId: string, itemId: string) {
  await deleteDoc(doc(db, 'couples', cid, 'trips', tripId, 'items', itemId));
}

export async function addNoteEntry(cid: string, tripId: string, uid: string, caption: string, mood: string | undefined, date: string) {
  const data: Record<string, unknown> = { ownerId: uid, type: 'note', caption: caption.trim(), date, createdAt: serverTimestamp() };
  if (mood) data.mood = mood;
  await addDoc(collection(db, 'couples', cid, 'trips', tripId, 'entries'), data);
}

export async function removeEntry(cid: string, tripId: string, entryId: string) {
  await deleteDoc(doc(db, 'couples', cid, 'trips', tripId, 'entries', entryId));
}

export async function addPin(cid: string, uid: string, pin: { name: string; country?: string; lat?: number; lon?: number }) {
  const ref = doc(collection(db, 'couples', cid, 'bucket'));
  const data: Record<string, unknown> = { name: pin.name.trim(), visited: false, addedBy: uid, createdAt: serverTimestamp() };
  if (pin.country) data.country = pin.country;
  if (typeof pin.lat === 'number' && typeof pin.lon === 'number') {
    data.lat = pin.lat;
    data.lon = pin.lon;
  }
  await setDoc(ref, data);
}

export async function togglePin(cid: string, pin: BucketPin) {
  await updateDoc(doc(db, 'couples', cid, 'bucket', pin.id), { visited: !pin.visited });
}

export async function removePin(cid: string, id: string) {
  await deleteDoc(doc(db, 'couples', cid, 'bucket', id));
}
