/**
 * Daily logs and sharing.
 *
 * Writes always go to the private log first (users/{uid}/days/{date}). Then the
 * shared projection (couples/{cid}/shared/{uid}_{date}) is rebuilt from scratch
 * from the private log and the current share settings. Because the projection
 * is overwritten (not merged), turning a category off can never leave a stale
 * value behind.
 */
import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { dayKey } from './dates';
import { db } from './firebase';
import { localFirst } from './offline';
import { deleteMedia } from './media';
import { care } from './together-data';
import { projectDay } from './projection';
import { DEFAULT_CYCLE, cycleToday } from './cycle';
import {
  DEFAULT_SHARE,
  type CheckIn,
  type CycleSettings,
  type DailyLog,
  type Meal,
  type Media,
  type MealKind,
  type MoodEntry,
  type ShareCategory,
  type ShareSettings,
  type SharedDay,
} from './types';

export type LogCtx = { uid: string; cid: string | null };

const dayRef = (uid: string, date: string) => doc(db, 'users', uid, 'days', date);
const sharedRef = (cid: string, uid: string, date: string) => doc(db, 'couples', cid, 'shared', `${uid}_${date}`);
const shareSettingsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'share');
const cycleSettingsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'cycle');

async function readShare(uid: string): Promise<ShareSettings> {
  const snap = await getDoc(shareSettingsRef(uid));
  return { ...DEFAULT_SHARE, ...(snap.data() as Partial<ShareSettings> | undefined) };
}

/** Rebuild one day's shared projection from the private log and current settings. */
export async function reprojectDay(ctx: LogCtx, date: string) {
  return reproject(ctx, date);
}

async function reproject(ctx: LogCtx, date: string) {
  if (!ctx.cid) return;
  const [daySnap, share] = await Promise.all([getDoc(dayRef(ctx.uid, date)), readShare(ctx.uid)]);
  if (!daySnap.exists()) return;
  const projected = projectDay(ctx.uid, daySnap.data() as DailyLog, share);
  await setDoc(sharedRef(ctx.cid, ctx.uid, date), { ...projected, updatedAt: serverTimestamp() });
}

export async function saveSteps(ctx: LogCtx, steps: number, stepGoal: number, date = dayKey()) {
  // Saved on the phone first; syncs when online (see lib/offline).
  await localFirst(
    (async () => {
      await setDoc(
        dayRef(ctx.uid, date),
        { date, steps: Math.max(0, Math.round(steps)), stepGoal, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await reproject(ctx, date);
      void care(ctx);
    })(),
  );
}

export async function saveMood(ctx: LogCtx, mood: Omit<MoodEntry, 'at'>, date = dayKey()) {
  // Saved on the phone first; syncs when online (see lib/offline).
  await localFirst(
    (async () => {
      const entry: Record<string, unknown> = { emoji: mood.emoji, label: mood.label, stress: mood.stress, at: serverTimestamp() };
      if (mood.note?.trim()) entry.note = mood.note.trim();
      await setDoc(dayRef(ctx.uid, date), { date, mood: entry, updatedAt: serverTimestamp() }, { merge: true });
      await reproject(ctx, date);
      void care(ctx);
    })(),
  );
}

// ------------------------------------------------------------------ food

export async function addMeal(ctx: LogCtx, kind: MealKind, text: string, date = dayKey()) {
  // Saved on the phone first; syncs when online (see lib/offline).
  await localFirst(
    (async () => {
      const meal: Meal = { id: Math.random().toString(36).slice(2, 10), kind, text: text.trim().slice(0, 200), at: Date.now() };
      await setDoc(dayRef(ctx.uid, date), { date, food: { meals: arrayUnion(meal) }, updatedAt: serverTimestamp() }, { merge: true });
      await reproject(ctx, date);
    })(),
  );
}

export async function removeMeal(ctx: LogCtx, meals: Meal[], id: string, date = dayKey()) {
  // Saved on the phone first; syncs when online (see lib/offline).
  await localFirst(
    (async () => {
      await setDoc(
        dayRef(ctx.uid, date),
        { date, food: { meals: meals.filter((m) => m.id !== id) }, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await reproject(ctx, date);
    })(),
  );
}

/** Water is a gentle counter: no targets, never below zero. */
export async function changeWater(ctx: LogCtx, current: number, delta: 1 | -1, date = dayKey()) {
  if (delta < 0 && current <= 0) return;
  await setDoc(dayRef(ctx.uid, date), { date, food: { water: increment(delta) }, updatedAt: serverTimestamp() }, { merge: true });
  await reproject(ctx, date);
  if (delta > 0) void care(ctx);
}

// ----------------------------------------------------------------- cycle

export async function saveCycleSettings(ctx: LogCtx, s: CycleSettings) {
  await setDoc(cycleSettingsRef(ctx.uid), { ...s, updatedAt: serverTimestamp() });
  await syncCycleDay(ctx, s, undefined);
}

/** Recompute today's cycle day from private settings, keeping logged symptoms. */
export async function syncCycleDay(ctx: LogCtx, s: CycleSettings, symptoms: string[] | undefined, date = dayKey()) {
  let keep = symptoms;
  if (keep === undefined) {
    const snap = await getDoc(dayRef(ctx.uid, date));
    keep = (snap.data() as DailyLog | undefined)?.cycle?.symptoms ?? [];
  }
  const c = cycleToday(s, date, keep);
  await setDoc(
    dayRef(ctx.uid, date),
    { date, cycle: c ?? deleteField(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  await reproject(ctx, date);
}

export function useCycleSettings(uid: string | null): CycleSettings | null {
  const [s, setS] = useState<CycleSettings | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      cycleSettingsRef(uid),
      (snap) => setS({ ...DEFAULT_CYCLE, ...(snap.data() as Partial<CycleSettings> | undefined) }),
      () => setS(DEFAULT_CYCLE),
    );
  }, [uid]);
  return s;
}

// -------------------------------------------------------------- check-in

/** Evening check-in. Private: it lives only in my own day log. */
export async function saveCheckIn(uid: string, patch: Omit<CheckIn, 'at'>, date = dayKey()) {
  // Saved on the phone first; syncs when online (see lib/offline).
  await localFirst(
    (async () => {
      const clean: Record<string, unknown> = { at: serverTimestamp() };
      Object.entries(patch).forEach(([k, v]) => v !== undefined && v !== '' && (clean[k] = v));
      await setDoc(dayRef(uid, date), { date, checkIn: clean, updatedAt: serverTimestamp() }, { merge: true });
    })(),
  );
}

/**
 * Change one share toggle.
 * Off: the field is removed from every shared day I own, immediately.
 * On: only today is re-shared. The past stays private.
 */
export async function setShareCategory(ctx: LogCtx, category: ShareCategory, on: boolean) {
  await setDoc(shareSettingsRef(ctx.uid), { [category]: on, updatedAt: serverTimestamp() }, { merge: true });
  if (!ctx.cid) return;
  if (!on) {
    const fields: Partial<Record<ShareCategory, string[]>> = {
      steps: ['steps', 'stepGoal'],
      mood: ['mood'],
      food: ['food'],
      cycle: ['cycle'],
      media: ['mood.mediaId'],
    };
    if (category === 'media') await unshareMoodMedia(ctx.uid, ctx.cid);
    const toRemove = fields[category];
    if (!toRemove) return;
    const mine = await getDocs(query(collection(db, 'couples', ctx.cid, 'shared'), where('ownerId', '==', ctx.uid)));
    const batch = writeBatch(db);
    mine.docs.forEach((d) => {
      const patch: Record<string, unknown> = {};
      toRemove.forEach((f) => (patch[f] = deleteField()));
      batch.update(d.ref, patch);
    });
    await batch.commit();
  } else {
    await reproject(ctx, dayKey());
  }
}

/**
 * Photo & voice sharing turned off: delete the shared copies of my mood
 * selfies/voice notes. My private copies stay with me.
 */
async function unshareMoodMedia(uid: string, cid: string) {
  const mine = await getDocs(query(collection(db, 'couples', cid, 'media'), where('ownerId', '==', uid)));
  for (const d of mine.docs) {
    const m = d.data() as Media;
    if (m.parent?.kind !== 'mood') continue;
    await deleteMedia(cid, { id: d.id, storagePath: m.storagePath });
    await updateDoc(dayRef(uid, m.parent.id), { 'mood.sharedMediaId': deleteField() }).catch(() => {});
  }
}

export async function setStepGoal(uid: string, goal: number) {
  await updateDoc(doc(db, 'users', uid), { stepGoal: goal });
}

// ------------------------------------------------------------------- hooks

export function useShareSettings(uid: string | null): ShareSettings | null {
  const [share, setShare] = useState<ShareSettings | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      shareSettingsRef(uid),
      (snap) => setShare({ ...DEFAULT_SHARE, ...(snap.data() as Partial<ShareSettings> | undefined) }),
      () => setShare(DEFAULT_SHARE),
    );
  }, [uid]);
  return share;
}

/** My private days from `fromKey` onward, keyed by date. */
export function useMyDays(uid: string | null, fromKey: string) {
  const [days, setDays] = useState<Record<string, DailyLog>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'days'), where('date', '>=', fromKey));
    return onSnapshot(
      q,
      (snap) => {
        const out: Record<string, DailyLog> = {};
        snap.docs.forEach((d) => (out[d.id] = d.data() as DailyLog));
        setDays(out);
        setReady(true);
      },
      () => setReady(true),
    );
  }, [uid, fromKey]);
  return { days, ready };
}

/** What my partner shared from `fromKey` onward, keyed by date. */
export function usePartnerDays(cid: string | null, partnerId: string | null, fromKey: string) {
  const [days, setDays] = useState<Record<string, SharedDay>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!cid || !partnerId) return;
    const q = query(
      collection(db, 'couples', cid, 'shared'),
      where('ownerId', '==', partnerId),
      where('date', '>=', fromKey),
    );
    return onSnapshot(
      q,
      (snap) => {
        const out: Record<string, SharedDay> = {};
        snap.docs.forEach((d) => {
          const v = d.data() as SharedDay;
          out[v.date] = v;
        });
        setDays(out);
        setReady(true);
      },
      () => setReady(true),
    );
  }, [cid, partnerId, fromKey]);
  return { days, ready };
}
