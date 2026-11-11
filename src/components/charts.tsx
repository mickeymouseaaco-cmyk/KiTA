import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { shortWeekday } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';

import { T } from './ui';

export function ProgressRing({
  value,
  goal,
  size = 148,
  stroke = 14,
  label,
  color,
}: {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** Ring colour (defaults to the theme's). */
  color?: string;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Steps'}
      accessibilityValue={{ min: 0, max: goal, now: Math.min(value, goal), text: `${value.toLocaleString()} of ${goal.toLocaleString()} steps` }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ringTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.ring}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <T variant="title">{value.toLocaleString()}</T>
      <T variant="small" muted>
        of {goal.toLocaleString()}
      </T>
    </View>
  );
}

/**
 * Weekly bars. Missed days are simply short and soft, never marked as "failed".
 * Each bar also carries its value as text for screen readers.
 */
export function WeekBars({
  days,
  values,
  goal,
  height = 96,
  color,
}: {
  days: string[];
  values: (number | undefined)[];
  goal: number;
  height?: number;
  /** Colour for days that reached the goal, and today (defaults to the theme's). */
  color?: string;
}) {
  const { c } = useTheme();
  const max = Math.max(goal, ...values.map((v) => v ?? 0), 1);
  return (
    <View
      accessible
      accessibilityLabel={`Steps this week: ${days
        .map((d, i) => `${shortWeekday(d)} ${(values[i] ?? 0).toLocaleString()}`)
        .join(', ')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm }}>
      {days.map((d, i) => {
        const v = values[i] ?? 0;
        const h = Math.max(6, (v / max) * height);
        const isToday = i === days.length - 1;
        return (
          <View key={d} style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
            <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
              <View
                style={{
                  width: '70%',
                  maxWidth: 28,
                  height: h,
                  borderRadius: radius.sm,
                  backgroundColor: v >= goal ? (color ?? c.ring) : isToday ? (color ?? c.primary) : c.primarySoft,
                  opacity: color && isToday && v < goal ? 0.75 : 1,
                }}
              />
            </View>
            <T variant="label" muted={!isToday} color={isToday ? c.primary : undefined}>
              {shortWeekday(d)}
            </T>
          </View>
        );
      })}
    </View>
  );
}
