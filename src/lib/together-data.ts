/**
 * Milestones, scheduled & surprise notes, the shared plant, and care days.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { dayKey, lastNDays } from './dates';
import { db } from './firebase';
import { deleteMedia } from './media';
import type { Media, MessageKind } from './types';
import { coupleStreak, plantStage, type PlantStage } from './together-data-pure';

export { coupleStreak, plantStage, type PlantStage };

// ------------------------------------------------------------- milestones

export type Milestone = {
  id: string;
  title: string;
  kind: 'anniversary' | 'birthday' | 'first-trip' | 'other';
  date: string;
  yearly: boolean;
  personUid?: string;
  createdBy: string;
};

export function useMilestones(cid: string | null) {
  const [state, setState] = useState<{ cid: string; data: Milestone[] } | null>(null);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      query(collection(db, 'couples', cid, 'milestones'), orderBy('date')),
      (s) => setState({ cid, data: s.docs.map((d) => ({ id: d.id, ...d.data() }) as Milestone) }),
      () => setState({ cid, data: [] }),
    );
  }, [cid]);
  return { data: state?.cid === cid ? state.data : [], ready: state?.cid === cid };
}

// --------------------------------------------------- scheduled & surprises

export type ScheduledNote = {
  id: string;
  fromUid: string;
  toUid: string;
  kind: Extract<MessageKind, 'text' | 'photo' | 'voice' | 'video'>;
  text?: string;
  mediaId?: string;
  /** 'none' = a scheduled send; 'date' = surprise that unlocks on a date; 'open' = unlocks next time they open the app */
  surprise: 'none' | 'date' | 'open';
  deliverAt: Timestamp;
  favoriteBy: string[];
  openedAt?: Timestamp;
  createdAt: Timestamp | null;
};

type Who = { uid: string; cid: string; partnerId: string };

export async function scheduleText(who: Who, text: string, deliverAtMs: number, surprise: ScheduledNote['surprise']) {
  await setDoc(doc(collection(db, 'couples', who.cid, 'scheduled')), {
    fromUid: who.uid,
    toUid: who.partnerId,
    kind: 'text',
    text: text.trim().slice(0, 2000),
    surprise,
    deliverAt: Timestamp.fromMillis(deliverAtMs),
    favoriteBy: [],
    createdAt: serverTimestamp(),
  });
}

/** Notes I've scheduled (both waiting and delivered). */
export function useMyScheduled(cid: string | null, uid: string | null) {
  const [items, setItems] = useState<ScheduledNote[]>([]);
  useEffect(() => {
    if (!cid || !uid) return;
    return onSnapshot(
      query(collection(db, 'couples', cid, 'scheduled'), where('fromUid', '==', uid)),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as ScheduledNote)),
      () => setItems([]),
    );
  }, [cid, uid]);
  return items;
}

/**
 * Notes delivered to me. The rules hide anything whose time hasn't come, so
 * the query asks only for notes due a little before now (allowing for clock
 * differences) and refreshes every minute.
 */
export function useDeliveredToMe(cid: string | null, uid: string | null) {
  const [items, setItems] = useState<ScheduledNote[]>([]);
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 15_000));
  // Starts at 20s; doubles (up to 10 min) if this phone's clock runs ahead of the server's.
  const [marginMs, setMarginMs] = useState(20_000);
  useEffect(() => {
    const id = setInterval(() => setTick(Math.floor(Date.now() / 15_000)), 15_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!cid || !uid) return;
    const cutoff = Timestamp.fromMillis(tick * 15_000 - marginMs);
    return onSnapshot(
      query(collection(db, 'couples', cid, 'scheduled'), where('toUid', '==', uid), where('deliverAt', '<=', cutoff)),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }) as ScheduledNote)),
      () => setMarginMs((m) => Math.min(m * 2, 600_000)),
    );
  }, [cid, uid, tick, marginMs]);
  return items;
}

export async function openSurprise(cid: string, id: string) {
  await updateDoc(doc(db, 'couples', cid, 'scheduled', id), { openedAt: serverTimestamp() });
}

export async function toggleScheduledFavorite(cid: string, uid: string, n: ScheduledNote) {
  const on = !n.favoriteBy.includes(uid);
  await updateDoc(doc(db, 'couples', cid, 'scheduled', n.id), { favoriteBy: on ? arrayUnion(uid) : arrayRemove(uid) });
}

/** The sender cancels (before delivery) or takes back (after). */
export async function cancelScheduled(cid: string, n: ScheduledNote) {
  if (n.mediaId) {
    const snap = await getDoc(doc(db, 'couples', cid, 'media', n.mediaId));
    if (snap.exists()) await deleteMedia(cid, { id: snap.id, storagePath: (snap.data() as Media).storagePath });
  }
  await deleteDoc(doc(db, 'couples', cid, 'scheduled', n.id));
}

// ------------------------------------------------------------ the plant

export function usePlant(cid: string | null) {
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      doc(db, 'couples', cid, 'garden', 'plant'),
      (s) => setPoints(s.exists() ? ((s.data().points as number) ?? 0) : 0),
      () => setPoints(0),
    );
  }, [cid]);
  return points;
}

const DAILY_CARE_CAP = 8;

/**
 * Something caring happened (a log, a hug, a thank-you...). Grows the plant a
 * little and marks today as a care day. Fire-and-forget; never blocks the UI.
 */
export async function care(ctx: { uid: string; cid: string | null }) {
  const { uid, cid } = ctx;
  if (!cid) return;
  const date = dayKey();
  try {
    const key = `together.care.${uid}.${date}`;
    const count = Number((await AsyncStorage.getItem(key)) ?? '0');
    if (count < DAILY_CARE_CAP) {
      await AsyncStorage.setItem(key, String(count + 1));
      const ref = doc(db, 'couples', cid, 'garden', 'plant');
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) tx.update(ref, { points: ((snap.data().points as number) ?? 0) + 1, updatedAt: serverTimestamp(), lastCareBy: uid });
        else tx.set(ref, { points: 1, updatedAt: serverTimestamp(), lastCareBy: uid });
      });
    }
    const dayRef = doc(db, 'couples', cid, 'care', date);
    const day = await getDoc(dayRef);
    const who = (day.data()?.who as string[] | undefined) ?? [];
    if (!who.includes(uid)) await setDoc(dayRef, { who: arrayUnion(uid) }, { merge: true });
  } catch {
    // offline or busy: the plant can wait
  }
}

export function useCareDays(cid: string | null) {
  const [days, setDays] = useState<Record<string, string[]>>({});
  const keys = lastNDays(60);
  const from = keys[0];
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      collection(db, 'couples', cid, 'care'),
      (s) => {
        const out: Record<string, string[]> = {};
        s.docs.forEach((d) => {
          if (d.id >= from) out[d.id] = (d.data().who as string[]) ?? [];
        });
        setDays(out);
      },
      () => setDays({}),
    );
  }, [cid, from]);
  return { days, keys };
}
