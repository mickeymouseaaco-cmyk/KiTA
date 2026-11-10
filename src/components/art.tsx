/**
 * Friendly drawings, made from simple shapes in the current theme's colours,
 * so they suit every colour theme, light and dark, and cost no downloads.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Two round friends leaning in, with a heart between them. Sign-in, pairing, Home. */
export function CoupleArt({ size = 140 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 0.78 }}>
      <Svg width={size} height={size * 0.78} viewBox="0 0 180 140">
        <Ellipse cx="90" cy="128" rx="70" ry="8" fill={c.primarySoft} />
        {/* left friend */}
        <Circle cx="62" cy="78" r="40" fill={c.peach} />
        <Circle cx="50" cy="74" r="3.5" fill={c.onPeach} />
        <Circle cx="70" cy="74" r="3.5" fill={c.onPeach} />
        <Path d="M52 86 Q60 93 68 86" stroke={c.onPeach} strokeWidth="3" fill="none" strokeLinecap="round" />
        <Circle cx="44" cy="85" r="5" fill={c.heartSoft} />
        {/* right friend */}
        <Circle cx="118" cy="80" r="38" fill={c.sage} />
        <Circle cx="108" cy="76" r="3.5" fill={c.onSage} />
        <Circle cx="127" cy="76" r="3.5" fill={c.onSage} />
        <Path d="M110 88 Q118 94 126 88" stroke={c.onSage} strokeWidth="3" fill="none" strokeLinecap="round" />
        <Circle cx="136" cy="86" r="5" fill={c.heartSoft} />
        {/* heart */}
        <Path
          d="M90 44 C84 34 68 36 70 50 C72 60 90 70 90 70 C90 70 108 60 110 50 C112 36 96 34 90 44 Z"
          fill={c.heart}
        />
        <Circle cx="150" cy="30" r="4" fill={c.butter} />
        <Circle cx="30" cy="36" r="3" fill={c.sky} />
        <Path d="M146 52 l4 -4 M150 52 l-4 -4" stroke={c.ring} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** A soft blob behind an icon: the friendly frame for empty screens. */
export function Blob({ size = 96, children }: { size?: number; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Path
          d="M52 6 C74 6 94 22 94 48 C94 74 76 94 50 94 C24 94 6 76 7 50 C8 24 28 6 52 6 Z"
          fill={c.primarySoft}
        />
        <Circle cx="84" cy="18" r="6" fill={c.heartSoft} />
        <Circle cx="14" cy="80" r="4" fill={c.butter} />
      </Svg>
      {/* Above the blob: positioned shapes paint over plain content on the web. */}
      <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
    </View>
  );
}

/** The warm colour wash at the top of every page. */
export function PageWash({ height = 320 }: { height?: number }) {
  const { c, look } = useTheme();
  if (look.name === 'professional') return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <Svg width="100%" height={height} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primarySoft} stopOpacity="1" />
            <Stop offset="0.55" stopColor={c.heartSoft} stopOpacity="0.35" />
            <Stop offset="1" stopColor={c.bg} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#wash)" />
      </Svg>
    </View>
  );
}
