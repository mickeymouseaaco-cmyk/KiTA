/**
 * Our moods: a month, side by side. Your own moods (they're yours to see) and
 * only the moods your partner chose to share. Days without a mood are simply
 * empty: no gaps, no guilt.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, Gap, IconButton, Row, Screen, T } from '@/components/ui';
import { dayKey } from '@/lib/dates';
import { useMyDays, usePartnerDays } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  return { lead, keys: Array.from({ length: count }, (_, i) => dayKey(new Date(year, month, i + 1))) };
}

export default function MoodCalendar() {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { lead, keys } = useMemo(() => monthDays(cursor.y, cursor.m), [cursor]);
  const { days: mine } = useMyDays(uid, keys[0]);
  const { days: theirs } = usePartnerDays(cid, partnerId, keys[0]);
  const today = dayKey();
  const isCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  const label = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const shift = (d: number) =>
    setCursor(({ y, m }) => {
      const n = new Date(y, m + d, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });

  return (
    <Screen edges={['bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => shift(-1)} />
        <T variant="title" accessibilityRole="header">
          {label}
        </T>
        <View style={{ opacity: isCurrent ? 0.3 : 1 }}>
          <IconButton icon={ChevronRight} label="Next month" onPress={() => !isCurrent && shift(1)} />
        </View>
      </Row>
      <Gap h={space.md} />
      <Row gap={space.lg} style={{ justifyContent: 'center' }}>
        <Row gap={6}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.primarySoft }} />
          <T variant="small" muted>
            You
          </T>
        </Row>
        <Row gap={6}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.heartSoft }} />
          <T variant="small" muted>
            {partnerName} (shared)
          </T>
        </Row>
      </Row>
      <Gap h={space.md} />
      <Card style={{ padding: space.md }}>
        <View style={{ flexDirection: 'row' }}>
          {weekdays.map((w, i) => (
            <T key={i} variant="label" muted center style={{ flex: 1 }}>
              {w}
            </T>
          ))}
        </View>
        <Gap h={space.sm} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: lead }, (_, i) => (
            <View key={`lead-${i}`} style={{ width: `${100 / 7}%` }} />
          ))}
          {keys.map((k, i) => {
            const a = mine[k]?.mood;
            const b = theirs[k]?.mood;
            const isToday = k === today;
            return (
              <View
                key={k}
                testID={`cal-${k}`}
                accessible
                accessibilityLabel={`${k}. You: ${a ? a.label : 'no mood'}. ${partnerName}: ${b ? b.label : 'nothing shared'}.`}
                style={{ width: `${100 / 7}%`, padding: 2 }}>
                <View
                  style={{
                    borderRadius: radius.sm,
                    paddingVertical: 4,
                    alignItems: 'center',
                    gap: 2,
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: c.primary,
                    minHeight: 64,
                  }}>
                  <T variant="label" muted={!isToday} color={isToday ? c.primary : undefined}>
                    {i + 1}
                  </T>
                  <View style={{ width: 26, height: 22, borderRadius: 11, backgroundColor: a ? c.primarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontSize: 14, lineHeight: 18 }}>{a?.emoji ?? ''}</T>
                  </View>
                  <View style={{ width: 26, height: 22, borderRadius: 11, backgroundColor: b ? c.heartSoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontSize: 14, lineHeight: 18 }}>{b?.emoji ?? ''}</T>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
      <Gap />
      <T variant="small" muted center>
        You see all of your own moods. {partnerName}&apos;s side shows only what they chose to share.
      </T>
    </Screen>
  );
}
