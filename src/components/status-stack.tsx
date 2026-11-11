/**
 * Status on Home (and on your partner's day): a smart-stack widget with your
 * partner's status and yours, a bright ring and a number when there's
 * something new, like WhatsApp and Instagram. Adding a status also saves it to
 * Love Notes.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ImagePlus, Play, Plus, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { gentleError } from '@/lib/copy';
import { pickPhoto, pickVideo, queueStatus, type PickedVideo } from '@/lib/compose';
import { haptic } from '@/lib/haptics';
import { useMedia, useMediaUrl, type PreparedImage } from '@/lib/media';
import { usePaired, useSession } from '@/lib/session';
import { statusAge, useStatuses } from '@/lib/status';
import type { Message } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Sheet, useFeedback } from './feedback';
import { Button, Row, T, useInputStyle } from './ui';
import { VividAction } from './vivid';

const SIZE = 64;

/** The ring around an avatar: bright gradient when new, soft grey when watched. */
function Ring({ state, children, size = SIZE }: { state: 'new' | 'seen' | 'none'; children: React.ReactNode; size?: number }) {
  const { c } = useTheme();
  const box = size + 8;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {state !== 'none' ? (
        <Svg width={box} height={box} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="status-ring" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFB547" />
              <Stop offset="0.5" stopColor="#FF5C8D" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={box / 2 - 1.5} stroke={state === 'new' ? 'url(#status-ring)' : 'rgba(255,255,255,0.7)'} strokeWidth={state === 'new' ? 2.5 : 1.5} fill="none" />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

/** The newest status's picture (a photo, or a video's poster) as the widget's background. */
function Backdrop({ cid, m }: { cid: string; m: Message }) {
  const media = useMedia(cid, m.mediaId);
  const path = media ? (media.type === 'photo' ? media.storagePath : media.thumbPath) : undefined;
  const { url } = useMediaUrl(path);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1B1B22' }}>
      {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} /> : null}
      {media?.type === 'video' && !url ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Video color="rgba(255,255,255,0.6)" size={36} />
        </View>
      ) : null}
      <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="status-cover-shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.45" />
            <Stop offset="0.45" stopColor="#000000" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#status-cover-shade)" />
      </Svg>
    </View>
  );
}

const WIDGET_H = 168;

/**
 * Status as a smart-stack widget (like the cards below it): swipe between your
 * partner's status and yours. The newest picture fills the card; a bright ring
 * and a number show what's new. Tap to watch; + to add one.
 */
export function StatusStack({ only }: { only?: 'partner' }) {
  const { c, look } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { profile, couple, myName } = useSession();
  const { mine, theirs, unseen } = useStatuses(cid, uid, partnerId);
  const [adding, setAdding] = useState(false);
  // Partner's day shows the same widget; its own test ids keep the two apart.
  const id = (name: string) => (only ? `their-${name}` : name);
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  const pages: ('partner' | 'mine')[] = only ? ['partner'] : ['partner', 'mine'];
  const latestTheirs = theirs[theirs.length - 1];
  const latestMine = mine[mine.length - 1];

  const frame = {
    height: WIDGET_H,
    borderRadius: look.cardRadius,
    overflow: 'hidden' as const,
    borderWidth: look.outlined ? look.cardBorder : 1,
    borderColor: look.outlined ? c.text : c.border,
    backgroundColor: c.surface,
  };

  const partnerPage = latestTheirs ? (
    <Pressable
      testID={id('status-partner')}
      accessibilityRole="button"
      accessibilityLabel={`${partnerName}’s status: ${theirs.length}${unseen ? `, ${unseen} new` : ''}. Watch`}
      onPress={() => router.push({ pathname: '/status', params: { who: 'partner' } })}
      style={{ flex: 1 }}>
      <Backdrop cid={cid} m={latestTheirs} />
      <View style={{ flex: 1, padding: space.lg, paddingRight: 60, justifyContent: 'space-between' }}>
        <Row gap={space.sm}>
          <Ring state={unseen ? 'new' : 'seen'} size={40}>
            <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={40} tone="sage" />
          </Ring>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
              {partnerName}
            </T>
            <T variant="small" color="rgba(255,255,255,0.85)" style={{ fontSize: 12, lineHeight: 16 }}>
              {statusAge(latestTheirs.createdAt?.toMillis?.())} · {theirs.length} {theirs.length === 1 ? 'status' : 'statuses'}
            </T>
          </View>
          {unseen ? (
            <View testID={id('status-unseen')} style={{ backgroundColor: c.heart, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <T variant="small" color="#FFFFFF" style={{ fontSize: 12, lineHeight: 16, fontWeight: '700' }}>
                {unseen} new
              </T>
            </View>
          ) : null}
        </Row>
        <Row gap={6}>
          <Play color="#FFFFFF" fill="#FFFFFF" size={14} />
          <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ flex: 1 }}>
            {latestTheirs.text || (unseen ? 'Tap to watch' : 'Watch again')}
          </T>
        </Row>
      </View>
    </Pressable>
  ) : (
    <View testID={id('status-partner-empty')} style={{ flex: 1, padding: space.lg, paddingRight: 60, justifyContent: 'space-between' }}>
      <Row gap={space.sm}>
        <View style={{ opacity: 0.6 }}>
          <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={40} tone="sage" />
        </View>
        <T variant="label" muted style={{ flex: 1 }}>
          {partnerName.toUpperCase()}’S STATUS
        </T>
      </Row>
      <View>
        <T variant="heading">No status from {partnerName} yet today</T>
        <T variant="small" muted>
          When they share a photo or video, it shows here for 24 hours.
        </T>
      </View>
    </View>
  );

  const minePage = latestMine ? (
    <Pressable
      testID={id('status-mine')}
      accessibilityRole="button"
      accessibilityLabel={`Your status: ${mine.length}. ${latestMine.readAt ? `Seen by ${partnerName}` : 'Not seen yet'}. Watch`}
      onPress={() => router.push({ pathname: '/status', params: { who: 'me' } })}
      style={{ flex: 1 }}>
      <Backdrop cid={cid} m={latestMine} />
      <View style={{ flex: 1, padding: space.lg, paddingRight: 60, justifyContent: 'space-between' }}>
        <Row gap={space.sm}>
          <Ring state="seen" size={40}>
            <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'Me'} size={40} />
          </Ring>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" color="#FFFFFF">
              My status
            </T>
            <T variant="small" color="rgba(255,255,255,0.85)" style={{ fontSize: 12, lineHeight: 16 }}>
              {statusAge(latestMine.createdAt?.toMillis?.())} · {latestMine.readAt ? `Seen by ${partnerName}` : 'Not seen yet'}
            </T>
          </View>
        </Row>
        <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
          {latestMine.text || 'Tap to watch'}
        </T>
      </View>
    </Pressable>
  ) : (
    <Pressable testID={id('status-mine-empty')} accessibilityRole="button" accessibilityLabel="Add a status" onPress={() => setAdding(true)} style={{ flex: 1, padding: space.lg, paddingRight: 60, justifyContent: 'space-between' }}>
      <Row gap={space.sm}>
        <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'Me'} size={40} />
        <T variant="label" muted style={{ flex: 1 }}>
          MY STATUS
        </T>
      </Row>
      <View>
        <T variant="heading">Share a moment with {partnerName}</T>
        <T variant="small" muted>
          A photo or video for 24 hours. It stays in Surat Cinta too.
        </T>
      </View>
    </Pressable>
  );

  return (
    <>
      <View style={[frame, { marginBottom: space.md }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}>
            {pages.map((p) => (
              <View key={p} style={{ width: w - (frame.borderWidth ?? 0) * 2, height: WIDGET_H - (frame.borderWidth ?? 0) * 2 }}>
                {p === 'partner' ? partnerPage : minePage}
              </View>
            ))}
          </ScrollView>
        ) : null}
        {/* Add a status, from either page. */}
        <Pressable
          testID={id('status-add')}
          accessibilityRole="button"
          accessibilityLabel="Add a status"
          onPress={() => setAdding(true)}
          hitSlop={8}
          style={{ position: 'absolute', right: space.md, bottom: space.md, width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(0,0,0,0.25)' }}>
          <Plus color={c.onPrimary} size={20} strokeWidth={2.6} />
        </Pressable>
        {/* Page dots, like a stack of widgets. */}
        {pages.length > 1 ? (
          <View style={{ position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center', gap: 5, pointerEvents: 'none' }}>
            {pages.map((p, i) => (
              <View key={p} style={{ width: 5, height: i === page ? 14 : 5, borderRadius: 3, backgroundColor: i === page ? (latestTheirs || latestMine ? '#FFFFFF' : c.text) : 'rgba(128,128,128,0.45)' }} />
            ))}
          </View>
        ) : null}
      </View>

      <Sheet visible={adding} onClose={() => setAdding(false)}>
        {adding ? <AddStatus onDone={() => setAdding(false)} /> : null}
      </Sheet>
    </>
  );
}

type Picked = { kind: 'photo'; photo: PreparedImage } | { kind: 'video'; video: PickedVideo };

function AddStatus({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { toast } = useFeedback();
  const who = usePaired();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  async function choose(kind: 'camera' | 'library' | 'video') {
    try {
      if (kind === 'video') {
        const v = await pickVideo('library');
        if (v === 'too-long') return toast('Videos can be up to a minute long.');
        if (v) setPicked({ kind: 'video', video: v });
      } else {
        const p = await pickPhoto(kind);
        if (p) setPicked({ kind: 'photo', photo: p });
      }
    } catch {
      toast(gentleError.load);
    }
  }

  async function share() {
    if (!picked) return;
    setBusy(true);
    try {
      await queueStatus(who, picked, caption.trim());
      haptic.success();
      toast(`Status shared with ${who.partnerName}. It’s in Surat Cinta too.`);
      onDone();
    } catch {
      toast(gentleError.send);
      setBusy(false);
    }
  }

  if (!picked) {
    return (
      <View style={{ gap: space.lg }}>
        <T variant="title" center>
          Add a status
        </T>
        <Row style={{ justifyContent: 'space-around' }}>
          <VividAction testID="status-camera" icon={Camera} label="Camera" color="pink" onPress={() => choose('camera')} />
          <VividAction testID="status-photo" icon={ImagePlus} label="Photo" color="violet" onPress={() => choose('library')} />
          <VividAction testID="status-video" icon={Video} label="Video" color="orange" onPress={() => choose('video')} />
        </Row>
        <T variant="small" muted center>
          {who.partnerName} sees it for 24 hours. It also stays in Surat Cinta so you can look back.
        </T>
      </View>
    );
  }

  const uri = picked.kind === 'photo' ? picked.photo.uri : (picked.video.thumbUri ?? null);
  return (
    <View style={{ gap: space.md }}>
      <View style={{ height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : <Video color="#FFFFFF" size={40} />}
      </View>
      <TextInput
        testID="status-caption"
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption (optional)"
        placeholderTextColor={c.textMuted}
        maxLength={300}
        style={input}
      />
      <Button testID="status-share" label="Share status" loading={busy} onPress={share} />
      <Button kind="ghost" small label="Choose another" onPress={() => setPicked(null)} />
    </View>
  );
}
