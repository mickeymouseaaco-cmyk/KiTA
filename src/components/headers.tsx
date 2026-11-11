import { router } from 'expo-router';
import { Bell, BellOff, Settings } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { setNotificationsPaused } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { useStatuses } from '@/lib/status';
import { space } from '@/theme';

import { CoupleAvatars } from './avatar';
import { useFeedback } from './feedback';
import { IconButton, Row, Segmented, T } from './ui';

/**
 * Page header: a slim row with the date and the quick actions, then the title on
 * one line of its own, so a long greeting never wraps under the buttons.
 */
export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { uid, profile } = useSession();
  const { toast } = useFeedback();
  const paused = !!profile?.notificationsPaused;
  // Longer titles get a little smaller so they always fit on one line.
  const size = title.length <= 18 ? 30 : title.length <= 24 ? 26 : 22;
  return (
    <View style={{ marginBottom: space.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.xs }}>
        <T variant="small" muted numberOfLines={1} style={{ flex: 1 }}>
          {subtitle ?? ''}
        </T>
        <Row gap={space.sm}>
          <Pressable
            testID="open-profile"
            accessibilityRole="button"
            accessibilityLabel="Your profile and photo"
            onPress={() => router.push('/settings')}
            hitSlop={6}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <CoupleAvatars size={34} />
          </Pressable>
          <IconButton
            testID="pause-notifications"
            icon={paused ? BellOff : Bell}
            label={paused ? 'Notifications paused. Tap to resume' : 'Pause all notifications'}
            active={paused}
            onPress={async () => {
              if (!uid) return;
              try {
                await setNotificationsPaused(uid, !paused);
                toast(paused ? 'Notifications are back on.' : 'All notifications paused. Enjoy the quiet.');
              } catch {
                toast(gentleError.save);
              }
            }}
          />
          <IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
        </Row>
      </Row>
      <T
        variant="display"
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ fontSize: size, lineHeight: Math.round(size * 1.25) }}>
        {title}
      </T>
    </View>
  );
}

export function DaySwitch({ value }: { value: 'mine' | 'theirs' }) {
  const { partnerName, cid, uid, partnerId } = useSession();
  // New statuses from my partner show as a number on their day, like WhatsApp.
  const { unseen } = useStatuses(cid, uid, partnerId);
  return (
    <View style={{ marginBottom: space.lg }}>
      <Segmented
        value={value}
        onChange={(v) => {
          if (v === value) return;
          router.navigate(v === 'mine' ? '/(tabs)' : '/(tabs)/their-day');
        }}
        options={[
          { value: 'mine', label: 'My Day' },
          { value: 'theirs', label: partnerName === 'your partner' ? 'Their Day' : `${partnerName}’s Day`, badge: unseen },
        ]}
      />
    </View>
  );
}
