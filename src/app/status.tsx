/**
 * Watch a status, full screen: progress bars along the top, tap the right side
 * for the next, the left for the previous, hold to pause. Photos show for 5
 * seconds, videos play to the end. Watching your partner's marks it seen; on
 * your own you see whether they've seen it, and can take it back.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Check, MessageCircleHeart, Trash, Volume2, VolumeX, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { useFeedback } from '@/components/feedback';
import { T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { useMedia, useMediaUrl } from '@/lib/media';
import { deleteMessage, markRead } from '@/lib/messages';
import { useSession } from '@/lib/session';
import { startIndex, statusAge, useStatuses } from '@/lib/status';
import type { Media, Message } from '@/lib/types';

const PHOTO_MS = 5000;

export default function StatusViewer() {
  const { who } = useLocalSearchParams<{ who?: string }>();
  const { uid, cid, partnerId, partnerName, myName, profile, couple } = useSession();
  const { mine, theirs } = useStatuses(cid, uid, partnerId);
  const own = who === 'me';
  const list = own ? mine : theirs;
  const insets = useSafeAreaInsets();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View testID="status-viewer" style={{ flex: 1, backgroundColor: '#000' }}>
      {list.length && cid ? (
        <Watching list={list} own={own} onClose={close}>
          {(m, i, next, prev) => (
        <Slide
          key={m.id}
          cid={cid!}
          m={m}
          index={i}
          count={list.length}
          own={own}
          onNext={next}
          onPrev={prev}
          onClose={close}
          header={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar
                uid={own ? uid : partnerId}
                avatarId={own ? profile?.avatarId : partnerId ? couple?.avatars?.[partnerId] : null}
                name={own ? myName || 'Me' : partnerName}
                size={36}
                tone={own ? 'peach' : 'sage'}
              />
              <View>
                <T variant="bodyStrong" color="#FFFFFF">
                  {own ? 'My status' : partnerName}
                </T>
                <T variant="small" color="rgba(255,255,255,0.75)" style={{ fontSize: 12, lineHeight: 16 }}>
                  {statusAge(m.createdAt?.toMillis?.())}
                </T>
              </View>
            </View>
          }
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          partnerName={partnerName}
        />
          )}
        </Watching>
      ) : (
        <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />
      )}
    </View>
  );
}

/**
 * Which status is showing. It starts at the first one not yet watched, decided
 * once when the viewer opens (watching marks it seen, which mustn't move us on).
 */
function Watching({
  list,
  own,
  onClose,
  children,
}: {
  list: Message[];
  own: boolean;
  onClose: () => void;
  children: (m: Message, i: number, next: () => void, prev: () => void) => React.ReactNode;
}) {
  const [at, setAt] = useState(() => (own ? 0 : startIndex(list)));
  const i = Math.min(at, list.length - 1);
  const next = () => (i + 1 < list.length ? setAt(i + 1) : onClose());
  const prev = () => setAt(Math.max(0, i - 1));
  return <>{children(list[i], i, next, prev)}</>;
}

function Slide({
  cid,
  m,
  index,
  count,
  own,
  onNext,
  onPrev,
  onClose,
  header,
  insetsTop,
  insetsBottom,
  partnerName,
}: {
  cid: string;
  m: Message;
  index: number;
  count: number;
  own: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  header: React.ReactNode;
  insetsTop: number;
  insetsBottom: number;
  partnerName: string;
}) {
  const { toast } = useFeedback();
  const media = useMedia(cid, m.mediaId);
  const [progress] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const done = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => (done.current = value));
    return () => progress.removeListener(id);
  }, [progress]);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const durationMs = media?.type === 'video' ? Math.max(1500, media.durationMs ?? 15000) : PHOTO_MS;

  // Watching your partner's status marks it seen (that's also "read" in Love Notes).
  useEffect(() => {
    if (!own && !m.readAt && m.createdAt) markRead(cid, m).catch(() => {});
  }, [own, m, cid]);

  // Run the progress bar once the picture or video is ready; pausing keeps its place.
  useEffect(() => {
    if (!ready || paused) return;
    const left = 1 - done.current;
    // Drives a width, so it stays off the native driver.
    anim.current = Animated.timing(progress, { toValue: 1, duration: Math.max(200, durationMs * left), easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => finished && onNext());
    return () => anim.current?.stop();
  }, [ready, paused, durationMs, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  async function takeBack() {
    try {
      await deleteMessage(cid, m);
      haptic.success();
      toast('Status removed. It’s gone from Surat Cinta too.');
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* The picture or video, edge to edge. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {media === undefined ? <ActivityIndicator color="#FFFFFF" /> : null}
        {media === null ? (
          <T color="#FFFFFF" onLayout={() => setReady(true)}>
            This was removed by its owner.
          </T>
        ) : null}
        {media ? <StatusMedia media={media} muted={muted} paused={paused} onReady={() => setReady(true)} /> : null}
      </View>

      {/* Tap left for back, right for next; hold anywhere to pause. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable testID="status-prev" accessibilityLabel="Previous" onPress={onPrev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={250} style={{ flex: 3 }} />
        <Pressable testID="status-next" accessibilityLabel="Next" onPress={onNext} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={250} style={{ flex: 7 }} />
      </View>

      {/* Top: progress, who, close. */}
      <View style={{ paddingTop: insetsTop + 8, paddingHorizontal: 12, gap: 10, backgroundColor: 'rgba(0,0,0,0.28)' }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: count }, (_, k) => (
            <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 3,
                  backgroundColor: '#FFFFFF',
                  width: k < index ? '100%' : k > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
          {header}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {media?.type === 'video' ? (
              <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Sound on' : 'Mute'} onPress={() => setMuted((v) => !v)} hitSlop={8} style={{ padding: 6 }}>
                {muted ? <VolumeX color="#FFFFFF" size={22} /> : <Volume2 color="#FFFFFF" size={22} />}
              </Pressable>
            ) : null}
            <Pressable testID="status-close" accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
              <X color="#FFFFFF" size={26} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bottom: caption, and seen / reply / take back. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insetsBottom + 16, paddingHorizontal: 16, paddingTop: 24, gap: 12, backgroundColor: 'rgba(0,0,0,0.35)' }}>
        {m.text ? (
          <T testID="status-caption-text" color="#FFFFFF" center style={{ fontSize: 17, lineHeight: 24 }}>
            {m.text}
          </T>
        ) : null}
        {own ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {m.readAt ? <Check color="#FFFFFF" size={16} /> : null}
              <T testID="status-seen" variant="small" color="rgba(255,255,255,0.85)">
                {m.readAt ? `Seen by ${partnerName}` : 'Not seen yet'}
              </T>
            </View>
            <Pressable testID="status-delete" accessibilityRole="button" accessibilityLabel="Take this status back" onPress={takeBack} hitSlop={8} style={{ padding: 6 }}>
              <Trash color="#FFFFFF" size={20} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID="status-reply"
            accessibilityRole="button"
            onPress={() => router.replace('/notes')}
            style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 18, paddingVertical: 10 }}>
            <MessageCircleHeart color="#FFFFFF" size={18} />
            <T variant="bodyStrong" color="#FFFFFF">
              Reply in Surat Cinta
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatusMedia({ media, muted, paused, onReady }: { media: Media; muted: boolean; paused: boolean; onReady: () => void }) {
  const { url, failed } = useMediaUrl(media.storagePath);
  useEffect(() => {
    if (failed) onReady();
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed) return <T color="#FFFFFF">This couldn’t load right now.</T>;
  if (!url) return <ActivityIndicator color="#FFFFFF" />;
  if (media.type === 'video') return <StatusVideo url={url} muted={muted} paused={paused} onReady={onReady} />;
  return <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="contain" onLoad={onReady} onError={onReady} accessibilityLabel="Status photo" />;
}

/** Outside the component: the player is a native object we tell what to do. */
function setPlayerMuted(p: VideoPlayer, muted: boolean) {
  p.muted = muted;
}

function StatusVideo({ url, muted, paused, onReady }: { url: string; muted: boolean; paused: boolean; onReady: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });
  useEffect(() => setPlayerMuted(player, muted), [muted, player]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => status === 'readyToPlay' && onReady());
    return () => sub.remove();
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps
  return <VideoView player={player} nativeControls={false} contentFit="contain" style={{ width: '100%', height: '100%' }} />;
}
