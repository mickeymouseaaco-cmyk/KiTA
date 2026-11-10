/**
 * Weather at a glance: icons for every sky, and a small animated scene for the
 * top of the weather screen. Follows Look & feel → Animations (and the phone's
 * Reduce motion setting): off means a still picture.
 */
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Info,
  Sun,
  Tornado,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import type { FloodLevel, SkyKind, WarningKind } from '@/lib/flood';
import { useTheme, type MotionLevel } from '@/theme';

const SKY_ICON: Record<SkyKind, LucideIcon> = {
  sun: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
};

export const WARNING_ICON: Record<WarningKind, LucideIcon> = {
  storm: CloudLightning,
  rain: CloudRainWind,
  wind: Wind,
  cyclone: Tornado,
  flood: Waves,
  other: Info,
};

export function SkyIcon({ kind, size = 24, color }: { kind: SkyKind; size?: number; color?: string }) {
  const { c } = useTheme();
  const Icon = SKY_ICON[kind];
  return <Icon color={color ?? c.text} size={size} strokeWidth={1.8} />;
}

const native = Platform.OS !== 'web';

/** 0 → 1 forever, or a fixed value when motion is off. */
function useLoop(motion: MotionLevel, ms: number, still = 0.5) {
  const [v] = useState(() => new Animated.Value(still));
  useEffect(() => {
    if (motion === 'off') {
      v.setValue(still);
      return;
    }
    v.setValue(0);
    const anim = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: motion === 'lively' ? ms * 0.6 : ms, easing: Easing.linear, useNativeDriver: native }),
    );
    anim.start();
    return () => anim.stop();
  }, [motion, ms, still, v]);
  return v;
}

function Drop({ x, delay, color, motion, height }: { x: number; delay: number; color: string; motion: MotionLevel; height: number }) {
  const t = useLoop(motion, 900, 0.5);
  // Each drop starts at its own point in the cycle, so they don't fall in step.
  const shifted = useMemo(() => Animated.modulo(Animated.add(t, delay), 1), [t, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: 3,
        height: 10,
        borderRadius: 2,
        backgroundColor: color,
        opacity: shifted.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
        transform: [{ translateY: shifted.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }],
      }}
    />
  );
}

/** The scene at the top of the weather screen. */
export function SkyScene({ kind, level, color, size = 88 }: { kind: SkyKind; level: FloodLevel; color: string; size?: number }) {
  const { motion } = useTheme();
  const spin = useLoop(motion, 24_000, 0);
  const drift = useLoop(motion, 5_000, 0.5);
  const flash = useLoop(motion, 2_600, 0);
  const wave = useLoop(motion, 3_000, 0);

  const rainy = kind === 'rain' || kind === 'drizzle' || kind === 'storm';
  const drops = rainy ? (kind === 'drizzle' ? 4 : motion === 'lively' ? 9 : 6) : 0;
  const Icon = SKY_ICON[kind];
  const sway = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-4, 4, -4] });

  return (
    <View style={{ width: size + 24, height: size + 28, alignItems: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          transform:
            kind === 'sun' ? [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] : [{ translateX: sway }],
          opacity: kind === 'storm' ? flash.interpolate({ inputRange: [0, 0.08, 0.16, 0.24, 1], outputRange: [1, 0.35, 1, 0.5, 1] }) : 1,
        }}>
        <Icon color={color} size={size} strokeWidth={1.4} />
      </Animated.View>
      {drops ? (
        <View style={{ position: 'absolute', top: size * 0.62, left: size * 0.22, width: size * 0.7, height: 34 }}>
          {Array.from({ length: drops }, (_, i) => (
            <Drop key={i} x={(i * size * 0.7) / drops} delay={(i * 0.37) % 1} color={color} motion={motion} height={28} />
          ))}
        </View>
      ) : null}
      {level !== 'calm' ? (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            transform: [{ translateX: wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-6, 6, -6] }) }],
          }}>
          <Waves color={color} size={size * 0.5} strokeWidth={1.8} />
        </Animated.View>
      ) : null}
    </View>
  );
}
