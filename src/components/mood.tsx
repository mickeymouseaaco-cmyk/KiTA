import { Pressable, View } from 'react-native';

import { MOODS, STRESS_LABELS } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';

import { Row, T } from './ui';

export function MoodPicker({ value, onChange }: { value?: string; onChange: (m: (typeof MOODS)[number]) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {MOODS.map((m) => {
        const on = value === m.label;
        return (
          <Pressable
            key={m.label}
            testID={`mood-${m.label}`}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ checked: on }}
            onPress={() => {
              haptic.tap();
              onChange(m);
            }}
            style={({ pressed }) => ({
              width: '23%',
              flexGrow: 1,
              minHeight: 80,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              backgroundColor: on ? c.primarySoft : c.surfaceAlt,
              borderWidth: 2,
              borderColor: on ? c.primary : 'transparent',
              opacity: pressed ? 0.8 : 1,
            })}>
            <T style={{ fontSize: 30, lineHeight: 38 }} accessibilityElementsHidden>
              {m.emoji}
            </T>
            <T variant="small" color={on ? c.primary : c.textMuted}>
              {m.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Stress 1 to 5 as five big, calm steps instead of a fiddly slider. */
export function StressPicker({ value, onChange }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Stress level"
        accessibilityValue={{ min: 1, max: 5, now: value, text: `${value}, ${STRESS_LABELS[value as 1]}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && value < 5) onChange((value + 1) as 1);
          if (e.nativeEvent.actionName === 'decrement' && value > 1) onChange((value - 1) as 1);
        }}>
        <Row gap={space.sm}>
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const on = n <= value;
            return (
              <Pressable
                key={n}
                testID={`stress-${n}`}
                accessibilityElementsHidden
                importantForAccessibility="no"
                onPress={() => {
                  haptic.tap();
                  onChange(n);
                }}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: radius.sm,
                  backgroundColor: on ? c.primary : c.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <T variant="bodyStrong" color={on ? c.onPrimary : c.textMuted}>
                  {n}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" muted>
          Light
        </T>
        <T variant="small" color={c.primary} style={{ fontFamily: 'Raleway_600SemiBold' }}>
          {STRESS_LABELS[value as 1]}
        </T>
        <T variant="small" muted>
          Heavy
        </T>
      </Row>
    </View>
  );
}
