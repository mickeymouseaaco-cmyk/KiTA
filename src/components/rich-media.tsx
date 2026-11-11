/**
 * Video notes, view-once media, and voice transcripts.
 */
import { Image } from 'expo-image';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download, Eye, EyeOff, Play, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gentleError } from '@/lib/copy';
import { useMedia, useMediaUrl } from '@/lib/media';
import { finishViewOnce } from '@/lib/messages';
import { saveToDevice } from '@/lib/storage-tools';
import type { Media, Message } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { StoredImage, StoredVoice } from './media-view';
import { Row, T } from './ui';
import { VoicePlayer } from './voice';

function Player({ url, autoPlay, ratio }: { url: string; autoPlay?: boolean; ratio: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    if (autoPlay) p.play();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', aspectRatio: ratio, borderRadius: radius.md, backgroundColor: '#000' }}
    />
  );
}

/** A video with a poster; the player loads only when someone taps play. */
export function VideoNote({ media }: { media: Media }) {
  const { c } = useTheme();
  const { url, failed } = useMediaUrl(media.storagePath);
  const { url: thumb } = useMediaUrl(media.thumbPath);
  const [playing, setPlaying] = useState(false);
  const ratio = media.width && media.height ? Math.max(0.56, Math.min(1.78, media.width / media.height)) : 16 / 9;
  if (failed) return <T variant="small" muted>{gentleError.load}</T>;
  if (playing && url) return <Player url={url} autoPlay ratio={ratio} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play video, ${Math.round((media.durationMs ?? 0) / 1000)} seconds`}
      onPress={() => setPlaying(true)}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      {thumb ? <Image source={{ uri: thumb }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Play color="#fff" fill="#fff" size={24} />
      </View>
    </Pressable>
  );
}

/** "Show words" under a voice note, if its owner turned transcription on. */
export function Transcript({ text, tone }: { text: string; tone?: 'surface' | 'onPrimary' }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const fg = tone === 'onPrimary' ? c.onPrimary : c.primary;
  return (
    <View style={{ gap: space.xs }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
        <T variant="small" color={fg} style={{ fontFamily: 'Raleway_600SemiBold' }}>
          {open ? 'Hide words' : 'Show words'}
        </T>
      </Pressable>
      {open ? (
        <T variant="small" color={tone === 'onPrimary' ? c.onPrimary : c.text} style={{ fontStyle: 'italic' }}>
          {text}
        </T>
      ) : null}
    </View>
  );
}

/** Best effort: block screenshots and screen recording while mounted (iOS/Android only). */
function PreventCapture() {
  usePreventScreenCapture('view-once');
  return null;
}

function ViewOnceContent({ media }: { media: Media }) {
  const { url } = useMediaUrl(media.storagePath);
  if (media.type === 'photo') return <StoredImage media={media} style={{ borderRadius: 0 }} />;
  if (media.type === 'video') return url ? <Player url={url} autoPlay ratio={media.width && media.height ? media.width / media.height : 16 / 9} /> : <ActivityIndicator />;
  return url ? <VoicePlayer uri={url} durationMs={media.durationMs} /> : <ActivityIndicator />;
}

/**
 * View-once. The recipient opens it once; closing deletes the file for good.
 * The sender only sees whether it has been opened.
 */
export function ViewOnceNote({ cid, m, mine, partnerName }: { cid: string; m: Message; mine: boolean; partnerName: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useFeedback();
  const media = useMedia(cid, m.mediaId);
  const [open, setOpen] = useState(false);
  const what = m.kind === 'voice' ? 'voice note' : m.kind === 'video' ? 'video' : 'photo';
  const fg = mine ? c.onPrimary : c.text;
  const opened = !!m.viewedAt;

  if (mine || opened || media === null) {
    return (
      <Row gap={space.sm}>
        {opened || media === null ? <EyeOff color={fg} size={20} /> : <Eye color={fg} size={20} />}
        <T testID="view-once-status" color={fg}>
          {mine
            ? opened
              ? `View-once ${what} · opened`
              : `View-once ${what} · not opened yet`
            : `You opened this ${what}. It’s gone now.`}
        </T>
      </Row>
    );
  }

  async function close() {
    setOpen(false);
    if (media) await finishViewOnce(cid, m, media).catch(() => toast(gentleError.save));
  }

  return (
    <>
      <Pressable
        testID="view-once-open"
        accessibilityRole="button"
        accessibilityLabel={`Open view-once ${what} from ${partnerName}`}
        accessibilityHint="It can be opened once"
        onPress={() => setOpen(true)}
        style={{ minHeight: 56, justifyContent: 'center' }}>
        <Row gap={space.sm}>
          <Eye color={c.primary} size={22} />
          <View>
            <T variant="bodyStrong">View-once {what}</T>
            <T variant="small" muted>
              Tap to open. It disappears after you close it.
            </T>
          </View>
        </Row>
      </Pressable>
      <Modal visible={open} animationType="fade" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: '#0E0C12', paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <Row style={{ justifyContent: 'space-between', padding: space.lg }}>
            <T color="#fff" variant="bodyStrong">
              From {partnerName} · view once
            </T>
            <Pressable testID="view-once-close" accessibilityRole="button" accessibilityLabel="Close. This will delete it" onPress={close} hitSlop={10} style={{ padding: 6 }}>
              <X color="#fff" size={26} />
            </Pressable>
          </Row>
          {open && Platform.OS !== 'web' ? <PreventCapture /> : null}
          <View style={{ flex: 1, justifyContent: 'center', padding: m.kind === 'voice' ? space.xl : 0 }}>
            {open && media ? (
              m.kind === 'voice' ? (
                <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }}>
                  <ViewOnceContent media={media} />
                </View>
              ) : (
                <ViewOnceContent media={media} />
              )
            ) : null}
          </View>
          <T color="#cfc8dc" center variant="small" style={{ padding: space.lg }}>
            {Platform.OS === 'web' ? 'Closing removes it for good.' : 'Screenshots are blocked while this is open. Closing removes it for good.'}
          </T>
        </View>
      </Modal>
    </>
  );
}

/** Shown only on received media whose sender allowed saving. */
function SaveButton({ media }: { media: Media }) {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const { url } = useMediaUrl(media.storagePath);
  const [busy, setBusy] = useState(false);
  if (!url) return null;
  return (
    <Pressable
      testID="save-to-device"
      accessibilityRole="button"
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          const r = await saveToDevice(url, media);
          toast(r === 'saved' ? 'Saved to your phone.' : 'No problem. You can allow saving in your phone\u2019s settings.');
        } catch {
          toast(gentleError.save);
        } finally {
          setBusy(false);
        }
      }}
      hitSlop={8}
      style={{ minHeight: 36, justifyContent: 'center' }}>
      <Row gap={6}>
        <Download color={c.primary} size={16} />
        <T variant="small" color={c.primary} style={{ fontFamily: 'Raleway_600SemiBold' }}>
          {busy ? 'Saving\u2026' : 'Save to my phone'}
        </T>
      </Row>
    </Pressable>
  );
}

/** Media inside a love note: photo, voice (with optional words), or video. */
export function NoteMedia({ cid, m, mine }: { cid: string; m: Message; mine: boolean }) {
  const media = useMedia(cid, m.mediaId);
  const tone = mine ? 'onPrimary' : 'surface';
  if (media === undefined) return <ActivityIndicator />;
  if (media === null) {
    return (
      <T variant="small" muted>
        This was removed by its owner.
      </T>
    );
  }
  if (media.type === 'photo' || media.type === 'video') {
    return (
      <View style={{ gap: space.xs }}>
        {media.type === 'photo' ? (
          // Tall photos are cropped a little so one picture never fills the whole screen.
          <StoredImage media={media} alt={m.text} style={{ borderRadius: 14, aspectRatio: Math.max(0.8, media.width && media.height ? media.width / media.height : 4 / 3) }} />
        ) : (
          <VideoNote media={media} />
        )}
        {!mine && media.allowSave ? <SaveButton media={media} /> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      <StoredVoice media={media} hug={m.voiceHug} tone={tone} testID={`play-${m.id}`} />
      {media.transcript ? <Transcript text={media.transcript} tone={tone} /> : null}
    </View>
  );
}
