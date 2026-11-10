/**
 * Notifications in the web app (KiTA added to the home screen, or a desktop browser).
 *
 * - The service worker (public/sw.js) shows them, so they arrive even when KiTA is closed.
 * - This file asks permission (only after a tap), gets this device's push address
 *   from Firebase Cloud Messaging, and keeps it on the person's own profile
 *   (users/{uid}.webPushTokens). The server sends to it (functions/src/index.ts, sendPush).
 * - On iPhone, Safari only allows this once KiTA is on the Home Screen (iOS 16.4+).
 */
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { Platform } from 'react-native';

import { app, db } from './firebase';
import { WEB_PUSH_KEY } from './firebase-config';

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || WEB_PUSH_KEY;
const TOKEN_KEY = 'kita.webPushToken';

export type WebPushState =
  | 'not-web' // the phone apps use their own notifications
  | 'not-ready' // the project's Web Push key isn't set yet
  | 'unsupported' // this browser can't do it
  | 'needs-install' // iPhone/iPad Safari: add KiTA to the Home Screen first
  | 'off' // can ask
  | 'on'
  | 'blocked'; // the person said no in the browser; only browser settings can undo it

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function webPushState(): Promise<WebPushState> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'not-web';
  if (!VAPID_KEY) return 'not-ready';
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && readToken() ? 'on' : 'off';
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the token still lives on the profile; we just can't remember it here.
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js');
}

/** Call from a button tap. Returns the resulting state. */
export async function turnOnWebPush(uid: string): Promise<WebPushState> {
  const state = await webPushState();
  if (state !== 'off' && state !== 'on') return state;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() });
  if (!token) return 'off';
  const old = readToken();
  await updateDoc(doc(db, 'users', uid), { webPushTokens: arrayUnion(token) });
  if (old && old !== token) await updateDoc(doc(db, 'users', uid), { webPushTokens: arrayRemove(old) }).catch(() => {});
  writeToken(token);
  return 'on';
}

export async function turnOffWebPush(uid: string): Promise<void> {
  const token = readToken();
  if (token) await updateDoc(doc(db, 'users', uid), { webPushTokens: arrayRemove(token) }).catch(() => {});
  await deleteToken(getMessaging(app)).catch(() => {});
  writeToken(null);
}

/**
 * On each app start: if notifications are on, make sure this device's current
 * address is the one saved (browsers rotate them now and then). Never prompts.
 */
export async function refreshWebPush(uid: string): Promise<void> {
  if ((await webPushState()) !== 'on') return;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() }).catch(() => null);
  const old = readToken();
  if (!token || token === old) return;
  await updateDoc(doc(db, 'users', uid), { webPushTokens: arrayUnion(token) });
  if (old) await updateDoc(doc(db, 'users', uid), { webPushTokens: arrayRemove(old) }).catch(() => {});
  writeToken(token);
}
