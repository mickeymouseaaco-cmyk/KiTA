/**
 * Schedule a love note, or hide a surprise: text, photo, or voice that unlocks
 * on a date or the next time your partner opens the app.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Gift, ImagePlus, Mic, Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, Field, Gap, IconButton, Row, Screen, Segmented, T, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder, type Recording } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { pickPhoto, queueScheduledMedia } from '@/lib/compose';
import { addDays } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { LIMITS, type PreparedImage } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { scheduleText } from '@/lib/together-data';
import { radius, space, useTheme } from '@/theme';

type Mode = 'later' | 'surprise-date' | 'surprise-open';

const HOURS = [8, 12, 18, 21];

function at(daysAhead: number, hour: number): Date {
  const d = addDays(new Date(), daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export default function ScheduleNote() {
  const { c } = useTheme();
  const input = useInputStyle();
  const who = usePaired();
  const { partnerName } = who;
  const { toast, ensurePermission } = useFeedback();
  const [mode, setMode] = useState<Mode>('later');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [voice, setVoice] = useState<Recording | null>(null);
  const [recording, setRecording] = useState(false);
  const [days, setDays] = useState(1);
  const [hour, setHour] = useState(8);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  // "Next open" surprises unlock right away (backdated a little to allow for clock differences).
  const when = mode === 'surprise-open' ? new Date(openedAt - 10 * 60_000) : at(days, hour);
  const tooSoon = mode !== 'surprise-open' && when.getTime() < openedAt + 60_000;
  const whenLabel =
    mode === 'surprise-open'
      ? `The next time ${partnerName} opens KiTA`
      : when.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function send() {
    setBusy(true);
    const surprise = mode === 'later' ? 'none' : mode === 'surprise-date' ? 'date' : 'open';
    try {
      if (photo) await queueScheduledMedia(who, { kind: 'photo', photo }, text, when.getTime(), surprise);
      else if (voice) await queueScheduledMedia(who, { kind: 'voice', uri: voice.uri, durationMs: voice.durationMs }, text, when.getTime(), surprise);
      else await scheduleText(who, text, when.getTime(), surprise);
      haptic.success();
      toast(mode === 'later' ? 'Scheduled. It’ll arrive right on time.' : 'Your surprise is hidden and waiting ♥');
      router.back();
    } catch {
      toast(gentleError.send);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'later', label: 'Send later' },
          { value: 'surprise-date', label: 'Surprise' },
          { value: 'surprise-open', label: 'Next open' },
        ]}
      />
      <Gap h={space.sm} />
      <T variant="small" muted>
        {mode === 'later'
          ? `Arrives as a normal love note at the time you choose.`
          : mode === 'surprise-date'
            ? `Stays hidden until the day you choose, then ${partnerName} gets to unwrap it.`
            : `${partnerName} will find it waiting next time they open the app.`}
      </T>
      <Gap />
      <Field label="Your note">
        <TextInput
          testID="sched-text"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          placeholder={mode === 'later' ? 'Good luck today, you’ve got this…' : 'A little something for you…'}
          placeholderTextColor={c.textMuted}
          style={[input, { minHeight: 100, textAlignVertical: 'top' }]}
        />
      </Field>
      <Gap h={space.md} />
      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight: 240, borderRadius: radius.md }} contentFit="cover" />
          <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} style={{ position: 'absolute', top: 8, right: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <X color={c.text} size={18} />
          </Pressable>
        </View>
      ) : voice ? (
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove voice note" onPress={() => setVoice(null)} hitSlop={8} style={{ padding: space.sm }}>
            <X color={c.textMuted} size={20} />
          </Pressable>
        </Row>
      ) : recording ? (
        <VoiceRecorder maxMs={LIMITS.voiceMaxMs} onDone={(r) => { setVoice(r); setRecording(false); }} />
      ) : (
        <Row gap={space.sm}>
          <Button
            small
            kind="quiet"
            icon={ImagePlus}
            label="Add a photo"
            style={{ flex: 1 }}
            onPress={async () => {
              if (!(await ensurePermission('photos'))) return;
              const p = await pickPhoto('library').catch(() => null);
              if (p) setPhoto(p);
            }}
          />
          <Button small kind="quiet" icon={Mic} label="Add your voice" style={{ flex: 1 }} onPress={() => setRecording(true)} />
        </Row>
      )}
      <Gap h={space.xl} />
      {mode !== 'surprise-open' ? (
        <>
          <Field label="Which day">
            <Row gap={space.md}>
              <IconButton icon={Minus} label="A day earlier" onPress={() => setDays((d) => Math.max(0, d - 1))} />
              <T variant="heading" style={{ minWidth: 110, textAlign: 'center' }}>
                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
              </T>
              <IconButton icon={Plus} label="A day later" onPress={() => setDays((d) => Math.min(365, d + 1))} />
            </Row>
          </Field>
          <Gap h={space.md} />
          <Field label="What time">
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {HOURS.map((h) => (
                <Chip key={h} label={new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })} selected={hour === h} onPress={() => setHour(h)} />
              ))}
            </Row>
          </Field>
          <Gap />
        </>
      ) : null}
      <Card tone={mode === 'later' ? 'lavender' : 'rose'}>
        <Row gap={space.sm}>
          <Gift color={mode === 'later' ? c.primary : c.heart} size={20} />
          <T testID="sched-when" style={{ flex: 1 }}>
            {whenLabel}
          </T>
        </Row>
        {tooSoon ? (
          <T variant="small" muted style={{ marginTop: space.xs }}>
            That time has already passed today. Pick a later hour or another day.
          </T>
        ) : null}
      </Card>
      <Gap />
      <Button testID="sched-send" label={mode === 'later' ? 'Schedule it' : 'Hide the surprise'} loading={busy} onPress={send} disabled={tooSoon || (!text.trim() && !photo && !voice)} hint={tooSoon ? 'Pick a time a little later.' : 'Write a note or add a photo or voice first.'} />
    </Screen>
  );
}
