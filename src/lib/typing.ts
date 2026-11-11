/**
 * "Aina is typing…": while you write a note, a tiny marker
 * (couples/{cid}/typing/{uid} = { at }) is refreshed every few seconds; it's
 * removed when you send, clear the box or leave. Your partner sees the
 * indicator while the marker is fresh. Only that a note is being written is
 * shared, never what you type.
 */
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { db } from './firebase';

import { TYPING_REFRESH_MS, isTyping } from './typing-pure';

export * from './typing-pure';

const ref = (cid: string, uid: string) => doc(db, 'couples', cid, 'typing', uid);

/** Call `typed()` on every change of the box and `stopped()` when sending or leaving. */
export function useTypingSignal(cid: string | null | undefined, uid: string | null | undefined) {
  const last = useRef(0);
  const on = useRef(false);
  const stopped = useCallback(() => {
    if (!on.current || !cid || !uid) return;
    on.current = false;
    last.current = 0;
    deleteDoc(ref(cid, uid)).catch(() => {});
  }, [cid, uid]);
  const typed = useCallback(
    (text: string) => {
      if (!text.trim()) return stopped();
      // Still finding your couple (e.g. right after opening the page): nothing to signal yet.
      if (!cid || !uid) return;
      const now = Date.now();
      if (now - last.current < TYPING_REFRESH_MS) return;
      last.current = now;
      on.current = true;
      setDoc(ref(cid, uid), { at: serverTimestamp() }).catch(() => {});
    },
    [cid, uid, stopped],
  );
  // Leaving the screen (or closing the app) stops it too.
  useEffect(() => stopped, [stopped]);
  return { typed, stopped };
}

/** Whether my partner is writing to me right now. */
export function usePartnerTyping(cid: string | null | undefined, partnerId: string | null | undefined): boolean {
  const [atMs, setAtMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!cid || !partnerId) return;
    return onSnapshot(
      ref(cid, partnerId),
      (s) => {
        const at = s.data({ serverTimestamps: 'estimate' })?.at as Timestamp | undefined;
        setAtMs(at ? at.toMillis() : null);
        setNow(Date.now());
      },
      () => setAtMs(null),
    );
  }, [cid, partnerId]);
  // While a marker is showing, look again shortly so it disappears when it goes stale.
  useEffect(() => {
    if (atMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(t);
  }, [atMs]);
  return isTyping(atMs, now);
}
