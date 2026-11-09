/**
 * Gratitude Wall: one thank-you per day each (text, photo, or voice), plus a
 * weekly appreciation summary.
 */
import { Image } from 'expo-image';
import { HandHeart, ImagePlus, Mic, Send, Sparkles, Trash, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useCelebrate } from '@/components/celebrate';
import { useFeedback } from '@/components/feedback';
import { MediaById } from '@/components/media-view';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { Button, Card, EmptyState, Gap, IconButton, Row, Screen, SectionTitle, T, useInputStyle } from '@/components/ui';
import { VoicePlayer, VoiceRecorder, type Recording } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { pickPhoto, queueGratitudeMedia } from '@/lib/compose';
import { dayKey, friendlyDate, lastNDays } from '@/lib/dates';
import { deleteGratitude, sendGratitudeText, useGratitude, weeklyAppreciation } from '@/lib/gratitude';
import { haptic } from '@/lib/haptics';
import { LIMITS, type PreparedImage } from '@/lib/media';
import { usePaired } from '@/lib/session';
import type { Gratitude as G } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

function Entry({ g, mine, partnerName, cid, onRemove }: { g: G; mine: boolean; partnerName: string; cid: string; onRemove?: () => void }) {
  const { c } = useTheme();
  return (
    <View
      testID="gratitude-entry"
      style={{
        backgroundColor: mine ? c.primarySoft : c.surface,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
        borderWidth: mine ? 0 : 1,
        borderColor: c.border,
      }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="label" muted>
          {(mine ? `YOU → ${partnerName}` : `${partnerName} → YOU`).toUpperCase()} · {friendlyDate(g.date).toUpperCase()}
        </T>
        {onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Remove this thank-you" hitSlop={10} onPress={onRemove} style={{ padding: 4 }}>
            <Trash color={c.textMuted} size={16} />
          </Pressable>
        ) : null}
      </Row>
      {g.mediaId ? <MediaById cid={cid} mediaId={g.mediaId} caption={g.text} /> : null}
      {g.text ? <T variant="heading">{g.text}</T> : null}
    </View>
  );
}

export default function GratitudeWall() {
  const { c } = useTheme();
  const input = useInputStyle();
  const who = usePaired();
  const { uid, cid, partnerId, partnerName } = who;
  const { toast, ensurePermission } = useFeedback();
  const celebrate = useCelebrate();
  const month = useMemo(() => lastNDays(30), []);
  const week = month.slice(-7);
  const today = dayKey();
  const { items, ready } = useGratitude(cid, month[0]);
  const pending = useOutbox((j) => j.uid === uid && j.cid === cid && j.target.kind === 'gratitude');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [voice, setVoice] = useState<Recording | null>(null);
  const [recording, setRecording] = useState(false);

  const mineToday = items.find((g) => g.ownerId === uid && g.date === today);
  const theirsToday = items.find((g) => g.ownerId === partnerId && g.date === today);
  const summary = weeklyAppreciation(items, uid, partnerName, week);
  const bothToday = !!mineToday && !!theirsToday;
  useEffect(() => {
    if (!bothToday) return;
    const key = `together.gratitudeBoth.${uid}.${today}`;
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (!seen) {
          celebrate('You both said thank you today.');
          return AsyncStorage.setItem(key, '1');
        }
      })
      .catch(() => {});
  }, [bothToday, uid, today, celebrate]);
  const alreadySending = pending.some((j) => j.target.kind === 'gratitude' && j.target.date === today);

  async function send() {
    try {
      if (photo) await queueGratitudeMedia(who, { kind: 'photo', photo }, text, today);
      else if (voice) await queueGratitudeMedia(who, { kind: 'voice', uri: voice.uri, durationMs: voice.durationMs }, text, today);
      else await sendGratitudeText(who, text, today);
      haptic.success();
      setText('');
      setPhoto(null);
      setVoice(null);
      toast(`Thank-you sent to ${partnerName} ♥`);
    } catch {
      toast(gentleError.send);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card tone="butter">
        <Row gap={space.sm}>
          <Sparkles color={c.onButter} size={20} />
          <T testID="weekly-summary" variant="heading" color={c.onButter} style={{ flex: 1 }}>
            {summary.line}
          </T>
        </Row>
      </Card>
      <Gap />

      {theirsToday ? (
        <>
          <Entry g={theirsToday} mine={false} partnerName={partnerName} cid={cid} />
          <Gap />
        </>
      ) : null}

      {mineToday ? (
        <Entry g={mineToday} mine partnerName={partnerName} cid={cid} onRemove={() => deleteGratitude(cid, mineToday).catch(() => toast(gentleError.save))} />
      ) : alreadySending ? (
        pending.map((j) => <OutboxRow key={j.id} job={j} />)
      ) : (
        <Card>
          <T variant="heading">Today&apos;s thank-you to {partnerName}</T>
          <T variant="small" muted>
            One a day, big or small.
          </T>
          <Gap h={space.md} />
          <TextInput
            testID="gratitude-input"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            placeholder={`Thank you for…`}
            placeholderTextColor={c.textMuted}
            style={[input, { minHeight: 80, textAlignVertical: 'top' }]}
          />
          {photo ? (
            <View style={{ marginTop: space.md }}>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: photo.width / photo.height, maxHeight: 260, borderRadius: radius.md }} contentFit="cover" accessibilityLabel="Photo to send" />
              <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} style={{ position: 'absolute', top: 8, right: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <X color={c.text} size={18} />
              </Pressable>
            </View>
          ) : null}
          {voice ? (
            <Row gap={space.sm} style={{ marginTop: space.md }}>
              <View style={{ flex: 1 }}>
                <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Remove voice note" onPress={() => setVoice(null)} hitSlop={8} style={{ padding: space.sm }}>
                <X color={c.textMuted} size={20} />
              </Pressable>
            </Row>
          ) : recording ? (
            <View style={{ marginTop: space.md }}>
              <VoiceRecorder
                maxMs={LIMITS.voiceMaxMs}
                onDone={(r) => {
                  setVoice(r);
                  setPhoto(null);
                  setRecording(false);
                }}
              />
            </View>
          ) : null}
          <Gap h={space.md} />
          <Row gap={space.sm}>
            <IconButton
              icon={ImagePlus}
              label="Add a photo"
              onPress={async () => {
                if (!(await ensurePermission('photos'))) return;
                const p = await pickPhoto('library').catch(() => null);
                if (p) {
                  setPhoto(p);
                  setVoice(null);
                }
              }}
            />
            <IconButton icon={Mic} label="Add a voice note" onPress={() => setRecording((r) => !r)} />
            <Button testID="send-gratitude" small icon={Send} label="Send thank-you" style={{ flex: 1 }} onPress={send} disabled={!text.trim() && !photo && !voice} />
          </Row>
        </Card>
      )}

      <Gap h={space.xl} />
      <SectionTitle>This month</SectionTitle>
      {ready && items.filter((g) => g.date !== today).length === 0 ? (
        <EmptyState icon={HandHeart} line="Your thank-yous will gather here, one day at a time." />
      ) : null}
      <View style={{ gap: space.md }}>
        {items
          .filter((g) => g.date !== today)
          .map((g) => (
            <Entry key={g.id} g={g} mine={g.ownerId === uid} partnerName={partnerName} cid={cid} />
          ))}
      </View>
    </Screen>
  );
}
