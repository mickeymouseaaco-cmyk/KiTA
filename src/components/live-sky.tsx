/**
 * The living sky: a little window that shows the weather as it is right now,
 * drawn and animated. The sun's rays turn and glow, clouds drift at two
 * speeds, rain falls on a slant, lightning flashes in storms, stars twinkle
 * at night, haze rolls in fog. Colours follow the time of day (dawn, day,
 * dusk, night).
 *
 * Everything holds still when animations are off or the phone asks for
 * reduced motion; the picture stays.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { SkyKind } from '@/lib/flood-pure';
import { skyColors, skyLayers, type TimeOfDay } from '@/lib/sky-pure';
import { useTheme, type MotionLevel } from '@/theme';

const ND = Platform.OS !== 'web';

/** 0 → 1 forever (linear), or `still` when motion is off. */
function useLoop(motion: MotionLevel, ms: number, still = 0.5, ease = Easing.linear) {
  const [v] = useState(() => new Animated.Value(still));
  useEffect(() => {
    if (motion === 'off') {
      v.setValue(still);
      return;
    }
    v.setValue(0);
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: motion === 'lively' ? ms * 0.75 : ms, easing: ease, useNativeDriver: ND }));
    a.start();
    return () => a.stop();
  }, [motion, ms, still, v, ease]);
  return v;
}

const CLOUD = 'M18 46c-9 0-16-6-16-14s7-14 15-14c2-9 10-16 20-16 9 0 17 6 19 14 1 0 2 0 3 0 9 0 16 7 16 15s-7 15-16 15H18z';

function Cloud({ w, color, opacity }: { w: number; color: string; opacity: number }) {
  return (
    <Svg width={w} height={w * 0.6} viewBox="0 0 80 48">
      <Path d={CLOUD} fill={color} opacity={opacity} />
    </Svg>
  );
}

/** One cloud drifting across the whole sky, forever, starting at its own place. */
function DriftingCloud({ t, offset, width, y, w, color, opacity }: { t: Animated.Value; offset: number; width: number; y: number; w: number; color: string; opacity: number }) {
  const p = useMemo(() => Animated.modulo(Animated.add(t, offset), 1), [t, offset]);
  return (
    <Animated.View style={{ position: 'absolute', top: y, left: 0, transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-w, width] }) }] }}>
      <Cloud w={w} color={color} opacity={opacity} />
    </Animated.View>
  );
}

function RainDrop({ t, offset, x, height, heavy }: { t: Animated.Value; offset: number; x: number; height: number; heavy: boolean }) {
  const p = useMemo(() => Animated.modulo(Animated.add(t, offset), 1), [t, offset]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: -18,
        width: heavy ? 2 : 1.5,
        height: heavy ? 18 : 12,
        borderRadius: 1,
        backgroundColor: '#FFFFFF',
        opacity: p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.75, 0.6, 0] }),
        transform: [
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, height + 18] }) },
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.2] }) },
          { rotate: '12deg' },
        ],
      }}
    />
  );
}

function Star({ t, offset, x, y, r }: { t: Animated.Value; offset: number; x: number; y: number; r: number }) {
  const p = useMemo(() => Animated.modulo(Animated.add(t, offset), 1), [t, offset]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: '#FFFFFF',
        opacity: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] }),
      }}
    />
  );
}

/** A fixed, pseudo-random spread so the scene looks the same every time. */
function spread(n: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => ({ a: rnd(), b: rnd(), c: rnd() }));
}

export function LiveSky({
  kind,
  tod,
  height = 280,
  radius = 24,
  children,
  style,
  testID,
}: {
  kind: SkyKind;
  tod: TimeOfDay;
  height?: number;
  radius?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { motion } = useTheme();
  const [width, setWidth] = useState(0);
  const layers = skyLayers(kind, tod);
  const [top, bottom] = skyColors(kind, tod);
  const night = tod === 'night';

  const spin = useLoop(motion, 60_000, 0);
  const glow = useLoop(motion, 4_000, 0.5, Easing.inOut(Easing.sin));
  const slow = useLoop(motion, 70_000, 0.3);
  const fast = useLoop(motion, 38_000, 0.6);
  const fall = useLoop(motion, kind === 'drizzle' ? 1_400 : 800, 0.5);
  const fall2 = useLoop(motion, kind === 'drizzle' ? 1_700 : 1_000, 0.5);
  const twinkle = useLoop(motion, 3_200, 0.5, Easing.inOut(Easing.sin));
  const flash = useLoop(motion, 5_200, 0);
  const haze = useLoop(motion, 30_000, 0.5);

  const drops = useMemo(() => spread(layers.rain, 7), [layers.rain]);
  const stars = useMemo(() => spread(layers.stars, 3), [layers.stars]);
  const sunX = width * 0.74;
  const cloudColor = layers.darkClouds ? '#C9D2E0' : '#FFFFFF';
  const cloudBack = layers.darkClouds ? 0.55 : night ? 0.35 : 0.7;
  const cloudFront = layers.darkClouds ? 0.85 : night ? 0.5 : 0.95;

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: bottom }, style]}>
      <Svg width="100%" height={height} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`sky-bg-${kind}-${tod}-${height}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#sky-bg-${kind}-${tod}-${height})`} />
      </Svg>

      {width ? (
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }} accessible={false} importantForAccessibility="no-hide-descendants">
          {stars.map((s, i) => (
            <Star key={`s${i}`} t={twinkle} offset={s.c} x={s.a * width} y={s.b * height * 0.55} r={s.c > 0.7 ? 1.6 : 1} />
          ))}

          {layers.moon ? (
            <View style={{ position: 'absolute', left: sunX - 24, top: 26 }}>
              <Svg width={48} height={48} viewBox="0 0 48 48">
                <Defs>
                  <RadialGradient id="moon-glow" cx="24" cy="24" r="24" gradientUnits="userSpaceOnUse">
                    <Stop offset="0.5" stopColor="#FFF6D8" stopOpacity="0.35" />
                    <Stop offset="1" stopColor="#FFF6D8" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx="24" cy="24" r="24" fill="url(#moon-glow)" />
                <Circle cx="24" cy="24" r="12" fill="#FFF3CF" />
                <Circle cx="20" cy="21" r="2.4" fill="#E9DDB4" />
                <Circle cx="28" cy="27" r="1.8" fill="#E9DDB4" />
              </Svg>
            </View>
          ) : null}

          {layers.sun ? (
            <View style={{ position: 'absolute', left: sunX - 60, top: -18, width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', opacity: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.9, 0.55] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.95, 1.06, 0.95] }) }] }}>
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  <Defs>
                    <RadialGradient id={`sun-glow-${tod}`} cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
                      <Stop offset="0.25" stopColor={tod === 'day' ? '#FFF4B8' : '#FFD9A0'} stopOpacity="0.9" />
                      <Stop offset="1" stopColor="#FFE38A" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="60" cy="60" r="60" fill={`url(#sun-glow-${tod})`} />
                </Svg>
              </Animated.View>
              <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                <Svg width={92} height={92} viewBox="0 0 92 92">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Rect key={i} x="44.5" y="2" width="3" height="12" rx="1.5" fill="#FFE68A" opacity={0.85} transform={`rotate(${i * 30} 46 46)`} />
                  ))}
                </Svg>
              </Animated.View>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: tod === 'day' ? '#FFD84D' : '#FFB86B', boxShadow: '0px 0px 24px rgba(255, 214, 90, 0.9)' }} />
            </View>
          ) : null}

          {layers.fog
            ? [0.2, 0.45, 0.7].map((y, i) => (
                <Animated.View
                  key={`f${i}`}
                  style={{
                    position: 'absolute',
                    left: -width * 0.3,
                    top: height * y,
                    width: width * 1.6,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: '#FFFFFF',
                    opacity: 0.22,
                    transform: [{ translateX: haze.interpolate({ inputRange: [0, 0.5, 1], outputRange: [i % 2 ? -30 : 30, i % 2 ? 30 : -30, i % 2 ? -30 : 30] }) }],
                  }}
                />
              ))
            : null}

          {/* Clouds: a slow far layer and a quicker near one. */}
          {Array.from({ length: Math.ceil(layers.clouds / 2) }, (_, i) => (
            <DriftingCloud key={`cb${i}`} t={slow} offset={i / Math.ceil(layers.clouds / 2) + 0.15} width={width} y={14 + i * 22} w={90} color={cloudColor} opacity={cloudBack} />
          ))}
          {Array.from({ length: Math.floor(layers.clouds / 2) || (layers.clouds ? 1 : 0) }, (_, i) => (
            <DriftingCloud key={`cf${i}`} t={fast} offset={i / Math.max(1, Math.floor(layers.clouds / 2)) + 0.55} width={width} y={50 + i * 26} w={layers.darkClouds ? 150 : 124} color={cloudColor} opacity={cloudFront} />
          ))}

          {drops.map((d, i) => (
            <RainDrop key={`r${i}`} t={i % 2 ? fall : fall2} offset={d.b} x={d.a * (width + height * 0.2)} height={height} heavy={kind !== 'drizzle'} />
          ))}

          {layers.lightning ? (
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#FFFFFF',
                opacity: flash.interpolate({ inputRange: [0, 0.03, 0.06, 0.09, 0.12, 1], outputRange: [0, 0.55, 0.05, 0.4, 0, 0] }),
              }}>
              <Svg width={60} height={110} viewBox="0 0 60 110" style={{ position: 'absolute', left: width * 0.28, top: 40 }}>
                <Path d="M34 0 L10 58 H28 L18 110 L52 42 H32 L44 0 Z" fill="#FFF7B0" />
              </Svg>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* Content sits on a soft shade so white text stays readable on any sky. */}
      <Svg width="100%" height={height} style={{ position: 'absolute', pointerEvents: 'none' }}>
        <Defs>
          <LinearGradient id="sky-shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.28" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#sky-shade)" />
      </Svg>
      {children}
    </View>
  );
}
