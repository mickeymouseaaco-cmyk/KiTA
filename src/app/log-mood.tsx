import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Camera, Mic } from 'lucide-react-native';
import { TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { MoodPicker, StressPicker } from '@/components/mood';
import { Button, Field, Gap, Row, Screen, SkeletonPage, T, ToggleRow, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder } from '@/components/voice';
import { pickSelfie, queueMoodMedia, type MoodAttachment } from '@/lib/compose';
import { LIMITS } from '@/lib/media';
import { gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { saveMood, setShareCategory, useMyDays, useShareSettings } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import type { MoodEntry } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function LogMood() {
  const { uid } = usePaired();
  const today = dayKey();
  const { days, ready } = useMyDays(uid, today);
  if (!ready) return <SkeletonPage />;
  return <MoodForm initial={days[today]?.mood} />;
}

function MoodForm({ initial }: { initial?: MoodEntry }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const share = useShareSettings(uid);

  const [mood, setMood] = useState<{ emoji: string; label: string } | null>(
    initial ? { emoji: initial.emoji, label: initial.label } : null,
  );
  const [stress, setStress] = useState<MoodEntry['stress']>(initial?.stress ?? 2);
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<MoodAttachment | null>(null);
  const [recording, setRecording] = useState(false);
  const { ensurePermission } = useFeedback();
  const sharesMedia = !!share?.mood && !!share?.media;

  async function save() {
    if (!mood) return;
    setBusy(true);
    try {
      await saveMood({ uid, cid }, { ...mood, stress, note });
      if (attachment) await queueMoodMedia(uid, cid, attachment, sharesMedia);
      haptic.success();
      toast(stress >= 4 ? 'Thank you for checking in. Go gently today.' : 'Thank you for checking in.');
      router.back();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <T variant="heading">How are you feeling?</T>
      <T muted>There&apos;s no wrong answer.</T>
      <Gap h={space.lg} />
      <MoodPicker value={mood?.label} onChange={(m) => setMood({ emoji: m.emoji, label: m.label })} />
      <Gap h={space.xl} />
      <Field label="How heavy does today feel?">
        <StressPicker value={stress} onChange={setStress} />
      </Field>
      <Gap h={space.xl} />
      <Field label="A note, if you like" helper="Optional. Only shared if mood sharing is on.">
        <TextInput
          testID="mood-note"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={280}
          placeholder="Anything on your mind…"
          placeholderTextColor={c.textMuted}
          style={[input, { minHeight: 96, textAlignVertical: 'top' }]}
        />
      </Field>
      <Gap h={space.lg} />
      <Field label="A selfie or voice note, if you like" helper={sharesMedia ? `${partnerName} will see it with your mood.` : 'Kept just for you. It\u2019s shared only if both mood and photo & voice sharing are on.'}>
        {attachment?.kind === 'photo' ? (
          <Row gap={space.md}>
            <Image source={{ uri: attachment.photo.uri }} style={{ width: 84, height: 84, borderRadius: 42 }} contentFit="cover" accessibilityLabel="Your selfie" />
            <Button small kind="ghost" label="Remove" onPress={() => setAttachment(null)} />
          </Row>
        ) : attachment?.kind === 'voice' ? (
          <Row gap={space.sm}>
            <View style={{ flex: 1 }}>
              <VoicePlayer uri={attachment.uri} durationMs={attachment.durationMs} />
            </View>
            <Button small kind="ghost" label="Remove" onPress={() => setAttachment(null)} />
          </Row>
        ) : recording ? (
          <VoiceRecorder
            maxMs={LIMITS.voiceMaxMs}
            onDone={(r) => {
              setAttachment({ kind: 'voice', uri: r.uri, durationMs: r.durationMs });
              setRecording(false);
            }}
          />
        ) : (
          <Row gap={space.sm}>
            <Button
              testID="mood-selfie"
              small
              kind="quiet"
              icon={Camera}
              label="Selfie"
              style={{ flex: 1 }}
              onPress={async () => {
                if (!(await ensurePermission('camera'))) return;
                const p = await pickSelfie().catch(() => null);
                if (p) setAttachment({ kind: 'photo', photo: p });
              }}
            />
            <Button small kind="quiet" icon={Mic} label="Voice" style={{ flex: 1 }} onPress={() => setRecording(true)} />
          </Row>
        )}
      </Field>
      <Gap h={space.lg} />
      {share ? (
        <ToggleRow
          testID="share-mood-toggle"
          title={`Share my mood with ${partnerName}`}
          detail="Off by default. You can change this any time."
          value={share.mood}
          onChange={(v) => setShareCategory({ uid, cid }, 'mood', v).catch(() => toast(gentleError.save))}
        />
      ) : null}
      <Gap h={space.xl} />
      <Button testID="save-mood" label="Save check-in" onPress={save} loading={busy} disabled={!mood} hint="Tap how you feel first." />
    </Screen>
  );
}
