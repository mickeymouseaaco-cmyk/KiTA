import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { radius, space, touch, type as typeScale, useTheme } from '@/theme';

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
  const { c, look } = useTheme();
  const heading = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        typeScale[variant],
        heading && { fontFamily: look.headingFont },
        heading && look.name === 'professional' && { letterSpacing: -0.2 },
        { color: color ?? (muted ? c.textMuted : c.text) },
        center && { textAlign: 'center' },
        style as StyleProp<TextStyle>,
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
  const { c } = useTheme();
  const inner = [styles.screenContent, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          <View style={styles.maxWidth}>{children}</View>
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
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: c.border, borderRadius: look.cardRadius },
        look.outlined
          ? { borderWidth: look.cardBorder, borderColor: c.text, boxShadow: `4px 4px 0px ${c.primary}` }
          : look.softShadow && !dark
            ? styles.cardShadow
            : { borderWidth: Math.max(1, look.cardBorder) },
        style,
      ]}>
      {children}
    </View>
  );
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
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { c, look, motion } = useTheme();
  const bg = { primary: c.primary, soft: c.primarySoft, ghost: 'transparent', quiet: c.surfaceAlt }[kind];
  const fg = { primary: c.onPrimary, soft: c.primary, ghost: c.primary, quiet: c.text }[kind];
  const off = disabled || loading;
  const pop = look.outlined && kind !== 'ghost' && !off;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderRadius: look.controlRadius, minHeight: small ? touch.min : touch.comfy, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: look.outlined ? c.text : c.border },
        pop && { borderWidth: 2, borderColor: c.text, boxShadow: pressed ? `1px 1px 0px ${c.text}` : `3px 3px 0px ${c.text}` },
        pressed && motion !== 'off' && { transform: pop ? [{ translateX: 2 }, { translateY: 2 }] : [{ scale: motion === 'lively' ? 0.95 : 0.98 }] },
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
  const { c } = useTheme();
  const bg = { quiet: c.surfaceAlt, primary: c.primary, heart: c.heartSoft, plain: 'transparent' }[tone];
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
      style={({ pressed }) => ({ alignItems: 'center', gap: 4, opacity: pressed ? 0.75 : 1 })}
      {...rest}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon color={fg} size={Math.round(size * 0.44)} strokeWidth={2.2} fill={active && tone === 'heart' ? c.heart : 'transparent'} />
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
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surfaceAlt,
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
  const { c } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceAlt }]}>
        <Icon color={c.primary} size={28} strokeWidth={1.8} />
      </View>
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
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { c, look } = useTheme();
  const r = look.controlRadius;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segment, { backgroundColor: c.surfaceAlt, borderRadius: r }, look.outlined && { borderWidth: 2, borderColor: c.text }]}>
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
            style={[styles.segmentItem, { borderRadius: r >= radius.pill ? r : Math.max(4, r - 3) }, on && { backgroundColor: c.surface }, on && styles.cardShadow]}>
            <T variant="bodyStrong" color={on ? c.primary : c.textMuted}>
              {o.label}
            </T>
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
      <T variant="label" muted>
        {label.toUpperCase()}
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
  const { c, look } = useTheme();
  return {
    ...typeScale.body,
    color: c.text,
    backgroundColor: c.surface,
    borderColor: look.outlined ? c.text : c.border,
    borderWidth: look.outlined ? 2 : 1.5,
    borderRadius: look.name === 'professional' ? 8 : radius.md,
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
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
