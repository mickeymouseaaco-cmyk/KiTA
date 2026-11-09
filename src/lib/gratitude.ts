import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { deleteMedia } from './media';
import { care } from './together-data';
import type { Gratitude, Media } from './types';

type Who = { uid: string; cid: string; partnerId: string };

/** One thank-you per person per day: the doc id is `{uid}_{date}`. */
export async function sendGratitudeText(who: Who, text: string, date: string) {
  await setDoc(doc(db, 'couples', who.cid, 'gratitude', `${who.uid}_${date}`), {
    ownerId: who.uid,
    toUid: who.partnerId,
    date,
    text: text.trim().slice(0, 500),
    createdAt: serverTimestamp(),
  });
  void care(who);
}

export async function deleteGratitude(cid: string, g: Gratitude) {
  if (g.mediaId) {
    const snap = await getDoc(doc(db, 'couples', cid, 'media', g.mediaId));
    if (snap.exists()) await deleteMedia(cid, { id: snap.id, storagePath: (snap.data() as Media).storagePath });
  }
  await deleteDoc(doc(db, 'couples', cid, 'gratitude', g.id));
}

export function useGratitude(cid: string | null, fromKey: string) {
  const [items, setItems] = useState<Gratitude[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!cid) return;
    const q = query(collection(db, 'couples', cid, 'gratitude'), where('date', '>=', fromKey));
    return onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Gratitude)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
        );
        setReady(true);
      },
      () => setReady(true),
    );
  }, [cid, fromKey]);
  return { items, ready };
}

export { weeklyAppreciation, type WeeklyAppreciation } from './gratitude-summary';
