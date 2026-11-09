/**
 * App lock: a 4-digit PIN (kept in the device keychain via SecureStore) with
 * optional Face ID / fingerprint. Locks on launch and after 30 seconds away.
 * Not available on web, where there is no secure keychain.
 */
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

const KEY = 'together.lock.v1';
const RELOCK_AFTER_MS = 30_000;

type LockSettings = { enabled: boolean; pinHash: string | null; biometrics: boolean };

type LockState = {
  supported: boolean;
  ready: boolean;
  settings: LockSettings;
  locked: boolean;
  biometricsAvailable: boolean;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enable: (pin: string, biometrics: boolean) => Promise<void>;
  disable: () => Promise<void>;
  setBiometrics: (on: boolean) => Promise<void>;
};

const OFF: LockSettings = { enabled: false, pinHash: null, biometrics: false };
const supported = Platform.OS !== 'web';

const hash = (pin: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, `together:${pin}`);

const LockContext = createContext<LockState | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LockSettings>(OFF);
  const [ready, setReady] = useState(!supported);
  const [locked, setLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        const s = raw ? ({ ...OFF, ...JSON.parse(raw) } as LockSettings) : OFF;
        setSettings(s);
        setLocked(s.enabled);
        setBiometricsAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!supported) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current && settings.enabled) {
        if (Date.now() - backgroundAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [settings.enabled]);

  const persist = useCallback(async (s: LockSettings) => {
    setSettings(s);
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  }, []);

  const value: LockState = {
    supported,
    ready,
    settings,
    locked,
    biometricsAvailable,
    unlockWithPin: async (pin) => {
      const ok = settings.pinHash !== null && (await hash(pin)) === settings.pinHash;
      if (ok) setLocked(false);
      return ok;
    },
    unlockWithBiometrics: async () => {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Together',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      if (res.success) setLocked(false);
      return res.success;
    },
    enable: async (pin, biometrics) => persist({ enabled: true, pinHash: await hash(pin), biometrics }),
    disable: async () => persist(OFF),
    setBiometrics: async (on) => persist({ ...settings, biometrics: on }),
  };

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockState {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}
