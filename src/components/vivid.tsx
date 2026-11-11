/**
 * Bright, tappable tiles (Home shortcuts, meals) and a little burst of hearts
 * for happy moments. Press: a quick squish and a springy return. Everything
 * holds still when animations are off or the phone asks for reduced motion.
 */
import type { LucideIcon } from 'lucide-react-native';
import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { haptic } from '@/lib/haptics';
import { useTheme, vivid, type VividName } from '@/theme';

import { T, focusRing } from './ui';

const ND = Platform.OS !== 'web';

/** A rounded square filled with a soft top-to-bottom gradient, with a gentle highlight. */
export function VividSquare({ color, size = 58, radius = 18, children }: { color: VividName; size?: number; radius?: number; children?: ReactNode }) {
  const [top, bottom] = vivid[color];
  const id = `v-${color}-${size}`;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', boxShadow: `0px 6px 16px ${bottom}40` }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
        <Rect x="0" y="0" width={size} height={size * 0.5} fill="#FFFFFF" opacity={0.1} />
      </Svg>
      <View style={{ zIndex: 1 }}>{children}</View>
    </View>
  );
}

export type BurstHandle = { burst: () => void };

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.3 5c2 0 3.3 1.1 4 2.3h3.4C14.4 6.1 15.7 5 17.7 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z';

/** Hearts that float up and fade: call `burst()` after a happy moment. */
export const HeartBurst = forwardRef<BurstHandle, { color?: string }>(function HeartBurst({ color = '#FF5C8D' }, ref) {
  const { motion } = useTheme();
  const [v] = useState(() => new Animated.Value(0));
  const [shown, setShown] = useState(false);
  useImperativeHandle(ref, () => ({
    burst() {
      if (motion === 'off') return;
      setShown(true);
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start(() => setShown(false));
    },
  }));
  if (!shown) return null;
  const hearts = [
    { x: -16, y: -46, s: 14, r: '-14deg' },
    { x: 2, y: -62, s: 18, r: '6deg' },
    { x: 18, y: -42, s: 12, r: '16deg' },
  ];
  return (
    <View style={{ position: 'absolute', left: '50%', top: 24, width: 0, height: 0, pointerEvents: 'none' }}>
      {hearts.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: -h.s / 2,
            top: -h.s / 2,
            opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, h.x] }) },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, h.y] }) },
              { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 0.9] }) },
              { rotate: h.r },
            ],
          }}>
          <Svg width={h.s} height={h.s} viewBox="0 0 24 24">
            <Path d={HEART} fill={color} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

/**
 * A bright shortcut: gradient square, white icon, label under it.
 * Squishes on press-in and springs back, so it feels like a real button.
 */
export const VividAction = forwardRef<
  BurstHandle,
  { icon: LucideIcon; label: string; color: VividName; onPress: () => void; testID?: string; size?: number; style?: StyleProp<ViewStyle>; detail?: string }
>(function VividAction({ icon: Icon, label, color, onPress, testID, size = 58, style, detail }, ref) {
  const { c, motion } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [bounce] = useState(() => new Animated.Value(0));
  const [hearts, setHearts] = useState<BurstHandle | null>(null);
  useImperativeHandle(ref, () => ({
    burst() {
      hearts?.burst();
      if (motion === 'off') return;
      bounce.setValue(0);
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
        Animated.spring(bounce, { toValue: 0, friction: 4, tension: 160, useNativeDriver: ND }),
      ]).start();
    },
  }));
  const press = (to: number) => {
    if (motion === 'off') return;
    Animated.spring(scale, { toValue: to, friction: to < 1 ? 8 : 4, tension: to < 1 ? 400 : 220, useNativeDriver: ND }).start();
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPressIn={() => press(0.88)}
      onPressOut={() => press(1)}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      hitSlop={4}
      style={({ focused }: { focused?: boolean }) => StyleSheet.flatten([{ alignItems: 'center', gap: 7, borderRadius: 18 }, focusRing(focused, c.primary), style])}>
      <Animated.View style={{ transform: [{ scale }, { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
        <VividSquare color={color} size={size} radius={Math.round(size * 0.31)}>
          <Icon color="#FFFFFF" size={Math.round(size * 0.44)} strokeWidth={2.3} />
        </VividSquare>
      </Animated.View>
      <T variant="small" numberOfLines={1} style={{ fontFamily: 'Raleway_600SemiBold', fontSize: 13 }}>
        {label}
      </T>
      <HeartBurst ref={setHearts} color={vivid[color][1]} />
    </Pressable>
  );
});
