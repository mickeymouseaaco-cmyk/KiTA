import { CloudOff, RotateCcw, Upload, X } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';

import { outbox, type OutboxJob } from '@/lib/outbox';
import { radius, space, useTheme } from '@/theme';

import { Row, T } from './ui';

export function useOutbox(filter?: (j: OutboxJob) => boolean) {
  const all = useSyncExternalStore(outbox.subscribe, outbox.getSnapshot, outbox.getSnapshot);
  return filter ? all.filter(filter) : all;
}

/** Calm progress for something still on its way. No error colors, just status. */
export function OutboxRow({ job }: { job: OutboxJob }) {
  const { c } = useTheme();
  const what =
    job.target.kind === 'memory'
      ? 'memory'
      : job.target.kind === 'gratitude'
        ? 'thank-you'
        : job.target.kind === 'checkIn'
          ? 'check-in'
          : job.files[0]?.type === 'voice'
            ? 'voice note'
            : job.files[0]?.type === 'video'
              ? 'video'
              : 'photo';
  const line =
    job.state === 'uploading'
      ? `Sending your ${what}… ${Math.round(job.progress * 100)}%`
      : job.state === 'offline'
        ? `Your ${what} will send when you’re back online.`
        : job.state === 'retrying'
          ? 'That didn’t send. We’ll try again in a moment.'
          : `Getting your ${what} ready…`;
  const Icon = job.state === 'offline' ? CloudOff : Upload;
  return (
    <View testID="outbox-row" style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <Row gap={space.sm}>
        <Icon color={c.primary} size={18} />
        <T variant="small" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {line}
        </T>
        {job.state === 'retrying' || job.state === 'offline' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Try again now" onPress={() => outbox.kick(job.uid)} hitSlop={10} style={{ padding: 6 }}>
            <RotateCcw color={c.primary} size={18} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Don't send this" onPress={() => outbox.discard(job.id)} hitSlop={10} style={{ padding: 6 }}>
          <X color={c.textMuted} size={18} />
        </Pressable>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.ringTrack, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.max(4, job.progress * 100)}%`, backgroundColor: c.primary }} />
      </View>
    </View>
  );
}
