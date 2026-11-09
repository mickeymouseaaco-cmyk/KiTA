import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { sendHug } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { T } from './ui';

const nd = Platform.OS !== 'web';

/** One big, soft button. Sends a hug that buzzes their phone like a heartbeat. */
export function HugButton() {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const [scale] = useState(() => new Animated.Value(1));
  const [ripple] = useState(() => new Animated.Value(0));
  const [sending, setSending] = useState(false);

  async function hug() {
    if (sending) return;
    setSending(true);
    haptic.hug();
    ripple.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.9, duration: 120, useNativeDriver: nd }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: nd }),
      ]),
      Animated.timing(ripple, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: nd }),
    ]).start();
    try {
      await sendHug({ uid, cid, partnerId });
      toast(`Hug sent to ${partnerName} ♥`);
    } catch {
      toast(gentleError.send);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 132,
            height: 132,
            borderRadius: 66,
            backgroundColor: c.heartSoft,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] }) }],
          }}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            testID="hug-button"
            accessibilityRole="button"
            accessibilityLabel={`Send a hug to ${partnerName}`}
            accessibilityHint="Their phone will gently vibrate"
            onPress={hug}
            style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: c.heart, alignItems: 'center', justifyContent: 'center' }}>
            <Heart color="#FFFFFF" fill="#FFFFFF" size={44} />
          </Pressable>
        </Animated.View>
      </View>
      <T variant="bodyStrong">Send a hug</T>
    </View>
  );
}
