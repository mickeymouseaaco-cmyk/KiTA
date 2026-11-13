/**
 * Offline support.
 *
 * KiTA keeps a copy of what you've seen on your phone (Firestore's local cache)
 * and queues what you change while you're offline; it goes up by itself when
 * the connection returns. Firestore only says a write is "done" once the server
 * has it, so without help the app would sit on a spinner whenever the signal
 * drops. `localFirst` lets the screen move on once the change is saved on the
 * phone.
 */
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Best guess at whether we're online right now (web: the browser's own flag). */
export function isOnline(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) return navigator.onLine;
  return true;
}

/** Live online/offline state, for the little "offline" pill. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        // isInternetReachable is null while unknown; only trust a clear "no".
        setOnline(!(s.isConnected === false || s.isInternetReachable === false));
      }),
    [],
  );
  return online;
}

/**
 * Wait for a save, but not for the server: when offline it returns straight
 * away (the change is already saved on the phone and will sync), and on a slow
 * connection it stops waiting after a couple of seconds. A real error that
 * comes back quickly (like "not allowed") is still thrown.
 */
export function localFirst<T>(work: Promise<T>, waitMs = 2500): Promise<T | undefined> {
  work.catch((e) => {
    if (__DEV__) console.warn('[offline] a queued change failed', e);
  });
  if (!isOnline()) return Promise.resolve(undefined);
  return new Promise<T | undefined>((resolve, reject) => {
    const t = setTimeout(() => resolve(undefined), waitMs);
    work.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
