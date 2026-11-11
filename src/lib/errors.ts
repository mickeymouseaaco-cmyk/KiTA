/**
 * Crash and error reporting, kept small and private: when something breaks,
 * a short technical note goes to Firestore (errorReports) so it can be fixed.
 * Never your notes, logs, photos or name: just what went wrong, where, and on
 * what kind of device. Only while signed in; a few per session; the same
 * error once. Old reports are deleted after 90 days (functions/src/index.ts).
 */
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';

import { cleanErrorReport, type ErrorKind } from './errors-pure';
import { auth, db } from './firebase';

export * from './errors-pure';

const MAX_PER_SESSION = 5;
const sent = new Set<string>();
let route = '';

/** Remember which screen is open, so a report says where it happened. */
export function setErrorRoute(path: string) {
  route = path;
}

export function reportError(error: unknown, kind: ErrorKind = 'error') {
  try {
    if (!auth.currentUser || sent.size >= MAX_PER_SESSION) return;
    const report = cleanErrorReport(error, {
      kind,
      route,
      platform: Platform.OS,
      agent: typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '',
      version: Constants.expoConfig?.version ?? '',
    });
    const key = `${report.kind}:${report.message}`;
    if (sent.has(key)) return;
    sent.add(key);
    addDoc(collection(db, 'errorReports'), { ...report, at: serverTimestamp() }).catch(() => {});
  } catch {
    // Reporting must never cause a problem of its own.
  }
}

let installed = false;

/** Catch what slips through: uncaught errors and rejected promises. */
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'error'));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
    return;
  }
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    reportError(e, fatal ? 'crash' : 'error');
    previous?.(e, fatal);
  });
}
