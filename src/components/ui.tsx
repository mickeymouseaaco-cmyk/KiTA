import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';

import { Blob, PageWash } from './art';
import { radius, space, systemFont, touch, type as typeScale, useTheme } from '@/theme';

// ------------------------------------------------------------------ text

type Variant = keyof typeof typeScale;

export function T({
  variant = 'body',
  muted,
  color,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string; center?: boolean }) {
  const { c, look, textScale } = useTheme();
  const heading = variant === 'display' || variant === 'title' || variant === 'heading';
  const base = typeScale[variant];
  // Minimal look: the phone's own typeface, whatever font name a screen asked for.
  const asked = look.systemFont ? (StyleSheet.flatten(style as StyleProp<TextStyle>)?.fontFamily ?? (heading ? look.headingFont : base.fontFamily)) : undefined;
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        base,
        textScale !== 1 && { fontSize: Math.round(base.fontSize * textScale), lineHeight: Math.round(base.lineHeight * textScale) },
        heading && { fontFamily: look.headingFont },
        heading && (look.name === 'professional' || look.flat) && { letterSpacing: variant === 'display' ? -0.6 : -0.3 },
        { color: color ?? (muted ? c.textMuted : c.text) },
        center && { textAlign: 'center' },
        style as StyleProp<TextStyle>,
        systemFont(asked),
      ]}
    />
  );
}

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const { c, look } = useTheme();
  const inner = [styles.screenContent, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {/* The soft pastel wash sits behind every page, for the glass cards to float over. */}
      <PageWash />
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          <PageEnter style={styles.maxWidth}>{children}</PageEnter>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>
          <View style={[styles.maxWidth, { flex: 1 }]}>{children}</View>
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** A tone colour as see-through glass (a #rrggbb colour at about two-thirds strength). */
function glassTint(hex: string, dark: boolean): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return `${hex}${dark ? 'A8' : 'CC'}`;
}

export function Card({
  children,
  tone = 'surface',
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'lavender' | 'peach' | 'sage' | 'sky' | 'rose' | 'butter';
  style?: StyleProp<ViewStyle>;
}) {
  const { c, dark, look } = useTheme();
  const bg = {
    surface: c.surface,
    lavender: c.surfaceAlt,
    peach: c.peach,
    sage: c.sage,
    sky: c.sky,
    rose: c.heartSoft,
    butter: c.butter,
  }[tone];
  const appear = useAppear();
  return (
    <Animated.View
      style={[
        appear,
        styles.card,
        { backgroundColor: bg, borderColor: c.border, borderRadius: look.cardRadius },
        look.flat
          ? {
              // Modern look: frosted glass over the page's pastel wash; tones tint the glass.
              backgroundColor: tone === 'surface' ? (dark ? 'rgba(34,32,44,0.66)' : 'rgba(255,255,255,0.8)') : glassTint(bg, dark),
              ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)' } as ViewStyle) : null),
              borderRadius: 24,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.85)',
              boxShadow: dark ? '0px 10px 30px rgba(0,0,0,0.32)' : '0px 1px 3px rgba(72,52,110,0.10), 0px 12px 32px rgba(72,52,110,0.15)',
            }
          : look.outlined
          ? { borderWidth: look.cardBorder, borderColor: c.text, boxShadow: `4px 4px 0px ${c.primary}` }
          : look.softShadow && !dark
            ? styles.cardShadow
            : { borderWidth: Math.max(1, look.cardBorder) },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

/** Modern look: each page fades and rises a touch as it opens (still when animations are off). */
function PageEnter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { look, motion } = useTheme();
  const on = look.flat && motion !== 'off';
  const [v] = useState(() => new Animated.Value(on ? 0 : 1));
  useEffect(() => {
    if (!on) return;
    Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [on, v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{children}</Animated.View>;
}

/** A quiet placeholder with a slow shimmer, in the shape of what's loading. */
export function Skeleton({ height = 16, width = '100%', radius: r = 10, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c, motion } = useTheme();
  const [v] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (motion === 'off') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(v, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion, v]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: r, backgroundColor: c.surfaceAlt, opacity: v }, style]} />;
}

/** A page-shaped skeleton: a header line and a few cards. */
export function SkeletonPage() {
  return (
    <View accessibilityLabel="Loading" style={{ gap: space.lg, padding: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <Skeleton height={26} width="55%" />
      <Skeleton height={120} radius={20} />
      <Skeleton height={84} radius={20} />
      <Skeleton height={84} radius={20} />
    </View>
  );
}

/** Content settles in softly when it appears (skipped when animations are off). */
export function useAppear() {
  const { motion } = useTheme();
  const [v] = useState(() => new Animated.Value(motion === 'off' ? 1 : 0));
  useEffect(() => {
    if (motion === 'off') return;
    Animated.timing(v, { toValue: 1, duration: motion === 'lively' ? 320 : 260, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [motion, v]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [motion === 'lively' ? 12 : 6, 0] }) }],
  };
}

/** A visible keyboard focus ring (web), so it's always clear where you are. */
export function focusRing(focused: boolean | undefined, color: string): ViewStyle | null {
  return focused && Platform.OS === 'web' ? { outlineWidth: 3, outlineStyle: 'solid', outlineColor: color, outlineOffset: 2 } : null;
}

export function Row({ children, gap = space.md, style, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function Gap({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

// --------------------------------------------------------------- buttons

type ButtonKind = 'primary' | 'soft' | 'ghost' | 'quiet';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon: Icon,
  loading,
  disabled,
  small,
  style,
  accessibilityHint,
  testID,
  hint,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  /** Shown under the button while it's disabled, e.g. "Write something first". */
  hint?: string;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { c, look, motion } = useTheme();
  const waiting = disabled && !loading;
  const bg = waiting && kind === 'primary' ? c.surfaceAlt : { primary: c.primary, soft: c.primarySoft, ghost: 'transparent', quiet: c.surfaceAlt }[kind];
  const fg = waiting && kind === 'primary' ? c.textMuted : { primary: c.onPrimary, soft: c.primary, ghost: c.primary, quiet: c.text }[kind];
  const off = disabled || loading;
  const pop = look.outlined && kind !== 'ghost' && !off;
  const button = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={waiting && hint ? hint : accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        styles.button,
        look.flat && Platform.OS === 'web' && ({ transitionProperty: 'transform, opacity, box-shadow', transitionDuration: '140ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' } as object),
        look.flat && kind === 'primary' && !off && { boxShadow: hovered && !pressed ? '0px 6px 18px rgba(16, 18, 30, 0.22)' : '0px 2px 8px rgba(16, 18, 30, 0.16)' },
        {
          backgroundColor: bg,
          borderRadius: look.controlRadius,
          minHeight: small ? touch.min : touch.comfy,
          opacity: waiting ? (kind === 'primary' ? 1 : 0.5) : loading ? 0.8 : pressed ? 0.85 : 1,
        },
        waiting && kind === 'primary' && { borderWidth: 1.5, borderColor: c.border, borderStyle: 'dashed' },
        focusRing(focused, c.primary),
        kind === 'ghost' && { borderWidth: 1.5, borderColor: look.outlined ? c.text : c.border },
        pop && { borderWidth: 2, borderColor: c.text, boxShadow: pressed ? `1px 1px 0px ${c.text}` : `3px 3px 0px ${c.text}` },
        pressed && motion !== 'off' && { transform: pop ? [{ translateX: 2 }, { translateY: 2 }] : [{ scale: motion === 'lively' ? 0.95 : look.flat ? 0.97 : 0.98 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={space.sm}>
          {Icon ? <Icon color={fg} size={20} strokeWidth={2.2} /> : null}
          <T variant="bodyStrong" color={fg}>
            {label}
          </T>
        </Row>
      )}
    </Pressable>
  );
  if (!(waiting && hint)) return button;
  return (
    <View style={{ gap: 6 }}>
      {button}
      <T variant="small" muted center>
        {hint}
      </T>
    </View>
  );
}

/** Icon button with a visible or accessible label. Always at least 48×48. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'quiet',
  size = touch.min,
  showLabel,
  active,
  testID,
  ...rest
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  tone?: 'quiet' | 'primary' | 'heart' | 'plain';
  size?: number;
  showLabel?: boolean;
  active?: boolean;
  testID?: string;
} & Omit<PressableProps, 'onPress' | 'style' | 'children'>) {
  const { c, look } = useTheme();
  // Minimal look: bare icons, like a navigation bar; a soft disc only when switched on.
  const bg = look.flat && tone === 'quiet' ? (active ? c.surfaceAlt : 'transparent') : { quiet: c.surfaceAlt, primary: c.primary, heart: c.heartSoft, plain: 'transparent' }[tone];
  const fg = { quiet: c.text, primary: c.onPrimary, heart: c.heart, plain: c.textMuted }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      hitSlop={8}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        { alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1, borderRadius: size },
        look.flat && hovered && !pressed && { backgroundColor: c.surfaceAlt },
        look.flat && Platform.OS === 'web' && ({ transitionProperty: 'opacity, background-color', transitionDuration: '140ms' } as object),
        focusRing(focused, c.primary),
      ]}
      {...rest}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={fg} size={Math.round(size * (look.flat ? 0.5 : 0.44))} strokeWidth={look.flat ? 1.9 : 2.2} fill={active && tone === 'heart' ? c.heart : 'transparent'} />
      </View>
      {showLabel ? (
        <T variant="small" muted>
          {label}
        </T>
      ) : null}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { c, look } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
        focusRing(focused, c.primary),
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderWidth: 1,
          borderColor: selected ? c.primary : c.border,
          borderRadius: look.name === 'professional' ? 8 : radius.pill,
          opacity: pressed ? 0.8 : 1,
        },
        look.outlined && { borderWidth: 1.5, borderColor: c.text },
      ]}>
      <T variant="small" color={selected ? c.onPrimary : c.text} style={{ fontFamily: 'Raleway_600SemiBold' }}>
        {label}
      </T>
    </Pressable>
  );
}

export function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled,
  testID,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <T variant="bodyStrong">{title}</T>
        {detail ? (
          <T variant="small" muted>
            {detail}
          </T>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.tap();
          onChange(v);
        }}
        trackColor={{ true: c.primary, false: c.ringTrack }}
        thumbColor={c.surface}
        {...(Platform.OS === 'web' ? ({ activeThumbColor: c.surface } as object) : null)}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

export function EmptyState({
  icon: Icon,
  line,
  action,
}: {
  icon: LucideIcon;
  line: string;
  action?: ReactNode;
}) {
  const { c, look } = useTheme();
  return (
    <View style={styles.empty}>
      {look.flat ? (
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 10px 28px rgba(16, 18, 30, 0.07)' }}>
          <Icon color={c.text} size={30} strokeWidth={1.6} />
        </View>
      ) : (
        <Blob size={104}>
          <Icon color={c.primary} size={36} strokeWidth={1.7} />
        </Blob>
      )}
      <T muted center style={{ maxWidth: 300 }}>
        {line}
      </T>
      {action}
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; badge?: number }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { c, look } = useTheme();
  const r = look.controlRadius;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segment, { backgroundColor: c.surfaceAlt, borderRadius: r }, look.flat && { padding: 3 }, look.outlined && { borderWidth: 2, borderColor: c.text }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[
              styles.segmentItem,
              { borderRadius: r >= radius.pill ? r : Math.max(4, r - 3) },
              look.flat && { minHeight: 36 },
              on && { backgroundColor: look.flat ? c.bg : c.surface },
              on && (look.flat ? { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.14)' } : styles.cardShadow),
            ]}>
            <T variant={look.flat ? 'small' : 'bodyStrong'} color={on ? c.primary : c.textMuted} style={look.flat ? { fontFamily: 'Raleway_600SemiBold' } : undefined}>
              {o.label}
            </T>
            {o.badge ? (
              <View style={{ marginLeft: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.heart, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="small" color="#FFFFFF" style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
                  {o.badge}
                </T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.sm, marginTop: space.sm }}>
      <T variant="heading" accessibilityRole="header">
        {children}
      </T>
      {right}
    </Row>
  );
}

export function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <T variant="bodyStrong" style={{ fontSize: 15 }}>
        {label}
      </T>
      {children}
      {helper ? (
        <T variant="small" muted>
          {helper}
        </T>
      ) : null}
    </View>
  );
}

export function useInputStyle(): TextStyle {
  const { c, look, textScale } = useTheme();
  return {
    ...typeScale.body,
    ...(look.systemFont ? systemFont(typeScale.body.fontFamily) : null),
    // At least 16px on the web: smaller text boxes make iPhone zoom the page in when tapped.
    fontSize: Platform.OS === 'web' ? Math.max(16, Math.round(typeScale.body.fontSize * textScale)) : Math.round(typeScale.body.fontSize * textScale),
    lineHeight: Math.round(typeScale.body.lineHeight * textScale),
    color: c.text,
    backgroundColor: c.surface,
    borderColor: look.outlined ? c.text : c.border,
    borderWidth: look.outlined ? 2 : look.flat ? 1 : 1.5,
    borderRadius: look.name === 'professional' ? 8 : look.flat ? look.controlRadius : radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: touch.comfy,
  };
}

const styles = StyleSheet.create({
  screenContent: { padding: space.lg, paddingBottom: space.xxl * 2 },
  maxWidth: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { borderRadius: radius.lg, padding: space.xl - 4 },
  cardShadow: { boxShadow: '0px 4px 16px rgba(90, 70, 120, 0.08)' },
  button: { borderRadius: radius.pill, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: touch.comfy, paddingVertical: space.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
