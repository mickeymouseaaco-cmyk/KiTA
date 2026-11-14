/**
 * Friendly drawings, made from simple shapes in the current theme's colours,
 * so they suit every colour theme, light and dark, and cost no downloads.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

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
  if (look.flat) return <Ambient />;
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

/**
 * Modern look: a soft, blurred colour wash behind the whole page (iOS 26
 * style) for the glass widgets to float over. Pastel blooms of rose, lilac,
 * sky and peach that drift down the page; quiet, and calmer in dark mode.
 */
function Ambient() {
  const { c, dark } = useTheme();
  // Deeper in light mode, so the white glass cards stand clearly apart from it.
  const k = dark ? 0.26 : 0.95;
  const blooms: { id: string; cx: number; cy: number; rx: number; ry: number; color: string; o: number }[] = [
    { id: 'rose', cx: 92, cy: 2, rx: 66, ry: 28, color: dark ? '#FF5C8D' : '#F98DB0', o: 1 },
    { id: 'sky', cx: 4, cy: 8, rx: 62, ry: 26, color: dark ? '#5B6CFF' : '#93A9FA', o: 0.95 },
    { id: 'lilac', cx: 96, cy: 46, rx: 60, ry: 28, color: dark ? '#8B5CF6' : '#BFA2F7', o: 0.9 },
    { id: 'peach', cx: 2, cy: 64, rx: 58, ry: 26, color: dark ? '#FF8A5B' : '#FBB894', o: 0.85 },
    { id: 'mint', cx: 70, cy: 96, rx: 64, ry: 24, color: dark ? '#22C59A' : '#94E0C2', o: 0.8 },
  ];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', backgroundColor: dark ? c.bg : '#E9E4EF' }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          {blooms.map((b) => (
            <RadialGradient key={b.id} id={`bloom-${b.id}`} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fx={b.cx} fy={b.cy} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={b.color} stopOpacity={k * b.o} />
              <Stop offset="1" stopColor={b.color} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        {blooms.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100" height="100" fill={`url(#bloom-${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}
