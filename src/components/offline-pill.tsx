/**
 * A small glass pill at the top while you're offline, so it's clear why
 * things look still: what you see is the saved copy, and anything you send
 * goes as soon as you're back.
 */
import { CloudOff } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnline } from '@/lib/offline';
import { useTheme } from '@/theme';

import { Row, T } from './ui';
import { glassStyle } from './widgets';

export function OfflinePill() {
  const online = useOnline();
  const { c, dark } = useTheme();
  const { top } = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={{ position: 'absolute', top: top + 6, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none', zIndex: 50 }}>
      <Row
        testID="offline-pill"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        gap={6}
        style={[
          glassStyle(dark),
          {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
            boxShadow: '0px 6px 18px rgba(40,20,70,0.16)',
            maxWidth: '92%',
          },
        ]}>
        <CloudOff color={c.textMuted} size={15} />
        <T variant="small" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17 }}>
          Offline · what you send goes when you’re back
        </T>
      </Row>
    </View>
  );
}
