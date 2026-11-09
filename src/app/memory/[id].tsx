import { Stack, router, useLocalSearchParams } from 'expo-router';
import { CalendarHeart } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Sheet, useFeedback } from '@/components/feedback';
import { MediaById } from '@/components/media-view';
import { Button, EmptyState, Gap, Screen, T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { friendlyDate } from '@/lib/dates';
import { deleteMemory, useMemory } from '@/lib/memories';
import { usePaired } from '@/lib/session';
import { space } from '@/theme';

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const memory = useMemory(cid, id);
  const [confirm, setConfirm] = useState(false);

  if (memory === undefined) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (memory === null) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={CalendarHeart} line="This memory isn't here any more." />
      </Screen>
    );
  }
  const mine = memory.ownerId === uid;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: friendlyDate(memory.date) }} />
      <View style={{ gap: space.lg }}>
        {memory.mediaIds.map((mid) => (
          <MediaById key={mid} cid={cid} mediaId={mid} caption={memory.caption} />
        ))}
        {memory.caption ? <T variant="title">{memory.caption}</T> : null}
        <T muted>
          Added by {mine ? 'you' : partnerName}
          {memory.location ? ` · ${memory.location}` : ''}
        </T>
      </View>
      {mine ? (
        <>
          <Gap h={space.xxl} />
          <Button testID="remove-memory" label="Remove from our jar" kind="ghost" onPress={() => setConfirm(true)} />
        </>
      ) : null}
      <Sheet visible={confirm} onClose={() => setConfirm(false)}>
        <T variant="title" center>
          Remove this memory?
        </T>
        <Gap h={space.sm} />
        <T muted center>
          It will be removed for both of you, along with its photo and voice clip.
        </T>
        <Gap h={space.xl} />
        <Button
          testID="confirm-remove-memory"
          label="Remove it"
          onPress={async () => {
            setConfirm(false);
            try {
              await deleteMemory(cid, memory);
              router.back();
            } catch {
              toast(gentleError.save);
            }
          }}
        />
        <Gap h={space.sm} />
        <Button label="Keep it" kind="ghost" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
