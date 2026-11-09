/**
 * Private media vault: photos, videos and voice notes that are only ever yours.
 * Stored in your private folder; the rules let no one else read it, ever.
 */
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { ImagePlus, Lock, Mic, Trash, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { StoredPrivateImage, StoredPrivateVoice } from '@/components/media-view';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { Button, Card, EmptyState, Gap, Row, Screen, T } from '@/components/ui';
import { VoiceRecorder } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { pickPhoto, pickVideo, queueVaultItem } from '@/lib/compose';
import { relativeTime } from '@/lib/dates';
import { db, storage } from '@/lib/firebase';
import { LIMITS } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { useMediaUrl } from '@/lib/storage-tools';
import { radius, space, useTheme } from '@/theme';
import type { Timestamp } from 'firebase/firestore';
import { useVideoPlayer, VideoView } from 'expo-video';

type VaultItem = {
  id: string;
  type: 'photo' | 'voice' | 'video';
  path: string;
  width?: number;
  height?: number;
  durationMs?: number;
  caption?: string;
  createdAt: Timestamp | null;
};

function PrivateVideo({ path }: { path: string }) {
  const { url } = useMediaUrl(path);
  const player = useVideoPlayer(url ?? null);
  return url ? <VideoView player={player} nativeControls style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md }} /> : null;
}

export default function Vault() {
  const { c } = useTheme();
  const { uid } = usePaired();
  const { toast, ensurePermission } = useFeedback();
  const pending = useOutbox((j) => j.uid === uid && j.target.kind === 'vault');
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'users', uid, 'vault'), orderBy('createdAt', 'desc')),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as VaultItem)),
      () => setItems([]),
    );
  }, [uid]);

  async function remove(item: VaultItem) {
    try {
      await deleteObject(ref(storage, item.path)).catch(() => {});
      await deleteDoc(doc(db, 'users', uid, 'vault', item.id));
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card tone="lavender">
        <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
          <Lock color={c.primary} size={18} style={{ marginTop: 3 }} />
          <T style={{ flex: 1 }}>Only you can ever see what&apos;s in here. It&apos;s never shared, and app lock protects it on this phone.</T>
        </Row>
      </Card>
      <Gap />
      <Row gap={space.sm}>
        <Button
          testID="vault-photo"
          small
          kind="soft"
          icon={ImagePlus}
          label="Photo"
          style={{ flex: 1 }}
          onPress={async () => {
            if (!(await ensurePermission('photos'))) return;
            const p = await pickPhoto('library').catch(() => null);
            if (p) await queueVaultItem(uid, { kind: 'photo', photo: p });
          }}
        />
        <Button
          small
          kind="soft"
          icon={Video}
          label="Video"
          style={{ flex: 1 }}
          onPress={async () => {
            if (!(await ensurePermission('photos'))) return;
            const v = await pickVideo('library').catch(() => null);
            if (v === 'too-long') toast('Videos can be up to 60 seconds.');
            else if (v) await queueVaultItem(uid, { kind: 'video', video: v });
          }}
        />
        <Button small kind="soft" icon={Mic} label="Voice" style={{ flex: 1 }} onPress={() => setRecording((r) => !r)} />
      </Row>
      {recording ? (
        <View style={{ marginTop: space.md }}>
          <VoiceRecorder
            maxMs={LIMITS.voiceMaxMs}
            onDone={async (r) => {
              setRecording(false);
              await queueVaultItem(uid, { kind: 'voice', uri: r.uri, durationMs: r.durationMs });
            }}
          />
        </View>
      ) : null}
      <Gap />
      {pending.map((j) => (
        <View key={j.id} style={{ marginBottom: space.sm }}>
          <OutboxRow job={j} />
        </View>
      ))}
      {items && items.length === 0 && !pending.length ? <EmptyState icon={Lock} line="Your vault is empty. Anything you add stays just for you." /> : null}
      <View style={{ gap: space.md }}>
        {(items ?? []).map((it) => (
          <Card key={it.id} style={{ padding: space.md }}>
            {it.type === 'photo' ? (
              <StoredPrivateImage path={it.path} ratio={it.width && it.height ? it.width / it.height : 4 / 3} />
            ) : it.type === 'voice' ? (
              <StoredPrivateVoice path={it.path} durationMs={it.durationMs} />
            ) : (
              <PrivateVideo path={it.path} />
            )}
            <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
              <T variant="small" muted>
                {it.caption ? `${it.caption} · ` : ''}
                {relativeTime(it.createdAt?.toDate?.() ?? null)}
              </T>
              <Pressable testID="vault-remove" accessibilityRole="button" accessibilityLabel="Delete from vault" hitSlop={8} onPress={() => remove(it)} style={{ padding: 6 }}>
                <Trash color={c.textMuted} size={16} />
              </Pressable>
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
