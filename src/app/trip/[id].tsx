/**
 * One trip: the shared plan (countdown, stress check, weather packing,
 * checklist, rest days) and the travel journal.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Check, CloudSun, ImagePlus, Mic, NotebookPen, Play, Plus, Trash, Video } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { useCelebrate } from '@/components/celebrate';
import { useFeedback } from '@/components/feedback';
import { MediaById } from '@/components/media-view';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { VideoNote } from '@/components/rich-media';
import { Button, Card, Chip, EmptyState, Gap, IconButton, Row, Screen, SectionTitle, Segmented, T, useInputStyle } from '@/components/ui';
import { VoiceRecorder } from '@/components/voice';
import { gentleError } from '@/lib/copy';
import { pickPhoto, pickVideo, queueTripEntry } from '@/lib/compose';
import { dayKey, friendlyDate, fromDayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { LIMITS, useMedia } from '@/lib/media';
import { usePaired } from '@/lib/session';
import {
  CATEGORY_LABEL,
  countdownLine,
  daysBetween,
  miniTaskFor,
  moodRecap,
  packingFor,
  stressReply,
  suggestRestDays,
  tripDays,
  tripPhase,
  weatherFromChoice,
  weatherLine,
  type ItemCategory,
} from '@/lib/trip-logic';
import {
  addItem,
  addNoteEntry,
  addPackingSuggestions,
  deleteTrip,
  removeEntry,
  removeItem,
  setMyTripStress,
  toggleItem,
  updateTrip,
  useTrip,
  useTripEntries,
  useTripItems,
  type Trip,
  type TripEntry,
  type TripItem,
} from '@/lib/trips';
import { tripWeather } from '@/lib/weather';
import { space, useTheme } from '@/theme';

const TRIP_MOODS = ['😍', '😊', '😌', '🥱', '🤯'];

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cid } = usePaired();
  const trip = useTrip(cid, id);
  const [tab, setTab] = useState<'plan' | 'journal'>('plan');
  const phaseIsAfter = trip ? tripPhase(trip.startDate, trip.endDate) === 'after' : false;
  const [touched, setTouched] = useState(false);
  const current = touched ? tab : phaseIsAfter ? 'journal' : tab;

  if (trip === undefined) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (trip === null) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={NotebookPen} line="This trip isn't here any more." />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: trip.title }} />
      <T muted>
        {friendlyDate(trip.startDate)} → {friendlyDate(trip.endDate)}
        {trip.destination ? ` · ${trip.destination}` : ''}
      </T>
      <Gap h={space.md} />
      <Segmented
        value={current}
        onChange={(v) => {
          setTouched(true);
          setTab(v);
        }}
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'journal', label: 'Journal' },
        ]}
      />
      <Gap />
      {current === 'plan' ? <Plan trip={trip} /> : <Journal trip={trip} />}
    </Screen>
  );
}

// ------------------------------------------------------------------ plan

function Plan({ trip }: { trip: Trip }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const { data: items } = useTripItems(cid, trip.id);
  const celebrate = useCelebrate();
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<ItemCategory>('packing');
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [askWeather, setAskWeather] = useState(false);
  const today = dayKey();
  const phase = tripPhase(trip.startDate, trip.endDate, today);
  const myStress = trip.stress?.[uid];
  const theirStress = trip.stress?.[partnerId];
  const days = tripDays(trip.startDate, trip.endDate);
  const nights = Math.max(1, daysBetween(trip.startDate, trip.endDate));
  const done = items.filter((i) => i.done).length;

  async function applyWeather(w: NonNullable<Trip['weather']>) {
    await updateTrip(cid, trip.id, { weather: w });
    await addPackingSuggestions(cid, trip.id, uid, packingFor(w), items);
    haptic.success();
    toast('Packing list updated for the weather.');
  }

  async function fetchWeather() {
    if (typeof trip.lat !== 'number' || typeof trip.lon !== 'number') {
      setAskWeather(true);
      return;
    }
    setLoadingWeather(true);
    try {
      const w = await tripWeather(trip.lat, trip.lon!, trip.startDate, trip.endDate);
      if (w) await applyWeather(w);
      else setAskWeather(true);
    } catch {
      setAskWeather(true);
    } finally {
      setLoadingWeather(false);
    }
  }

  const byCat = (cat: ItemCategory) => items.filter((i) => i.category === cat);

  return (
    <View style={{ gap: space.lg }}>
      <Card tone="sky">
        <T testID="trip-countdown" variant="title" color={c.onSky}>
          {countdownLine(trip.startDate, trip.endDate, today)}
        </T>
        {phase === 'upcoming' ? (
          <T color={c.onSky} style={{ marginTop: space.xs }}>
            Today: {miniTaskFor(daysBetween(today, trip.startDate))}
          </T>
        ) : null}
        <T variant="small" color={c.onSky} style={{ marginTop: space.sm }}>
          {items.length ? `${done} of ${items.length} ticked off together` : 'Your list is ready for ideas.'}
        </T>
      </Card>

      {phase === 'upcoming' ? (
        <Card>
          <SectionTitle>How are you feeling about the trip?</SectionTitle>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} testID={`trip-stress-${n}`} label={['Calm', 'Fine', 'A bit', 'Nervous', 'Stressed'][n - 1]} selected={myStress === n} onPress={() => setMyTripStress(cid, trip.id, uid, n).catch(() => toast(gentleError.save))} />
            ))}
          </Row>
          {myStress ? (
            <T testID="trip-stress-reply" muted style={{ marginTop: space.sm }}>
              {stressReply(myStress, theirStress)}
            </T>
          ) : null}
          {theirStress ? (
            <T variant="small" muted style={{ marginTop: space.xs }}>
              {partnerName} is feeling {['calm', 'fine', 'a bit nervous', 'nervous', 'stressed'][theirStress - 1]}. Your answers are shared on this trip.
            </T>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Weather &amp; packing</SectionTitle>
        {trip.weather ? <T testID="trip-weather">{weatherLine(trip.weather)}</T> : <T muted>We can suggest what to pack from the weather.</T>}
        <Gap h={space.md} />
        {askWeather ? (
          <>
            <T variant="small" muted>
              We couldn&apos;t look up the weather. What are you expecting?
            </T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
              {(['hot', 'mild', 'cold', 'rainy'] as const).map((k) => (
                <Chip
                  key={k}
                  label={k[0].toUpperCase() + k.slice(1)}
                  onPress={async () => {
                    setAskWeather(false);
                    await applyWeather(weatherFromChoice(k, nights)).catch(() => toast(gentleError.save));
                  }}
                />
              ))}
            </Row>
          </>
        ) : (
          <Button testID="trip-weather-fetch" small kind="soft" icon={CloudSun} label={trip.weather ? 'Refresh weather & packing' : 'Suggest packing from the weather'} loading={loadingWeather} onPress={fetchWeather} />
        )}
      </Card>

      {(['documents', 'bookings', 'packing', 'other'] as ItemCategory[]).map((cat) =>
        byCat(cat).length ? (
          <Card key={cat}>
            <SectionTitle>{CATEGORY_LABEL[cat]}</SectionTitle>
            {byCat(cat).map((it) => (
              <ItemRow key={it.id} item={it} onToggle={() => {
                if (!it.done && done === items.length - 1) celebrate('Everything\u2019s ticked off. You\u2019re ready!');
                toggleItem(cid, trip.id, it, uid).catch(() => toast(gentleError.save));
              }} onRemove={() => removeItem(cid, trip.id, it.id)} partnerId={partnerId} partnerName={partnerName} />
            ))}
          </Card>
        ) : null,
      )}

      <Card>
        <SectionTitle>Add to the list</SectionTitle>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((k) => (
            <Chip key={k} label={CATEGORY_LABEL[k]} selected={newCat === k} onPress={() => setNewCat(k)} />
          ))}
        </Row>
        <Gap h={space.sm} />
        <Row gap={space.sm}>
          <TextInput
            testID="trip-item-input"
            value={newText}
            onChangeText={setNewText}
            placeholder="Sunscreen, adapter, snacks…"
            placeholderTextColor={c.textMuted}
            style={[input, { flex: 1 }]}
            onSubmitEditing={() => {
              if (!newText.trim()) return;
              addItem(cid, trip.id, uid, newText, newCat).catch(() => toast(gentleError.save));
              setNewText('');
            }}
          />
          <IconButton
            testID="trip-item-add"
            icon={Plus}
            label="Add item"
            tone="primary"
            onPress={() => {
              if (!newText.trim()) return;
              addItem(cid, trip.id, uid, newText, newCat).catch(() => toast(gentleError.save));
              setNewText('');
            }}
          />
        </Row>
      </Card>

      {days.length >= 3 ? (
        <Card tone="sage">
          <SectionTitle>Rest days</SectionTitle>
          <T color={c.onSage}>Slow days keep trips lovely. Tap any day to keep it gentle.</T>
          <Gap h={space.sm} />
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {days.map((d) => {
              const on = trip.restDays?.includes(d);
              return (
                <Chip
                  key={d}
                  testID={`rest-${d}`}
                  label={fromDayKey(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  selected={!!on}
                  onPress={() => {
                    const next = on ? (trip.restDays ?? []).filter((x) => x !== d) : [...(trip.restDays ?? []), d].sort();
                    updateTrip(cid, trip.id, { restDays: next }).catch(() => toast(gentleError.save));
                  }}
                />
              );
            })}
          </Row>
          {!trip.restDays?.length && suggestRestDays(trip.startDate, trip.endDate).length ? (
            <Button
              small
              kind="quiet"
              label="Suggest some for us"
              style={{ marginTop: space.md }}
              onPress={() => updateTrip(cid, trip.id, { restDays: suggestRestDays(trip.startDate, trip.endDate) })}
            />
          ) : null}
        </Card>
      ) : null}

      <Button
        kind="ghost"
        small
        icon={Trash}
        label="Remove this trip"
        onPress={() => {
          router.back();
          deleteTrip(cid, trip.id).catch(() => {});
        }}
      />
    </View>
  );
}

function ItemRow({ item, onToggle, onRemove, partnerId, partnerName }: { item: TripItem; onToggle: () => void; onRemove: () => void; partnerId: string; partnerName: string }) {
  const { c } = useTheme();
  return (
    <Row gap={space.sm} style={{ minHeight: 48 }}>
      <Pressable
        testID={`item-${item.text}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.text}
        onPress={() => {
          haptic.tap();
          onToggle();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1, minHeight: 48 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: item.done ? c.ring : c.border, backgroundColor: item.done ? c.ring : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {item.done ? <Check color={c.surface} size={16} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <T style={item.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>{item.text}</T>
          {item.done && item.doneBy === partnerId ? (
            <T variant="small" muted>
              {partnerName} got this
            </T>
          ) : item.suggested && !item.done ? (
            <T variant="small" muted>
              Suggested for the weather
            </T>
          ) : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.text}`} hitSlop={8} onPress={onRemove} style={{ padding: 6 }}>
        <Trash color={c.textMuted} size={15} />
      </Pressable>
    </Row>
  );
}

// --------------------------------------------------------------- journal

function EntryMedia({ cid, entry }: { cid: string; entry: TripEntry }) {
  const media = useMedia(cid, entry.mediaId);
  if (!entry.mediaId) return null;
  if (media === undefined) return <ActivityIndicator />;
  if (media === null) return <T variant="small" muted>This was removed by its owner.</T>;
  if (media.type === 'video') return <VideoNote media={media} />;
  return <MediaById cid={cid} mediaId={entry.mediaId} caption={entry.caption} />;
}

function Journal({ trip }: { trip: Trip }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast, ensurePermission } = useFeedback();
  const { data: entries, ready } = useTripEntries(cid, trip.id);
  const pending = useOutbox((j) => j.uid === uid && j.target.kind === 'tripEntry' && j.target.tripId === trip.id);
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState<string | undefined>();
  const [recording, setRecording] = useState(false);
  const today = dayKey();
  const date = today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today;

  const visual = entries.filter((e) => e.type === 'photo' || e.type === 'video');
  const voices = entries.filter((e) => e.type === 'voice');
  const notes = entries.filter((e) => e.type === 'note');
  const recap = moodRecap(entries.map((e) => e.mood));
  const reset = () => {
    setCaption('');
    setMood(undefined);
  };

  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <SectionTitle>Add to the journal</SectionTitle>
        <TextInput testID="entry-caption" value={caption} onChangeText={setCaption} placeholder="What happened today?" placeholderTextColor={c.textMuted} multiline maxLength={1000} style={[input, { minHeight: 64, textAlignVertical: 'top' }]} />
        <Gap h={space.sm} />
        <Row gap={space.sm}>
          <T variant="small" muted>
            Trip mood
          </T>
          {TRIP_MOODS.map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mood === m }} onPress={() => setMood(mood === m ? undefined : m)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: mood === m ? c.primarySoft : 'transparent' }}>
              <T style={{ fontSize: 22, lineHeight: 28 }}>{m}</T>
            </Pressable>
          ))}
        </Row>
        <Gap h={space.sm} />
        <Row gap={space.sm}>
          <IconButton
            testID="entry-photo"
            icon={ImagePlus}
            label="Add a photo"
            onPress={async () => {
              if (!(await ensurePermission('photos'))) return;
              const p = await pickPhoto('library').catch(() => null);
              if (p) {
                await queueTripEntry({ uid, cid }, trip.id, { kind: 'photo', photo: p }, caption, mood, date);
                reset();
              }
            }}
          />
          <IconButton
            icon={Video}
            label="Add a video"
            onPress={async () => {
              if (!(await ensurePermission('photos'))) return;
              const v = await pickVideo('library').catch(() => null);
              if (v === 'too-long') toast('Videos can be up to 60 seconds.');
              else if (v) {
                await queueTripEntry({ uid, cid }, trip.id, { kind: 'video', video: v }, caption, mood, date);
                reset();
              }
            }}
          />
          <IconButton icon={Mic} label="Record a voice diary" onPress={() => setRecording((r) => !r)} />
          <Button
            testID="entry-note"
            small
            label="Save note"
            style={{ flex: 1 }}
            disabled={!caption.trim()}
            onPress={async () => {
              await addNoteEntry(cid, trip.id, uid, caption, mood, date).catch(() => toast(gentleError.save));
              reset();
            }}
          />
        </Row>
        {recording ? (
          <View style={{ marginTop: space.md }}>
            <VoiceRecorder
              maxMs={LIMITS.voiceMaxMs}
              hint="Hold to record today's diary"
              onDone={async (r) => {
                setRecording(false);
                await queueTripEntry({ uid, cid }, trip.id, { kind: 'voice', uri: r.uri, durationMs: r.durationMs }, caption, mood, date);
                reset();
              }}
            />
          </View>
        ) : null}
      </Card>

      {pending.map((j) => (
        <OutboxRow key={j.id} job={j} />
      ))}

      {recap.length ? (
        <Card tone="butter">
          <SectionTitle>Trip mood</SectionTitle>
          <Row gap={space.lg}>
            {recap.map((r) => (
              <View key={r.emoji} style={{ alignItems: 'center' }}>
                <T style={{ fontSize: 30, lineHeight: 38 }}>{r.emoji}</T>
                <T variant="small" color={c.onButter}>
                  ×{r.count}
                </T>
              </View>
            ))}
          </Row>
        </Card>
      ) : null}

      {visual.length ? (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">Album</T>
            {visual.some((e) => e.type === 'photo') ? (
              <Button testID="open-slideshow" small kind="soft" icon={Play} label="Slideshow" onPress={() => router.push({ pathname: '/trip/slideshow', params: { id: trip.id } })} />
            ) : null}
          </Row>
          {visual.map((e) => (
            <Card key={e.id} style={{ padding: space.md }}>
              <EntryMedia cid={cid} entry={e} />
              <EntryFooter e={e} uid={uid} partnerName={partnerName} onRemove={() => removeEntry(cid, trip.id, e.id)} />
            </Card>
          ))}
        </>
      ) : null}

      {voices.length ? (
        <>
          <T variant="heading">Voice diary</T>
          {voices.map((e) => (
            <Card key={e.id} style={{ padding: space.md }}>
              <EntryMedia cid={cid} entry={e} />
              <EntryFooter e={e} uid={uid} partnerName={partnerName} onRemove={() => removeEntry(cid, trip.id, e.id)} />
            </Card>
          ))}
        </>
      ) : null}

      {notes.length ? (
        <>
          <T variant="heading">Notes</T>
          {notes.map((e) => (
            <Card key={e.id} style={{ padding: space.md }}>
              <EntryFooter e={e} uid={uid} partnerName={partnerName} onRemove={() => removeEntry(cid, trip.id, e.id)} />
            </Card>
          ))}
        </>
      ) : null}

      {ready && entries.length === 0 && pending.length === 0 ? <EmptyState icon={NotebookPen} line="No memories from this trip yet. Let's make one." /> : null}
    </View>
  );
}

function EntryFooter({ e, uid, partnerName, onRemove }: { e: TripEntry; uid: string; partnerName: string; onRemove: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: e.mediaId ? space.sm : 0, gap: 2 }}>
      {e.caption ? <T testID="entry-text">{e.caption}</T> : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" muted>
          {e.mood ? `${e.mood} ` : ''}
          {friendlyDate(e.date)} · {e.ownerId === uid ? 'you' : partnerName}
        </T>
        {e.ownerId === uid ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Remove entry" hitSlop={8} onPress={onRemove} style={{ padding: 6 }}>
            <Trash color={c.textMuted} size={15} />
          </Pressable>
        ) : null}
      </Row>
    </View>
  );
}

