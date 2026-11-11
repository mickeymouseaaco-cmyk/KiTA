/**
 * The status row on Home: my status (or "Add status") and my partner's, with a
 * bright ring when there's something new to watch, like WhatsApp and
 * Instagram. Adding a status also saves it to Love Notes.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ImagePlus, Plus, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { gentleError } from '@/lib/copy';
import { pickPhoto, pickVideo, queueStatus, type PickedVideo } from '@/lib/compose';
import { haptic } from '@/lib/haptics';
import type { PreparedImage } from '@/lib/media';
import { usePaired, useSession } from '@/lib/session';
import { useStatuses } from '@/lib/status';
import { radius, space, useTheme } from '@/theme';

import { Avatar } from './avatar';
import { Sheet, useFeedback } from './feedback';
import { Button, Row, T, useInputStyle } from './ui';
import { VividAction } from './vivid';

const SIZE = 64;

/** The ring around an avatar: bright gradient when new, soft grey when watched. */
function Ring({ state, children }: { state: 'new' | 'seen' | 'none'; children: React.ReactNode }) {
  const { c } = useTheme();
  const box = SIZE + 10;
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
          <Circle cx={box / 2} cy={box / 2} r={box / 2 - 2} stroke={state === 'new' ? 'url(#status-ring)' : c.border} strokeWidth={state === 'new' ? 3 : 2} fill="none" />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

export function StatusRow() {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { profile, couple, myName } = useSession();
  const { mine, theirs, unseen } = useStatuses(cid, uid, partnerId);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <Row gap={space.lg} style={{ marginBottom: space.lg }}>
        {/* Mine: watch it, or add one. */}
        <View style={{ alignItems: 'center', gap: 4, width: SIZE + 14 }}>
          <Pressable
            testID="status-mine"
            accessibilityRole="button"
            accessibilityLabel={mine.length ? `Your status: ${mine.length}. Watch` : 'Add a status'}
            onPress={() => (mine.length ? router.push({ pathname: '/status', params: { who: 'me' } }) : setAdding(true))}>
            <Ring state={mine.length ? 'seen' : 'none'}>
              <Avatar uid={uid} avatarId={profile?.avatarId} name={myName || 'Me'} size={SIZE} />
            </Ring>
          </Pressable>
          <Pressable
            testID="status-add"
            accessibilityRole="button"
            accessibilityLabel="Add a status"
            onPress={() => setAdding(true)}
            hitSlop={8}
            style={{ position: 'absolute', right: 2, top: SIZE - 18, width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Plus color={c.onPrimary} size={14} strokeWidth={3} />
          </Pressable>
          <T variant="small" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
            {mine.length ? 'My status' : 'Add status'}
          </T>
        </View>

        {/* My partner's. */}
        <Pressable
          testID="status-partner"
          accessibilityRole="button"
          accessibilityLabel={theirs.length ? `${partnerName}’s status: ${unseen ? `${unseen} new` : 'watched'}. Watch` : `${partnerName} hasn’t posted a status today`}
          disabled={!theirs.length}
          onPress={() => router.push({ pathname: '/status', params: { who: 'partner' } })}
          style={{ alignItems: 'center', gap: 4, width: SIZE + 14, opacity: theirs.length ? 1 : 0.55 }}>
          <Ring state={!theirs.length ? 'none' : unseen ? 'new' : 'seen'}>
            <Avatar uid={partnerId} avatarId={couple?.avatars?.[partnerId]} name={partnerName} size={SIZE} tone="sage" />
          </Ring>
          <T variant="small" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
            {partnerName}
          </T>
          {unseen ? (
            <View testID="status-unseen" style={{ position: 'absolute', right: 2, top: 0, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.heart, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="small" color="#FFFFFF" style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
                {unseen}
              </T>
            </View>
          ) : null}
        </Pressable>

        <View style={{ flex: 1 }}>
          <T variant="small" muted style={{ fontSize: 12, lineHeight: 17 }}>
            {theirs.length || mine.length ? 'Photos and videos for 24 hours. They stay in Love Notes too.' : 'Share a moment from your day. It stays in Love Notes too.'}
          </T>
        </View>
      </Row>

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
      toast(`Status shared with ${who.partnerName}. It’s in Love Notes too.`);
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
          {who.partnerName} sees it for 24 hours. It also stays in Love Notes so you can look back.
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
