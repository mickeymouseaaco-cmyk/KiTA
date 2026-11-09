/**
 * Argument Reset: after a tense day either partner can start one. Both get the
 * same three gentle steps (pause, drink water, share one appreciation). Each
 * person's appreciation unlocks for the other only after they've written theirs,
 * and the rules enforce that.
 */
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { dayKey } from './dates';
import { db } from './firebase';
import { care } from './together-data';

export type Reset = { startedBy: string; date: string };
export type ResetNote = { text: string };

const resetRef = (cid: string, date: string) => doc(db, 'couples', cid, 'resets', date);
const noteRef = (cid: string, date: string, uid: string) => doc(db, 'couples', cid, 'resets', date, 'notes', uid);

export async function startReset(cid: string, uid: string, date = dayKey()) {
  await setDoc(resetRef(cid, date), { startedBy: uid, date, createdAt: serverTimestamp() });
}

export async function shareAppreciation(cid: string, uid: string, text: string, date = dayKey()) {
  await setDoc(noteRef(cid, date, uid), { text: text.trim().slice(0, 500), createdAt: serverTimestamp() });
  void care({ uid, cid });
}

export async function editAppreciation(cid: string, uid: string, text: string, date = dayKey()) {
  await updateDoc(noteRef(cid, date, uid), { text: text.trim().slice(0, 500), createdAt: serverTimestamp() });
}

/** Today's reset (if any), my note, and theirs (only readable once I've written mine). */
export function useReset(cid: string | null, uid: string | null, partnerId: string | null, date = dayKey()) {
  const [reset, setReset] = useState<Reset | null | undefined>(undefined);
  const [mine, setMine] = useState<ResetNote | null>(null);
  // True only once the server has my note (the rules check it before showing theirs).
  const [mineConfirmed, setMineConfirmed] = useState(false);
  const [theirs, setTheirs] = useState<ResetNote | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      resetRef(cid, date),
      (s) => setReset(s.exists() ? (s.data() as Reset) : null),
      () => setReset(null),
    );
  }, [cid, date]);

  useEffect(() => {
    if (!cid || !uid) return;
    return onSnapshot(
      noteRef(cid, date, uid),
      { includeMetadataChanges: true },
      (s) => {
        setMine(s.exists() ? (s.data() as ResetNote) : null);
        setMineConfirmed(s.exists() && !s.metadata.hasPendingWrites);
      },
      () => setMine(null),
    );
  }, [cid, uid, date]);

  const iWrote = !!mine;
  useEffect(() => {
    if (!cid || !partnerId || !mineConfirmed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = onSnapshot(
      noteRef(cid, date, partnerId),
      (s) => setTheirs(s.exists() ? (s.data() as ResetNote) : null),
      () => {
        // Rarely, the server hasn't caught up with my note yet: try again shortly.
        timer = setTimeout(() => setRetry((r) => r + 1), 2000);
      },
    );
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [cid, partnerId, date, mineConfirmed, retry]);

  return { reset, mine, theirs: iWrote ? theirs : null };
}
