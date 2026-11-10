/** Every photo, video and voice note you've sent each other in Notes, like WhatsApp's media view. */
import { Image } from 'expo-image';
import { Images, Mic, Play } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native';

import { Sheet } from '@/components/feedback';
import { NoteMedia } from '@/components/rich-media';
import { Card, EmptyState, Gap, Row, Screen, Segmented, T } from '@/components/ui';
import { useMedia, useMediaUrl } from '@/lib/media';
import { useMessages } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import type { Message } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

const GAP = 4;

function when(m: Message): string {
  const d = m.createdAt?.toDate?.();
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** A square thumbnail: the photo, or the video's poster frame with a play mark. */
function Tile({ cid, m, size, onOpen }: { cid: string; m: Message; size: number; onOpen: () => void }) {
  const { c } = useTheme();
  const media = useMedia(cid, m.mediaId);
  const { url } = useMediaUrl(media ? (media.type === 'video' ? media.thumbPath : media.storagePath) : undefined);
  return (
    <Pressable
      testID={`media-tile-${m.id}`}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${m.kind === 'video' ? 'Video' : 'Photo'} from ${when(m)}. Open`}
      onPress={onOpen}
      style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : media === null ? null : (
        <ActivityIndicator style={{ flex: 1 }} color={c.primary} />
      )}
      {m.kind === 'video' ? (
        <View style={{ position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Play color="#FFFFFF" fill="#FFFFFF" size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function NotesMedia() {
  const { c } = useTheme();
  const { uid, cid, partnerName } = usePaired();
  const { messages, ready } = useMessages(cid, 500);
  const [tab, setTab] = useState<'visual' | 'voice'>('visual');
  const [open, setOpen] = useState<Message | null>(null);
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 560) - space.lg * 2;
  const cols = inner > 420 ? 4 : 3;
  const size = Math.floor((inner - GAP * (cols - 1)) / cols);

  const media = messages.filter((m) => m.mediaId && !m.viewOnce);
  const visual = media.filter((m) => m.kind === 'photo' || m.kind === 'video');
  const voice = media.filter((m) => m.kind === 'voice');
  const who = (m: Message) => (m.fromUid === uid ? 'You' : partnerName);

  return (
    <Screen edges={['bottom']}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'visual', label: `Photos & videos${visual.length ? ` · ${visual.length}` : ''}` },
          { value: 'voice', label: `Voice${voice.length ? ` · ${voice.length}` : ''}` },
        ]}
      />
      <Gap />
      {!ready ? (
        <ActivityIndicator color={c.primary} />
      ) : tab === 'visual' ? (
        visual.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
            {visual.map((m) => (
              <Tile key={m.id} cid={cid} m={m} size={size} onOpen={() => setOpen(m)} />
            ))}
          </View>
        ) : (
          <EmptyState icon={Images} line="Photos and videos you send each other in Notes will gather here." />
        )
      ) : voice.length ? (
        <View style={{ gap: space.sm }}>
          {voice.map((m) => (
            <Card key={m.id} style={{ paddingVertical: space.md }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
                <T variant="bodyStrong">{m.voiceHug ? `Voice hug from ${who(m) === 'You' ? 'you' : partnerName}` : who(m)}</T>
                <T variant="small" muted>
                  {when(m)}
                </T>
              </Row>
              <NoteMedia cid={cid} m={m} mine={false} />
              {m.text ? (
                <T variant="small" muted style={{ marginTop: space.xs }}>
                  {m.text}
                </T>
              ) : null}
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={Mic} line="Voice notes and voice hugs will gather here, so you can listen again any time." />
      )}

      <Sheet visible={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View style={{ gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="bodyStrong">{who(open)}</T>
              <T variant="small" muted>
                {when(open)}
              </T>
            </Row>
            <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
              <NoteMedia cid={cid} m={open} mine={false} />
            </View>
            {open.text ? <T>{open.text}</T> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
