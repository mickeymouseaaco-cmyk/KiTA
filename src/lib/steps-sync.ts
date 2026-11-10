/**
 * Steps from Apple Health. A web app can't read Health, so an iPhone Shortcut
 * reads today's steps and opens the person's private sync link
 * (functions/src/index.ts → syncSteps). See docs/STEPS-SYNC.md.
 */
import { Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { db, functions } from './firebase';

export type StepsSync = {
  url: string;
  createdAt: Timestamp | null;
  lastSyncAt: Timestamp | null;
  lastSteps: number | null;
  lastDate?: string;
};

/** My sync link and when it last ran. `undefined` while loading, `null` when off. */
export function useStepsSync(uid: string | null | undefined): StepsSync | null | undefined {
  const [state, setState] = useState<StepsSync | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid, 'settings', 'stepsSync'),
      (s) => setState(s.exists() && s.data().url ? (s.data() as StepsSync) : null),
      () => setState(null),
    );
  }, [uid]);
  return state;
}

/** Make a new link. Any earlier link stops working. */
export async function startStepsSync(): Promise<string> {
  const res = await httpsCallable<object, { url: string }>(functions, 'startStepsSync')({});
  return res.data.url;
}

export async function stopStepsSync(): Promise<void> {
  await httpsCallable(functions, 'stopStepsSync')({});
}

