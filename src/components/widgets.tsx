/**
 * Home-screen widgets, in the spirit of the latest iOS: soft, rounded tiles
 * with one big glanceable number or picture, a tiny caption, and swipeable
 * smart stacks. Colourful tiles use the vivid gradients; plain ones follow the
 * light/dark theme.
 */
import type { LucideIcon } from 'lucide-react-native';
import { Children, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { haptic } from '@/lib/haptics';
import { useTheme, vivid, type VividName } from '@/theme';

import { Row, T } from './ui';

const ND = Platform.OS !== 'web';
export const WIDGET_RADIUS = 26;
export const WIDGET_GAP = 14;

/** Rounded numbers, like iOS widgets (SF Pro Rounded where the system has it). */
export const rounded = Platform.OS === 'web' ? { fontFamily: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif' } : { fontFamily: undefined };

export type WidgetFill = VividName | 'surface' | 'ink';

/** Text colours that read well on each fill. */
export function onFill(fill: WidgetFill, c: { text: string; textMuted: string }) {
  if (fill === 'surface') return { strong: c.text, soft: c.textMuted };
  return { strong: '#FFFFFF', soft: 'rgba(255,255,255,0.82)' };
}

let gradientCount = 0;

/** The tile's background: a diagonal gradient with a soft glow, or the plain theme surface. */
function Fill({ fill }: { fill: WidgetFill }) {
  const { c, dark } = useTheme();
  const [id] = useState(() => `wg-${++gradientCount}`);
  if (fill === 'surface') return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface }} />;
  const [a, b] = fill === 'ink' ? (dark ? ['#2A2833', '#16151C'] : ['#2C2B33', '#141318']) : vivid[fill];
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`${id}-l`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
        <RadialGradient id={`${id}-r`} cx="0.15" cy="0" r="0.9">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={fill === 'ink' ? 0.1 : 0.28} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-l)`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-r)`} />
    </Svg>
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

function frameStyle(dark: boolean, fill: WidgetFill, border: string): ViewStyle {
  return {
    borderRadius: WIDGET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: dark ? '0px 6px 20px rgba(0,0,0,0.35)' : fill === 'surface' ? '0px 6px 22px rgba(30,20,40,0.08)' : `0px 10px 24px ${fill === 'ink' ? 'rgba(0,0,0,0.18)' : `${vivid[fill as VividName][1]}38`}`,
    borderWidth: fill === 'surface' ? 1 : 0,
    borderColor: border,
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
  const { c, dark } = useTheme();
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
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={[frameStyle(dark, fill, c.border), shape, style]}>
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
        style={[frameStyle(dark, fill, c.border), { flex: 1 }]}>
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
  const { c } = useTheme();
  const tone = onFill(fill, c);
  return (
    <Row gap={6} style={{ alignItems: 'center' }}>
      <Icon color={color ?? tone.strong} size={15} strokeWidth={2.6} />
      <T numberOfLines={1} color={color ?? tone.strong} style={{ flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: 0.1 }}>
        {label}
      </T>
      {right}
    </Row>
  );
}

/** A big glanceable number or word. */
export function WidgetValue({ children, color, size = 34, testID, numberOfLines = 1 }: { children: ReactNode; color: string; size?: number; testID?: string; numberOfLines?: number }) {
  return (
    <T testID={testID} color={color} numberOfLines={numberOfLines} style={[rounded, { fontSize: size, lineHeight: Math.round(size * 1.12), fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }]}>
      {children}
    </T>
  );
}

/** A ring that fills toward a goal (Fitness-style), drawn for coloured tiles. */
export function WidgetRing({ pct, size = 56, stroke = 7, color = '#FFFFFF', track = 'rgba(255,255,255,0.28)', children }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
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
  const { c, dark } = useTheme();
  const pages = Children.toArray(children).filter(Boolean);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(Math.min(start, pages.length - 1));
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const placed = useRef(false);
  return (
    <View
      testID={testID}
      style={[frameStyle(dark, 'ink', c.border), { height, marginBottom: WIDGET_GAP, backgroundColor: c.surface }]}
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
            <View key={i} style={{ width: 4, height: i === page ? 12 : 4, borderRadius: 2, backgroundColor: i === page ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)', boxShadow: '0px 0px 3px rgba(0,0,0,0.35)' }} />
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
