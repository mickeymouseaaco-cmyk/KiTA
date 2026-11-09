import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type Colors } from './tokens';

export * from './tokens';

type Theme = { dark: boolean; c: Colors };

const ThemeContext = createContext<Theme>({ dark: false, c: palette.light });

export function TogetherThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Theme>(
    () => ({ dark: scheme === 'dark', c: scheme === 'dark' ? palette.dark : palette.light }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
