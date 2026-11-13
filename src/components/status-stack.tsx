/**
 * Status (like WhatsApp and Instagram) as smart-stack widget pages: your
 * partner's status and yours, a bright ring and a number when there's
 * something new. Adding a status also saves it to Surat Cinta.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ImagePlus, Play, Plus, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
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
import { SmartStack, StackPage } from './widgets';

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

/** The round + that adds a status, in the corner of a status page. */
function AddButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Add a status"
      onPress={onPress}
      hitSlop={8}
      style={{ position: 'absolute', right: 22, bottom: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(0,0,0,0.25)' }}>
      <Plus color={c.onPrimary} size={20} strokeWidth={2.6} />
    </Pressable>
  );
}

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet visible={open} onClose={onClose}>
      {open ? <AddStatus onDone={onClose} /> : null}
    </Sheet>
  );
}

const small = { fontSize: 12, lineHeight: 16 };

/** Your partner's status, as a widget page: their newest picture fills it; tap to watch. */
export function PartnerStatusPage({ prefix = '' }: { prefix?: string }) {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { couple } = useSession();
  const { theirs, unseen } = useStatuses(cid, uid, partnerId);
  const [adding, setAdding] = useState(false);
  const latest = theirs[theirs.length - 1];
  if (!latest) {
    return (
      <StackPage fill="pink" testID={`${prefix}status-partner-empty`}>
        <Row gap={space.sm}>
          <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={36} tone="sage" />
          <T variant="label" color={c.textMuted} style={{ flex: 1 }}>
            {partnerName.toUpperCase()}’S STATUS
          </T>
        </Row>
        <View style={{ flex: 1 }} />
        <View style={{ paddingRight: 44 }}>
          <T variant="heading" color={c.text}>
            Nothing from {partnerName} yet today
          </T>
          <T variant="small" color={c.textMuted} style={small}>
            Photos and videos show here for 24 hours.
          </T>
        </View>
        <AddButton testID={`${prefix}status-add`} onPress={() => setAdding(true)} />
        <AddSheet open={adding} onClose={() => setAdding(false)} />
      </StackPage>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        testID={`${prefix}status-partner`}
        accessibilityRole="button"
        accessibilityLabel={`${partnerName}’s status: ${theirs.length}${unseen ? `, ${unseen} new` : ''}. Watch`}
        onPress={() => router.push({ pathname: '/status', params: { who: 'partner' } })}
        style={{ flex: 1 }}>
        <Backdrop cid={cid} m={latest} />
        <View style={{ flex: 1, padding: 16, paddingRight: 22, justifyContent: 'space-between' }}>
          <Row gap={space.sm}>
            <Ring state={unseen ? 'new' : 'seen'} size={38}>
              <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={38} tone="sage" />
            </Ring>
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
                {partnerName}
              </T>
              <T variant="small" color="rgba(255,255,255,0.85)" style={small}>
                {statusAge(latest.createdAt?.toMillis?.())} · {theirs.length} {theirs.length === 1 ? 'status' : 'statuses'}
              </T>
            </View>
            {unseen ? (
              <View testID={`${prefix}status-unseen`} style={{ backgroundColor: c.heart, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <T variant="small" color="#FFFFFF" style={[small, { fontWeight: '700' }]}>
                  {unseen} new
                </T>
              </View>
            ) : null}
          </Row>
          <Row gap={6} style={{ paddingRight: 44 }}>
            <Play color="#FFFFFF" fill="#FFFFFF" size={14} />
            <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ flex: 1 }}>
              {latest.text || (unseen ? 'Tap to watch' : 'Watch again')}
            </T>
          </Row>
        </View>
      </Pressable>
      <AddButton testID={`${prefix}status-add`} onPress={() => setAdding(true)} />
      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** Your own status, as a widget page: who has seen it, or a nudge to share one. */
export function MyStatusPage({ prefix = '' }: { prefix?: string }) {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { profile, myName } = useSession();
  const { mine } = useStatuses(cid, uid, partnerId);
  const [adding, setAdding] = useState(false);
  const latest = mine[mine.length - 1];
  return (
    <View style={{ flex: 1 }}>
      {latest ? (
        <Pressable
          testID={`${prefix}status-mine`}
          accessibilityRole="button"
          accessibilityLabel={`Your status: ${mine.length}. ${latest.readAt ? `Seen by ${partnerName}` : 'Not seen yet'}. Watch`}
          onPress={() => router.push({ pathname: '/status', params: { who: 'me' } })}
          style={{ flex: 1 }}>
          <Backdrop cid={cid} m={latest} />
          <View style={{ flex: 1, padding: 16, paddingRight: 22, justifyContent: 'space-between' }}>
            <Row gap={space.sm}>
              <Ring state="seen" size={38}>
                <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'Me'} size={38} />
              </Ring>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong" color="#FFFFFF">
                  My status
                </T>
                <T variant="small" color="rgba(255,255,255,0.85)" style={small}>
                  {statusAge(latest.createdAt?.toMillis?.())} · {latest.readAt ? `Seen by ${partnerName}` : 'Not seen yet'}
                </T>
              </View>
            </Row>
            <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ paddingRight: 44 }}>
              {latest.text || 'Tap to watch'}
            </T>
          </View>
        </Pressable>
      ) : (
        <StackPage fill="violet" testID={`${prefix}status-mine-empty`} onPress={() => setAdding(true)} accessibilityLabel="Add a status">
          <Row gap={space.sm}>
            <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'Me'} size={36} />
            <T variant="label" color={c.textMuted} style={{ flex: 1 }}>
              MY STATUS
            </T>
          </Row>
          <View style={{ flex: 1 }} />
          <View style={{ paddingRight: 44 }}>
            <T variant="heading" color={c.text}>
              Share a moment with {partnerName}
            </T>
            <T variant="small" color={c.textMuted} style={small}>
              A photo or video for 24 hours. It stays in Surat Cinta too.
            </T>
          </View>
        </StackPage>
      )}
      <AddButton testID={`${prefix}status-add-mine`} onPress={() => setAdding(true)} />
      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** Status on its own (your partner's day): their status and yours in one smart stack. */
export function StatusStack({ only }: { only?: 'partner' }) {
  const prefix = only ? 'their-' : '';
  return (
    <SmartStack testID={`${prefix}status-stack`} height={172}>
      <PartnerStatusPage prefix={prefix} />
      {only ? null : <MyStatusPage prefix={prefix} />}
    </SmartStack>
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
