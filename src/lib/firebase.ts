/**
 * Firebase client. Configure with EXPO_PUBLIC_FIREBASE_* env vars (see .env.example).
 * Set EXPO_PUBLIC_USE_EMULATORS=1 to run fully locally against the Firebase emulators.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';
/** Where the Cloud Functions run: Singapore, next to the database (functions/src/index.ts). */
export const FUNCTIONS_REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-southeast1';
const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';

const config: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || (useEmulators ? 'demo-key' : undefined),
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-together' : undefined),
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || (useEmulators ? 'demo-together.appspot.com' : undefined),
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || (useEmulators ? 'demo-app' : undefined),
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

function reactNativePersistence(): Persistence {
  // `getReactNativePersistence` is only exported from the React Native build of
  // firebase/auth (resolved by Metro), so it is not visible to TypeScript here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getReactNativePersistence } = require('firebase/auth') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };
  return getReactNativePersistence(AsyncStorage);
}

let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

if (isFirebaseConfigured) {
  const firstInit = getApps().length === 0;
  const app = firstInit ? initializeApp(config) : getApp();

  if (firstInit) {
    auth = initializeAuth(app, {
      persistence: Platform.OS === 'web' ? browserLocalPersistence : reactNativePersistence(),
    });
    // "same-origin": a demo gateway serves the web app and forwards emulator
    // traffic on one HTTPS origin (see scripts/demo-gateway.cjs).
    const sameOrigin = useEmulators && emulatorHost === 'same-origin' && typeof window !== 'undefined';
    const origin = sameOrigin ? window.location : null;
    db = initializeFirestore(
      app,
      origin
        ? { host: origin.host, ssl: origin.protocol === 'https:', experimentalForceLongPolling: true, ignoreUndefinedProperties: true }
        : { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true },
    );
    storage = getStorage(app);
    functions = getFunctions(app, FUNCTIONS_REGION);
    // App Check (web): proves calls come from your real site. Native apps need a
    // native App Check provider; see docs/DEPLOY.md.
    const recaptchaKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
    if (Platform.OS === 'web' && recaptchaKey && !useEmulators) {
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(recaptchaKey), isTokenAutoRefreshEnabled: true });
    }
    if (origin) {
      connectAuthEmulator(auth, origin.origin, { disableWarnings: true });
      const port = Number(origin.port || (origin.protocol === 'https:' ? 443 : 80));
      connectStorageEmulator(storage, origin.hostname, port);
      (storage as unknown as { _protocol: string })._protocol = origin.protocol.replace(':', '');
      // The gateway forwards /<project>/<region>/<function> to the Functions emulator.
      (functions as unknown as { emulatorOrigin: string }).emulatorOrigin = origin.origin;
    } else if (useEmulators) {
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, emulatorHost, 8080);
      connectStorageEmulator(storage, emulatorHost, 9199);
      connectFunctionsEmulator(functions, emulatorHost, 5001);
    }
  } else {
    // Fast refresh re-evaluates this module; reuse the existing instances.
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, FUNCTIONS_REGION);
  }
}

export { auth, db, functions, storage };
