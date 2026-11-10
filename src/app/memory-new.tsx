import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ImagePlus, Mic, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Chip, Field, Gap, Row, Screen, T, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder, type Recording } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { pickPhoto, queueMemory } from '@/lib/compose';
import { addDays, dayKey, friendlyDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { LIMITS, type PreparedImage } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';

export default function NewMemory() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid } = usePaired();
  const { ensurePermission, toast } = useFeedback();
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [voice, setVoice] = useState<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(dayKey());
  const [busy, setBusy] = useState(false);

  async function addPhoto(source: 'camera' | 'library') {
    if (!(await ensurePermission(source === 'camera' ? 'camera' : 'photos'))) return;
    try {
      const p = await pickPhoto(source);
      if (p) setPhoto(p);
    } catch {
      toast('We couldn’t open that photo. Let’s try another.');
    }
  }

  async function save() {
    setBusy(true);
    try {
      await queueMemory({ uid, cid }, caption, date, photo, voice);
      haptic.success();
      router.back();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  const dateChoices = [dayKey(), dayKey(addDays(new Date(), -1)), dayKey(addDays(new Date(), -7))];

  return (
    <Screen edges={['bottom']}>
      <T muted>A photo, a voice clip, or both. It goes into your shared jar for both of you.</T>
      <Gap h={space.lg} />

      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight: 360, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Memory photo" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => setPhoto(null)}
            style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <X color={c.text} size={20} />
          </Pressable>
        </View>
      ) : (
        <Row gap={space.sm}>
          <Button kind="soft" small icon={Camera} label="Camera" style={{ flex: 1 }} onPress={() => addPhoto('camera')} />
          <Button testID="memory-photo" kind="soft" small icon={ImagePlus} label="Photo" style={{ flex: 1 }} onPress={() => addPhoto('library')} />
        </Row>
      )}
      <Gap h={space.lg} />

      {voice ? (
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove voice clip" onPress={() => setVoice(null)} hitSlop={8} style={{ padding: space.sm }}>
            <X color={c.textMuted} size={20} />
          </Pressable>
        </Row>
      ) : recording ? (
        <VoiceRecorder
          testID="memory-record"
          maxMs={LIMITS.voiceMaxMs}
          onDone={(r) => {
            setVoice(r);
            setRecording(false);
          }}
        />
      ) : (
        <Button testID="memory-voice" kind="quiet" small icon={Mic} label="Add a voice clip" onPress={() => setRecording(true)} />
      )}
      <Gap h={space.xl} />

      <Field label="Caption">
        <TextInput
          testID="memory-caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="What made this moment special?"
          placeholderTextColor={c.textMuted}
          maxLength={500}
          multiline
          style={[input, { minHeight: 80, textAlignVertical: 'top' }]}
        />
      </Field>
      <Gap h={space.lg} />
      <Field label="When">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {dateChoices.map((d, i) => (
            <Chip key={d} label={i === 2 ? 'A week ago' : friendlyDate(d)} selected={date === d} onPress={() => setDate(d)} />
          ))}
        </View>
      </Field>
      <Gap h={space.xxl} />
      <Button testID="save-memory" label="Add to our jar" onPress={save} loading={busy} disabled={!photo && !voice && !caption.trim()} hint="Add a photo, a voice clip or a few words first." />
    </Screen>
  );
}
