import { router } from 'expo-router';
import { Bell, BellOff, Settings } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { setNotificationsPaused } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { space } from '@/theme';

import { CoupleAvatars } from './avatar';
import { useFeedback } from './feedback';
import { IconButton, Row, Segmented, T } from './ui';

/** Title row with the one-tap notification pause and settings. */
export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { uid, profile } = useSession();
  const { toast } = useFeedback();
  const paused = !!profile?.notificationsPaused;
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg }}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <T variant="small" muted>
            {subtitle}
          </T>
        ) : null}
        <T variant="display" accessibilityRole="header">
          {title}
        </T>
      </View>
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
  );
}

export function DaySwitch({ value }: { value: 'mine' | 'theirs' }) {
  const { partnerName } = useSession();
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
          { value: 'theirs', label: partnerName === 'your partner' ? 'Their Day' : `${partnerName}’s Day` },
        ]}
      />
    </View>
  );
}
