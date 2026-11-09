import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { deleteMedia } from './media';
import type { Media, Memory } from './types';

export function useMemories(cid: string | null) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!cid) return;
    const q = query(collection(db, 'couples', cid, 'memories'), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Memory));
        setReady(true);
      },
      () => setReady(true),
    );
  }, [cid]);
  return { memories, ready };
}

export function useMemory(cid: string, id: string) {
  const [memory, setMemory] = useState<Memory | null | undefined>(undefined);
  useEffect(() => {
    return onSnapshot(
      doc(db, 'couples', cid, 'memories', id),
      (snap) => setMemory(snap.exists() ? ({ id: snap.id, ...snap.data() } as Memory) : null),
      () => setMemory(null),
    );
  }, [cid, id]);
  return memory;
}

export async function deleteMemory(cid: string, memory: Memory) {
  for (const mediaId of memory.mediaIds) {
    const snap = await getDoc(doc(db, 'couples', cid, 'media', mediaId));
    if (snap.exists()) await deleteMedia(cid, { id: snap.id, storagePath: (snap.data() as Media).storagePath });
  }
  await deleteDoc(doc(db, 'couples', cid, 'memories', memory.id));
}
