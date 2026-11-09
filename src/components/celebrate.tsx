/**
 * Confetti for small wins and couple streaks. Soft colors, short, and skipped
 * entirely when Reduce Motion is on (a gentle haptic and message instead).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Platform, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { T } from './ui';

type Celebrate = (message?: string) => void;
const CelebrateContext = createContext<Celebrate>(() => {});

const PIECES = 36;

type Piece = { x: number; drift: number; delay: number; size: number; color: string; spin: number };

function Confetti({ pieces, onDone }: { pieces: Piece[]; onDone: () => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  const { height } = Dimensions.get('window');
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(onDone);
  }, [progress, onDone]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} testID="confetti">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size * 0.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height * (0.6 + p.delay)] }) },
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const [burst, setBurst] = useState<{ id: number; pieces: Piece[] } | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  }, []);

  const celebrate = useCallback<Celebrate>(
    (message) => {
      haptic.success();
      if (message) toast(message);
      if (reduceMotion.current) return;
      const colors = [c.heart, c.primary, c.ring, '#F6C97A', '#9CC7F0', '#F4A6B8'];
      const pieces = Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.4,
        size: 8 + Math.random() * 6,
        color: colors[i % colors.length],
        spin: (Math.random() - 0.5) * 720,
      }));
      setBurst({ id: Date.now(), pieces });
    },
    [c, toast],
  );

  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {burst ? <Confetti key={burst.id} pieces={burst.pieces} onDone={() => setBurst(null)} /> : null}
    </CelebrateContext.Provider>
  );
}

export function useCelebrate(): Celebrate {
  return useContext(CelebrateContext);
}

/** Small inline badge used next to celebrations in lists. */
export function CelebrationLine({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.butter, borderRadius: 14, paddingHorizontal: space.md, paddingVertical: space.sm }}>
      <T color={c.onButter}>{text}</T>
    </View>
  );
}
