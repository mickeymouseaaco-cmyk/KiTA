/**
 * Home-screen widgets in the spirit of iOS 26: frosted-glass tiles floating
 * over a soft colour wash, each with a faint pastel tint of its own colour, a
 * small caption and one big glanceable number. Swipeable smart stacks hold
 * several widgets in one spot.
 */
import type { LucideIcon } from 'lucide-react-native';
import { Children, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { haptic } from '@/lib/haptics';
import { useTheme, vivid, type VividName } from '@/theme';

import { Row, T } from './ui';

const ND = Platform.OS !== 'web';
export const WIDGET_RADIUS = 28;
export const WIDGET_GAP = 14;

/** 'surface' is untinted glass; a vivid name tints the glass with that colour. */
export type WidgetFill = VividName | 'surface' | 'ink';

/** The deeper shade of a tint, for icons, rings and small accents. */
export function tintOf(fill: WidgetFill, dark = false): string {
  if (fill === 'surface') return dark ? '#C9C3D6' : '#6B6478';
  if (fill === 'ink') return dark ? '#B9A8FF' : '#6F5BD8';
  return dark ? vivid[fill][0] : vivid[fill][1];
}

/** Frosted glass (web blurs what's behind; elsewhere it's a soft translucent sheet). */
export function glassStyle(dark: boolean): ViewStyle {
  return {
    backgroundColor: dark ? 'rgba(34,32,44,0.66)' : 'rgba(255,255,255,0.8)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)' } as ViewStyle) : null),
  };
}

let gradientCount = 0;

/** The tile's background: glass, washed with a faint pastel tint and a highlight along the top. */
function Fill({ fill }: { fill: WidgetFill }) {
  const { dark } = useTheme();
  const [id] = useState(() => `wg-${++gradientCount}`);
  const tint = fill === 'surface' ? null : fill === 'ink' ? '#8B7CF6' : vivid[fill][0];
  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, glassStyle(dark)]}>
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tint ?? '#FFFFFF'} stopOpacity={tint ? (dark ? 0.2 : 0.26) : 0} />
            <Stop offset="1" stopColor={tint ?? '#FFFFFF'} stopOpacity={tint ? (dark ? 0.04 : 0.06) : 0} />
          </LinearGradient>
          <LinearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.06 : 0.5} />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-t)`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-h)`} />
      </Svg>
    </View>
  );
}

/** A press that sinks a little, like iOS. */
function usePressScale() {
  const { motion } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => {
    if (motion === 'off') return;
    Animated.spring(scale, { toValue: v, friction: v < 1 ? 9 : 5, tension: v < 1 ? 420 : 240, useNativeDriver: ND }).start();
  };
  return { scale, onPressIn: () => to(0.965), onPressOut: () => to(1) };
}

function frameStyle(dark: boolean): ViewStyle {
  return {
    borderRadius: WIDGET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // A hairline of light around the glass, and a soft, wide shadow under it.
    borderWidth: 1,
    borderColor: dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.85)',
    boxShadow: dark ? '0px 10px 30px rgba(0,0,0,0.38)' : '0px 12px 32px rgba(72,52,110,0.16), 0px 1px 3px rgba(72,52,110,0.10)',
  };
}

/**
 * One widget. `size="small"` is a square (half the width, in a WidgetRow);
 * `medium` is full width and short; or give your own height.
 */
export function Widget({
  fill = 'surface',
  size = 'medium',
  height,
  onPress,
  testID,
  accessibilityLabel,
  padded = true,
  style,
  children,
}: {
  fill?: WidgetFill;
  size?: 'small' | 'medium';
  height?: number;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { dark } = useTheme();
  const press = usePressScale();
  const shape: ViewStyle = size === 'small' ? { aspectRatio: 1, flex: 1 } : height ? { height } : { minHeight: 150 };
  const inner = (
    <>
      <Fill fill={fill} />
      <View style={{ flex: 1, padding: padded ? 16 : 0 }}>{children}</View>
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={[frameStyle(dark), shape, style]}>
        {inner}
      </View>
    );
  }
  return (
    <Animated.View style={[shape, { transform: [{ scale: press.scale }] }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[frameStyle(dark), { flex: 1 }]}>
        {inner}
      </Pressable>
    </Animated.View>
  );
}

/** Two small widgets side by side. */
export function WidgetRow({ children }: { children: ReactNode }) {
  return <Row style={{ gap: WIDGET_GAP, alignItems: 'stretch', marginBottom: WIDGET_GAP }}>{children}</Row>;
}

/** The little caption at the top of a widget: an icon and a word or two. */
export function WidgetCaption({ icon: Icon, label, fill = 'surface', color, right }: { icon: LucideIcon; label: string; fill?: WidgetFill; color?: string; right?: ReactNode }) {
  const { dark } = useTheme();
  const tint = color ?? tintOf(fill, dark);
  return (
    <Row gap={6} style={{ alignItems: 'center' }}>
      <Icon color={tint} size={15} strokeWidth={2.4} />
      <T variant="bodyStrong" numberOfLines={1} color={tint} style={{ flex: 1, fontSize: 13, lineHeight: 17, letterSpacing: 0.1 }}>
        {label}
      </T>
      {right}
    </Row>
  );
}

/** A big glanceable number or word. */
export function WidgetValue({ children, color, size = 34, testID, numberOfLines = 1 }: { children: ReactNode; color: string; size?: number; testID?: string; numberOfLines?: number }) {
  return (
    <T testID={testID} variant="heading" color={color} numberOfLines={numberOfLines} style={{ fontSize: size, lineHeight: Math.round(size * 1.12), letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
      {children}
    </T>
  );
}

/** A ring that fills toward a goal (Fitness-style), drawn for coloured tiles. */
export function WidgetRing({ pct, size = 56, stroke = 7, color = '#22C55E', track = 'rgba(34,197,94,0.18)', children }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ * p} ${circ}`} /> : null}
      </Svg>
      {children}
    </View>
  );
}

/**
 * A smart stack: several widgets in one spot. Swipe to flip between them;
 * the dots on the side show where you are, like iOS. `start` picks the page
 * that matters most right now.
 */
export function SmartStack({ height = 172, start = 0, testID, children }: { height?: number; start?: number; testID?: string; children: ReactNode }) {
  const { dark } = useTheme();
  const pages = Children.toArray(children).filter(Boolean);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(Math.min(start, pages.length - 1));
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const placed = useRef(false);
  return (
    <View
      testID={testID}
      style={[frameStyle(dark), glassStyle(dark), { height, marginBottom: WIDGET_GAP }]}
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        setW(width);
        if (!placed.current && start > 0) {
          placed.current = true;
          requestAnimationFrame(() => scroller.current?.scrollTo({ x: width * Math.min(start, pages.length - 1), animated: false }));
        }
      }}>
      {w ? (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / w);
            if (next !== page) {
              setPage(next);
              haptic.tap();
            }
          }}>
          {pages.map((p, i) => (
            <View key={i} style={{ width: w, height }}>
              {p}
            </View>
          ))}
        </ScrollView>
      ) : null}
      {pages.length > 1 ? (
        <View style={{ position: 'absolute', right: 7, top: 0, bottom: 0, justifyContent: 'center', gap: 4, pointerEvents: 'none' }}>
          {pages.map((_, i) => (
            <View key={i} style={{ width: 4, height: i === page ? 12 : 4, borderRadius: 2, backgroundColor: i === page ? (dark ? 'rgba(255,255,255,0.92)' : 'rgba(40,30,60,0.72)') : dark ? 'rgba(255,255,255,0.32)' : 'rgba(40,30,60,0.22)', boxShadow: '0px 0px 2px rgba(255,255,255,0.6)' }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A full-bleed page inside a smart stack (its own background, tappable). */
export function StackPage({ fill, onPress, testID, accessibilityLabel, children }: { fill: WidgetFill; onPress?: () => void; testID?: string; accessibilityLabel?: string; children: ReactNode }) {
  const body = (
    <>
      <Fill fill={fill} />
      <View style={{ flex: 1, padding: 16, paddingRight: 22 }}>{children}</View>
    </>
  );
  if (!onPress)
    return (
      <View testID={testID} style={{ flex: 1 }}>
        {body}
      </View>
    );
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={{ flex: 1 }}>
      {body}
    </Pressable>
  );
}
