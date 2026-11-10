import { Image } from 'expo-image';
import { View } from 'react-native';

import { useAvatarUrl } from '@/lib/avatar';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

import { T } from './ui';

/** A round profile picture, or a soft initial when there's no photo (or it hasn't loaded). */
export function Avatar({
  uid,
  avatarId,
  name,
  size = 40,
  tone = 'peach',
  ring,
}: {
  uid: string | null | undefined;
  avatarId: string | null | undefined;
  name: string;
  size?: number;
  tone?: 'peach' | 'sage';
  /** A border in the page colour, for overlapping pairs. */
  ring?: boolean;
}) {
  const { c } = useTheme();
  const url = useAvatarUrl(uid, avatarId);
  const bg = tone === 'peach' ? c.peach : c.sage;
  const fg = tone === 'peach' ? c.onPeach : c.onSage;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={url ? `${name}’s photo` : name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 2 : 0,
        borderColor: c.bg,
      }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <T style={{ fontSize: size * 0.42, lineHeight: size * 0.5, fontWeight: '600', color: fg }}>{(name.trim()[0] ?? '♡').toUpperCase()}</T>
      )}
    </View>
  );
}

/** You and your partner, overlapping. */
export function CoupleAvatars({ size = 36 }: { size?: number }) {
  const { uid, profile, couple, partnerId, partnerName, myName } = useSession();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'You'} size={size} tone="peach" ring />
      {partnerId ? (
        <View style={{ marginLeft: -size * 0.3 }}>
          <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={size} tone="sage" ring />
        </View>
      ) : null}
    </View>
  );
}
