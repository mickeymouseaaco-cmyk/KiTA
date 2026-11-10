/**
 * Find my partner. Each person chooses to share; only the latest location is
 * kept (couples/{cid}/locations/{uid}), never a history, and turning sharing off
 * deletes it. The app updates it while KiTA is open; an iPhone Shortcut can
 * also send it in the background (functions/src/index.ts → syncLocation).
 */
import { Timestamp, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { db } from './firebase';
import { worthSending, type Fix } from './location-pure';

export * from './location-pure';

export type SharedLocation = { lat: number; lng: number; accuracy: number; at: Timestamp | null; source: 'app' | 'shortcut' };

const settingRef = (uid: string) => doc(db, 'users', uid, 'settings', 'location');
const locationRef = (cid: string, uid: string) => doc(db, 'couples', cid, 'locations', uid);

/** Whether I share my location. `undefined` while loading. */
export function useLocationSharing(uid: string | null | undefined): boolean | undefined {
  const [on, setOn] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      settingRef(uid),
      (s) => setOn(s.data()?.sharing === true),
      () => setOn(false),
    );
  }, [uid]);
  return on;
}

/** Someone's latest shared location. `null` when they don't share. */
export function useSharedLocation(cid: string | null, uid: string | null): SharedLocation | null | undefined {
  const [loc, setLoc] = useState<SharedLocation | null | undefined>(undefined);
  useEffect(() => {
    if (!cid || !uid) return;
    return onSnapshot(
      locationRef(cid, uid),
      (s) => setLoc(s.exists() ? (s.data() as SharedLocation) : null),
      () => setLoc(null),
    );
  }, [cid, uid]);
  return loc;
}

export function canLocate(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/** One position from the device (asks permission the first time). */
export function currentPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!canLocate()) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.min(100000, Math.max(0, p.coords.accuracy ?? 0)) }),
      (e) => reject(new Error(e.code === 1 ? 'denied' : 'unavailable')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export async function saveMyLocation(cid: string, uid: string, f: Fix) {
  await setDoc(locationRef(cid, uid), {
    lat: Math.round(f.lat * 1e6) / 1e6,
    lng: Math.round(f.lng * 1e6) / 1e6,
    accuracy: Math.round(f.accuracy),
    at: serverTimestamp(),
    source: 'app',
  });
}

/** Turn sharing on (sends my location now) or off (deletes it). */
export async function setLocationSharing(uid: string, cid: string | null, on: boolean) {
  if (on) {
    const fix = await currentPosition(); // asks permission first; nothing is saved if refused
    await setDoc(settingRef(uid), { sharing: true, updatedAt: serverTimestamp() });
    if (cid) await saveMyLocation(cid, uid, fix);
  } else {
    await setDoc(settingRef(uid), { sharing: false, updatedAt: serverTimestamp() });
    if (cid) await deleteDoc(locationRef(cid, uid)).catch(() => {});
  }
}

/** "Jalan Plumbum, i-City, Shah Alam": a short place name (OpenStreetMap Nominatim). */
const placeCache = new Map<string, string>();
export async function placeName(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (placeCache.has(key)) return placeCache.get(key)!;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=en&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; address?: Record<string, string> };
    const a = j.address ?? {};
    const parts = [j.name || a.road, a.suburb || a.neighbourhood || a.quarter, a.city || a.town || a.village || a.county].filter(Boolean);
    const name = [...new Set(parts)].slice(0, 3).join(', ') || null;
    if (name) placeCache.set(key, name);
    return name;
  } catch {
    return null;
  }
}

/**
 * While KiTA is open (and I share), keep my location fresh: watch the device,
 * and send only when I've moved a little or a few minutes have passed.
 */
export function useShareWhileOpen(uid: string | null | undefined, cid: string | null | undefined, sharing: boolean | undefined) {
  useEffect(() => {
    if (!uid || !cid || !sharing || !canLocate() || Platform.OS !== 'web') return;
    let last: { fix: Fix; at: number } | null = null;
    const send = (fix: Fix) => {
      const now = Date.now();
      if (!worthSending(last, fix, now)) return;
      last = { fix, at: now };
      saveMyLocation(cid, uid, fix).catch(() => {});
    };
    const id = navigator.geolocation.watchPosition(
      (p) => send({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.min(100000, Math.max(0, p.coords.accuracy ?? 0)) }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') currentPosition().then(send).catch(() => {});
    });
    return () => {
      navigator.geolocation.clearWatch(id);
      sub.remove();
    };
  }, [uid, cid, sharing]);
}
