/**
 * Storage: what you've uploaded, what's cached on this phone, and an easy,
 * safe "free up space".
 */
import { router } from 'expo-router';
import { HardDrive, Image as ImageIcon, Lock, Mic, Trash, Video } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Sheet, useFeedback } from '@/components/feedback';
import { useOutbox } from '@/components/outbox-row';
import { Button, Card, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { deleteMedia } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { clearDeviceCache, deviceCacheBytes, formatBytes, loadUsage, type Usage } from '@/lib/storage-tools';
import type { Media } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function Storage() {
  const { c } = useTheme();
  const { uid, cid } = usePaired();
  const { toast } = useFeedback();
  const pending = useOutbox((j) => j.uid === uid);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [cache, setCache] = useState<number | null>(() => deviceCacheBytes());
  const [confirm, setConfirm] = useState<(Media & { id: string }) | null>(null);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(() => {
    loadUsage(uid, cid)
      .then(setUsage)
      .catch(() => toast(gentleError.load));
    setCache(deviceCacheBytes());
  }, [uid, cid, toast]);

  useEffect(() => {
    let alive = true;
    loadUsage(uid, cid)
      .then((u) => alive && setUsage(u))
      .catch(() => alive && toast(gentleError.load));
    return () => {
      alive = false;
    };
  }, [uid, cid, toast]);

  const sharedTotal = usage ? usage.shared.photo + usage.shared.voice + usage.shared.video : 0;
  const rows = usage
    ? [
        { icon: ImageIcon, label: 'Photos', bytes: usage.shared.photo },
        { icon: Mic, label: 'Voice notes', bytes: usage.shared.voice },
        { icon: Video, label: 'Videos', bytes: usage.shared.video },
      ]
    : [];

  return (
    <Screen edges={['bottom']}>
      <Card tone="sky">
        <Row gap={space.md}>
          <HardDrive color={c.onSky} size={26} />
          <View style={{ flex: 1 }}>
            <T variant="heading" color={c.onSky}>
              On this phone
            </T>
            <T color={c.onSky} testID="cache-size">
              {cache === null ? 'Cached files are managed by your browser.' : `${formatBytes(cache)} of cached photos, videos and recordings`}
            </T>
          </View>
        </Row>
        <Gap h={space.md} />
        <Button
          testID="free-space"
          kind="quiet"
          small
          label="Free up space"
          loading={clearing}
          onPress={async () => {
            setClearing(true);
            await clearDeviceCache().catch(() => {});
            haptic.success();
            setCache(deviceCacheBytes());
            setClearing(false);
            toast('Done. Only cached copies were cleared; nothing you shared was touched.');
          }}
        />
        <T variant="small" color={c.onSky} style={{ marginTop: space.sm }}>
          Clears cached copies only. Everything will download again when you open it.
          {pending.length ? ` ${pending.length} item${pending.length === 1 ? ' is' : 's are'} still waiting to send and won’t be touched.` : ''}
        </T>
      </Card>
      <Gap />

      <SectionTitle>What you&apos;ve shared</SectionTitle>
      <Card>
        {!usage ? (
          <ActivityIndicator />
        ) : (
          <View style={{ gap: space.sm }}>
            {rows.map((r) => (
              <Row key={r.label} gap={space.md}>
                <r.icon color={c.primary} size={20} />
                <T style={{ flex: 1 }}>{r.label}</T>
                <T muted>{formatBytes(r.bytes)}</T>
              </Row>
            ))}
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.xs }} />
            <Row>
              <T variant="bodyStrong" style={{ flex: 1 }}>
                {usage.shared.count} items
              </T>
              <T variant="bodyStrong" testID="shared-total">
                {formatBytes(sharedTotal)}
              </T>
            </Row>
          </View>
        )}
      </Card>
      <Gap />

      <Pressable accessibilityRole="button" onPress={() => router.push('/vault')}>
        <Card tone="lavender">
          <Row gap={space.md}>
            <Lock color={c.primary} size={22} />
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">Private vault</T>
              <T muted>{usage ? `${usage.vault.count} items · ${formatBytes(usage.vault.bytes)} · just for you` : ' '}</T>
            </View>
          </Row>
        </Card>
      </Pressable>

      {usage?.largest.length ? (
        <>
          <Gap />
          <SectionTitle>Largest things you sent</SectionTitle>
          <T variant="small" muted>
            Removing one deletes it for both of you, wherever it appears.
          </T>
          <Gap h={space.sm} />
          <Card style={{ paddingVertical: space.md }}>
            {usage.largest.map((m) => (
              <Row key={m.id} gap={space.md} style={{ minHeight: 48 }}>
                {m.type === 'photo' ? <ImageIcon color={c.textMuted} size={18} /> : m.type === 'voice' ? <Mic color={c.textMuted} size={18} /> : <Video color={c.textMuted} size={18} />}
                <T style={{ flex: 1 }}>
                  {m.type === 'photo' ? 'Photo' : m.type === 'voice' ? 'Voice note' : 'Video'} in {m.parent?.kind === 'memory' ? 'Memory Jar' : m.parent?.kind === 'trip' ? 'a trip' : 'Surat Cinta'}
                </T>
                <T muted>{formatBytes(m.bytes ?? 0)}</T>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove this" hitSlop={8} onPress={() => setConfirm(m)} style={{ padding: 6 }}>
                  <Trash color={c.textMuted} size={16} />
                </Pressable>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)}>
        <T variant="title" center>
          Remove this?
        </T>
        <Gap h={space.sm} />
        <T muted center>
          It will be removed for both of you. The note or memory stays, with a small &ldquo;removed&rdquo; line.
        </T>
        <Gap h={space.xl} />
        <Button
          label="Remove it"
          onPress={async () => {
            const m = confirm;
            setConfirm(null);
            if (!m) return;
            try {
              await deleteMedia(cid, { id: m.id, storagePath: m.storagePath });
              refresh();
            } catch {
              toast(gentleError.save);
            }
          }}
        />
        <Gap h={space.sm} />
        <Button label="Keep it" kind="ghost" onPress={() => setConfirm(null)} />
      </Sheet>
    </Screen>
  );
}
