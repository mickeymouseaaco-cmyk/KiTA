/**
 * Teka-teki on Home: a new Malay riddle every 30 minutes, the same for both of
 * you. Tap to reveal the answer, or send it to your partner as a love note.
 */
import { Eye, Lightbulb, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { nextIn, tekaTekiAt } from '@/lib/teka-teki';
import { space, useTheme } from '@/theme';

import { Button, Card, Row, T } from './ui';
import { VividSquare } from './vivid';

/** The current time, updated each minute (and right on each 30-minute change). */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 60_000 - (now % 60_000) + 50);
    return () => clearTimeout(t);
  }, [now]);
  return now;
}

export function TekaTekiCard() {
  const { c, motion } = useTheme();
  const who = usePaired();
  const { toast } = useFeedback();
  const now = useMinuteClock();
  const { item, slot, nextAtMs } = tekaTekiAt(now);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const shown = revealed === slot;
  const [pop] = useState(() => new Animated.Value(1));

  function reveal() {
    haptic.tap();
    setRevealed(slot);
    if (motion === 'off') return;
    pop.setValue(0.85);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: Platform.OS !== 'web' }).start();
  }

  async function ask() {
    try {
      await sendText(who, `Teka-teki untuk awak: ${item.soalan}`, 'text', {});
      haptic.success();
      setSent(slot);
      toast(`Teka-teki dihantar kepada ${who.partnerName}.`);
    } catch {
      toast(gentleError.send);
    }
  }

  return (
    <Card>
      <View testID="teka-teki" accessibilityLanguage="ms">
        <Row gap={space.sm}>
          <VividSquare color="amber" size={32} radius={10}>
            <Lightbulb color="#FFFFFF" size={17} strokeWidth={2.4} />
          </VividSquare>
          <T variant="label" style={{ flex: 1 }}>
            TEKA-TEKI
          </T>
          <T testID="teka-teki-next" variant="small" muted style={{ fontSize: 12, lineHeight: 16 }}>
            Baru {nextIn(now, nextAtMs)}
          </T>
        </Row>
        <T testID="teka-teki-soalan" variant="title" style={{ marginTop: space.sm }}>
          {item.soalan}
        </T>
        {shown ? (
          <Animated.View style={{ transform: [{ scale: pop }], marginTop: space.md, alignSelf: 'flex-start' }}>
            <View style={{ backgroundColor: c.heartSoft, borderRadius: 14, paddingVertical: space.sm, paddingHorizontal: space.md }}>
              <T variant="small" muted style={{ fontSize: 12, lineHeight: 16 }}>
                Jawapan
              </T>
              <T testID="teka-teki-jawapan" variant="title" color={c.heart}>
                {item.jawapan}
              </T>
            </View>
          </Animated.View>
        ) : null}
        <Row gap={space.sm} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          {!shown ? <Button testID="teka-teki-reveal" small kind="soft" icon={Eye} label="Lihat jawapan" onPress={reveal} /> : null}
          <Pressable accessibilityRole="button" onPress={sent === slot ? undefined : ask} disabled={sent === slot} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: space.sm }}>
            <Row gap={6}>
              <Send color={sent === slot ? c.textMuted : c.primary} size={16} />
              <T variant="small" color={sent === slot ? c.textMuted : c.primary} style={{ fontWeight: '600' }}>
                {sent === slot ? 'Dihantar' : `Tanya ${who.partnerName}`}
              </T>
            </Row>
          </Pressable>
        </Row>
      </View>
    </Card>
  );
}
