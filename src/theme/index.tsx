import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import {
  DEFAULT_APPEARANCE,
  cleanAppearance,
  colorsFor,
  looks,
  palette,
  type Appearance,
  type Colors,
  type Look,
  type MotionLevel,
  TEXT_SCALE,
} from './tokens';

export * from './tokens';

type Theme = {
  dark: boolean;
  c: Colors;
  look: Look;
  /** Animations after the person's choice and the phone's "Reduce motion" setting. */
  motion: MotionLevel;
  /** Text size multiplier from Look & feel → Text size. */
  textScale: number;
  appearance: Appearance;
  setAppearance: (next: Partial<Appearance>) => void;
};

const STORAGE_KEY = 'together.appearance';

const ThemeContext = createContext<Theme>({
  dark: false,
  c: palette.light,
  look: looks.soft,
  motion: 'gentle',
  textScale: 1,
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
});

export function TogetherThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [reduceMotion, setReduceMotion] = useState(false);

  // This phone's last choice, so the app opens in the right colours straight away.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setState(cleanAppearance(JSON.parse(raw))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const setAppearance = useCallback((next: Partial<Appearance>) => {
    setState((prev) => {
      const merged = cleanAppearance({ ...prev, ...next });
      if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }, []);

  const value = useMemo<Theme>(() => {
    const dark = appearance.mode === 'auto' ? scheme === 'dark' : appearance.mode === 'dark';
    return {
      dark,
      c: colorsFor(appearance.color, dark),
      look: looks[appearance.look],
      motion: reduceMotion ? 'off' : appearance.motion,
      textScale: TEXT_SCALE[appearance.text],
      appearance,
      setAppearance,
    };
  }, [scheme, appearance, reduceMotion, setAppearance]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
