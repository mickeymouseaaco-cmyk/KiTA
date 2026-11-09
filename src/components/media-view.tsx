import { Image } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMedia, useMediaUrl } from '@/lib/media';
import type { Media } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Row, T } from './ui';
import { VoicePlayer } from './voice';

function Removed({ text = 'This was removed by its owner.' }: { text?: string }) {
  const { c } = useTheme();
  return (
    <Row gap={space.sm} style={{ paddingVertical: space.sm }}>
      <ImageOff color={c.textMuted} size={18} />
      <T variant="small" muted>
        {text}
      </T>
    </Row>
  );
}

export function StoredImage({
  media,
  style,
  alt,
}: {
  media: Media;
  style?: StyleProp<ViewStyle>;
  alt?: string;
}) {
  const { c } = useTheme();
  const { url, failed } = useMediaUrl(media.storagePath);
  const ratio = media.width && media.height ? media.width / media.height : 4 / 3;
  if (failed) return <Removed text="This photo couldn’t load right now." />;
  return (
    <View style={[{ width: '100%', aspectRatio: ratio, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surfaceAlt }, style]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={250}
          accessibilityLabel={alt ?? 'Shared photo'}
        />
      ) : (
        <ActivityIndicator style={{ flex: 1 }} color={c.primary} />
      )}
    </View>
  );
}

export function StoredVoice({ media, hug, tone, testID }: { media: Media; hug?: boolean; tone?: 'surface' | 'onPrimary'; testID?: string }) {
  const { url, failed } = useMediaUrl(media.storagePath);
  if (failed) return <Removed text="This voice note couldn’t load right now." />;
  if (!url) return <ActivityIndicator />;
  return <VoicePlayer uri={url} durationMs={media.durationMs} hug={hug} tone={tone} testID={testID} />;
}

/** Resolve a media id to its photo or voice view. Shows a kind line if the owner removed it. */
export function MediaById({
  cid,
  mediaId,
  hug,
  tone,
  caption,
  testID,
}: {
  cid: string;
  mediaId: string;
  hug?: boolean;
  tone?: 'surface' | 'onPrimary';
  caption?: string;
  testID?: string;
}) {
  const media = useMedia(cid, mediaId);
  if (media === undefined) return <ActivityIndicator />;
  if (media === null) return <Removed />;
  return media.type === 'photo' ? (
    <StoredImage media={media} alt={caption} />
  ) : (
    <StoredVoice media={media} hug={hug} tone={tone} testID={testID} />
  );
}

/** A voice file in my own private folder (e.g. a check-in). Only I can fetch it. */
export function StoredPrivateVoice({ path, durationMs }: { path: string; durationMs?: number }) {
  const { url, failed } = useMediaUrl(path);
  if (failed) return <Removed text="This voice note couldn’t load right now." />;
  if (!url) return <ActivityIndicator />;
  return <VoicePlayer uri={url} durationMs={durationMs} />;
}

/** A photo in my own private folder (mood selfie, vault). */
export function StoredPrivateImage({ path, ratio = 1, size, alt }: { path: string; ratio?: number; size?: number; alt?: string }) {
  const { c } = useTheme();
  const { url } = useMediaUrl(path);
  return (
    <View style={{ width: size ?? '100%', aspectRatio: ratio, borderRadius: size ? size / 2 : radius.md, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={alt ?? 'Private photo'} /> : null}
    </View>
  );
}
