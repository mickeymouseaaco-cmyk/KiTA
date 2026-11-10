/**
 * Look & feel follows the person across their phones: saved on this phone
 * (src/theme) and in their own private settings (users/{uid}/settings/appearance).
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';

import { cleanAppearance, useTheme, type Appearance } from '@/theme';

import { db } from './firebase';
import { useSession } from './session';

const ref = (uid: string) => doc(db, 'users', uid, 'settings', 'appearance');

/** Change the look now, and remember it for this person's other phones. */
export function useSetAppearance() {
  const { uid } = useSession();
  const { appearance, setAppearance } = useTheme();
  return (next: Partial<Appearance>) => {
    setAppearance(next);
    if (uid) setDoc(ref(uid), { ...cleanAppearance({ ...appearance, ...next }), updatedAt: serverTimestamp() }).catch(() => {});
  };
}

/** Picks up a look chosen on another phone. Rendered once, inside the session. */
export function AppearanceSync() {
  const { uid } = useSession();
  const { setAppearance } = useTheme();
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      ref(uid),
      (s) => {
        if (s.exists()) setAppearance(cleanAppearance(s.data()));
      },
      () => {},
    );
  }, [uid, setAppearance]);
  return null;
}
