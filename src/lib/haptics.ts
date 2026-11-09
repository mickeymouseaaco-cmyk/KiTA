import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

const native = Platform.OS !== 'web';

export const haptic = {
  tap() {
    if (native) Haptics.selectionAsync().catch(() => {});
  },
  soft() {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  },
  success() {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** A slow "squeeze": two gentle pulses, like a heartbeat. */
  hug() {
    if (!native) return;
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 180, 140, 260, 220, 400]);
      return;
    }
    const pulse = (ms: number, style: Haptics.ImpactFeedbackStyle) =>
      setTimeout(() => Haptics.impactAsync(style).catch(() => {}), ms);
    [0, 120, 240].forEach((t) => pulse(t, Haptics.ImpactFeedbackStyle.Medium));
    [620, 740, 860, 980].forEach((t) => pulse(t, Haptics.ImpactFeedbackStyle.Soft));
  },
};
