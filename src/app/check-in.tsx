/**
 * Evening check-in: "What was one good moment today?"
 * Private by default. Optionally also added to the shared Memory Jar.
 */
import { router } from 'expo-router';
import { Lock, Moon, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { StoredPrivateVoice } from '@/components/media-view';
import { Button, Card, Gap, Row, Screen, Segmented, T, ToggleRow, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder, type Recording } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { queueCheckInVoice, queueMemory } from '@/lib/compose';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { saveCheckIn, useMyDays } from '@/lib/logs';
import { LIMITS } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { care } from '@/lib/together-data';
import type { CheckIn as CheckInT } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function CheckIn() {
  const { uid } = usePaired();
  const today = dayKey();
  const { days, ready } = useMyDays(uid, today);
  if (!ready) return <ActivityIndicator style={{ marginTop: 48 }} />;
  const existing = days[today]?.checkIn;
  return existing && (existing.text || existing.voicePath || existing.memoryId) ? <Done checkIn={existing} /> : <Form />;
}

function Done({ checkIn }: { checkIn: CheckInT }) {
  const { c } = useTheme();
  return (
    <Screen edges={['bottom']}>
      <Card tone="lavender">
        <Row gap={space.sm}>
          <Moon color={c.primary} size={22} />
          <T variant="heading">Tonight&apos;s good moment</T>
        </Row>
        <Gap h={space.md} />
        {checkIn.text ? <T testID="checkin-text">{checkIn.text}</T> : null}
        {checkIn.voicePath ? (
          <View style={{ marginTop: space.md }}>
            <StoredPrivateVoice path={checkIn.voicePath} durationMs={checkIn.voiceMs} />
          </View>
        ) : null}
        {checkIn.memoryId ? (
          <T variant="small" muted style={{ marginTop: space.md }}>
            Also in your shared Memory Jar.
          </T>
        ) : null}
      </Card>
      <Gap />
      <T muted center>
        Thank you for noticing it. Sleep well.
      </T>
      <Gap />
      <Button label="Close" kind="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function Form() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<'type' | 'talk'>('type');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<Recording | null>(null);
  const [toJar, setToJar] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasAnswer = !!text.trim() || !!voice;

  async function save() {
    setBusy(true);
    try {
      const date = dayKey();
      const memoryId = toJar ? await queueMemory({ uid, cid }, text.trim() || 'A good moment', date, null, voice) : undefined;
      if (voice && !toJar) {
        // Private voice: uploaded only to my own private folder.
        await queueCheckInVoice(uid, voice.uri, voice.durationMs, text, undefined, date);
      } else {
        await saveCheckIn(uid, { text: text.trim(), memoryId }, date);
      }
      void care({ uid, cid });
      haptic.success();
      toast('A good moment, kept. Sleep well.');
      router.back();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <T variant="title">What was one good moment today?</T>
      <T muted>Big or tiny, it all counts.</T>
      <Gap />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'type', label: 'Write it' },
          { value: 'talk', label: 'Say it' },
        ]}
      />
      <Gap />
      {mode === 'type' ? (
        <TextInput
          testID="checkin-input"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          placeholder="The coffee was perfect, we laughed at dinner…"
          placeholderTextColor={c.textMuted}
          style={[input, { minHeight: 120, textAlignVertical: 'top' }]}
        />
      ) : voice ? (
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Record again" onPress={() => setVoice(null)} hitSlop={8} style={{ padding: space.sm }}>
            <X color={c.textMuted} size={20} />
          </Pressable>
        </Row>
      ) : (
        <VoiceRecorder maxMs={LIMITS.voiceMaxMs} hint="Hold to tell it" onDone={setVoice} />
      )}
      <Gap h={space.xl} />
      <Card>
        <ToggleRow
          testID="checkin-to-jar"
          title="Also add it to our Memory Jar"
          detail={`${partnerName} will see it there. Otherwise it stays just for you.`}
          value={toJar}
          onChange={setToJar}
        />
      </Card>
      <Gap h={space.sm} />
      {!toJar ? (
        <Row gap={space.sm} style={{ justifyContent: 'center' }}>
          <Lock color={c.textMuted} size={14} />
          <T variant="small" muted>
            Private: only you can see this check-in.
          </T>
        </Row>
      ) : null}
      <Gap h={space.xl} />
      <Button testID="save-checkin" label="Keep this moment" onPress={save} loading={busy} disabled={!hasAnswer} hint="Write or say one good moment first." />
    </Screen>
  );
}
