/**
 * A trip's itinerary: each day of the trip, with the plans for it in time
 * order. Both of you can add, change and remove plans, and see each other's
 * changes straight away.
 */
import { CalendarPlus, Clock, Coffee, MapPin, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Sheet, useFeedback } from '@/components/feedback';
import { Button, Card, Chip, Gap, Row, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { dayKey, fromDayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { STOP_LIMITS, mapsUrl, parseTime, stopsByDay, timeLabel } from '@/lib/itinerary-pure';
import { usePaired } from '@/lib/session';
import { tripDays } from '@/lib/trip-logic';
import { addStop, removeStop, updateStop, useTripStops, type Trip, type TripStop } from '@/lib/trips';
import { radius, space, useTheme } from '@/theme';

const dayName = (d: string) => fromDayKey(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
const dayShort = (d: string) => fromDayKey(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

export function Itinerary({ trip }: { trip: Trip }) {
  const { cid } = usePaired();
  const { data: stops } = useTripStops(cid, trip.id);
  const days = tripDays(trip.startDate, trip.endDate);
  const { byDay, other } = stopsByDay(stops, days);
  const [editing, setEditing] = useState<{ stop?: TripStop; day: string } | null>(null);
  const today = dayKey();
  const planned = stops.length;

  return (
    <View style={{ gap: space.md }}>
      <T muted>
        {planned
          ? `${planned} ${planned === 1 ? 'plan' : 'plans'} across ${days.length} ${days.length === 1 ? 'day' : 'days'}. Tap a plan to change it.`
          : 'Plan each day together: places to see, food to try, bookings. You both see changes right away.'}
      </T>
      {days.map((d, i) => (
        <DayCard
          key={d}
          day={d}
          index={i}
          isToday={d === today}
          rest={!!trip.restDays?.includes(d)}
          stops={byDay.get(d) ?? []}
          destination={trip.destination}
          onAdd={() => setEditing({ day: d })}
          onEdit={(stop) => setEditing({ stop, day: stop.day })}
        />
      ))}
      {other.length ? (
        <Card>
          <T variant="bodyStrong">Other days</T>
          <T variant="small" muted>
            These are outside the trip dates now. Tap one to move it.
          </T>
          <Gap h={space.sm} />
          {other.map((s) => (
            <StopRow key={s.id} stop={s} destination={trip.destination} onPress={() => setEditing({ stop: s, day: s.day })} showDay />
          ))}
        </Card>
      ) : null}

      <Sheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing ? <StopEditor key={editing.stop?.id ?? `new-${editing.day}`} trip={trip} days={days} start={editing} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </View>
  );
}

function DayCard({
  day,
  index,
  isToday,
  rest,
  stops,
  destination,
  onAdd,
  onEdit,
}: {
  day: string;
  index: number;
  isToday: boolean;
  rest: boolean;
  stops: TripStop[];
  destination?: string;
  onAdd: () => void;
  onEdit: (s: TripStop) => void;
}) {
  const { c } = useTheme();
  return (
    <Card tone={isToday ? 'sky' : 'surface'}>
      <View testID={`itinerary-day-${day}`}>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
            <T variant="small" color={c.onPrimary} style={{ fontFamily: 'Raleway_700Bold' }}>
              Day {index + 1}
            </T>
          </View>
          <T variant="bodyStrong" style={{ flexShrink: 1 }}>
            {dayName(day)}
          </T>
          {isToday ? (
            <T variant="small" color={c.primary} style={{ fontFamily: 'Raleway_700Bold' }}>
              Today
            </T>
          ) : null}
          {rest ? (
            <Row gap={4} style={{ backgroundColor: c.sage, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Coffee color={c.onSage} size={12} />
              <T variant="small" color={c.onSage}>
                Rest day
              </T>
            </Row>
          ) : null}
        </Row>
        <Gap h={space.sm} />
        {stops.length ? (
          stops.map((s, i) => <StopRow key={s.id} stop={s} destination={destination} onPress={() => onEdit(s)} last={i === stops.length - 1} />)
        ) : (
          <T variant="small" muted style={{ paddingVertical: space.xs }}>
            {rest ? 'A slow day. Nothing planned, and that’s the plan.' : 'Nothing planned yet.'}
          </T>
        )}
        <Gap h={space.sm} />
        <Button testID={`add-stop-${day}`} small kind="soft" icon={Plus} label={`Add to Day ${index + 1}`} onPress={onAdd} />
      </View>
    </Card>
  );
}

function StopRow({ stop, destination, onPress, last, showDay }: { stop: TripStop; destination?: string; onPress: () => void; last?: boolean; showDay?: boolean }) {
  const { c } = useTheme();
  const { uid, partnerName } = usePaired();
  const when = stop.time ? timeLabel(stop.time) : 'Any time';
  return (
    <Pressable
      testID={`stop-${stop.title}`}
      accessibilityRole="button"
      accessibilityLabel={`${when}: ${stop.title}${stop.place ? `, at ${stop.place}` : ''}. Tap to change`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', gap: space.sm, borderRadius: radius.md, backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      <View style={{ width: 66, paddingTop: 2 }}>
        <T variant="small" color={stop.time ? c.text : c.textMuted} style={{ fontFamily: stop.time ? 'Raleway_700Bold' : undefined }}>
          {showDay ? dayShort(stop.day) : when}
        </T>
      </View>
      {/* timeline */}
      <View style={{ width: 12, alignItems: 'center' }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: stop.time ? c.primary : c.surface, borderWidth: 2, borderColor: c.primary, marginTop: 5 }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: space.md, gap: 2 }}>
        <T variant="bodyStrong">{stop.title}</T>
        {stop.place ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${stop.place} in maps`}
            hitSlop={6}
            onPress={() => Linking.openURL(mapsUrl(stop.place!, destination)).catch(() => {})}>
            <Row gap={4}>
              <MapPin color={c.primary} size={14} />
              <T variant="small" color={c.primary} style={{ flexShrink: 1 }}>
                {stop.place}
              </T>
            </Row>
          </Pressable>
        ) : null}
        {stop.note ? (
          <T variant="small" muted>
            {stop.note}
          </T>
        ) : null}
        {stop.addedBy !== uid ? (
          <T variant="small" muted style={{ fontStyle: 'italic' }}>
            Added by {partnerName}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

function StopEditor({ trip, days, start, onDone }: { trip: Trip; days: string[]; start: { stop?: TripStop; day: string }; onDone: () => void }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid } = usePaired();
  const { toast } = useFeedback();
  const s = start.stop;
  const [title, setTitle] = useState(s?.title ?? '');
  const [day, setDay] = useState(start.day);
  const [timeText, setTimeText] = useState(s?.time ? timeLabel(s.time) : '');
  const [place, setPlace] = useState(s?.place ?? '');
  const [note, setNote] = useState(s?.note ?? '');
  const [busy, setBusy] = useState(false);
  const time = parseTime(timeText);
  const dayChoices = days.includes(day) ? days : [day, ...days];

  async function save() {
    if (!title.trim() || time === 'invalid') return;
    setBusy(true);
    try {
      const data = { day, time, title, place, note };
      if (s) await updateStop(cid, trip.id, s.id, data);
      else await addStop(cid, trip.id, uid, data);
      haptic.success();
      onDone();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  async function remove() {
    if (!s) return;
    onDone();
    await removeStop(cid, trip.id, s.id).catch(() => toast(gentleError.save));
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerStyle={{ gap: space.md }}>
      <Row gap={space.sm}>
        <CalendarPlus color={c.primary} size={22} />
        <T variant="title">{s ? 'Change this plan' : 'Add to the plan'}</T>
      </Row>
      <TextInput
        testID="stop-title"
        value={title}
        onChangeText={setTitle}
        placeholder="What’s the plan? e.g. Breakfast at the market"
        placeholderTextColor={c.textMuted}
        maxLength={STOP_LIMITS.title}
        accessibilityLabel="What’s the plan?"
        style={input}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {dayChoices.map((d) => {
          const i = days.indexOf(d);
          return <Chip key={d} testID={`stop-day-${d}`} label={i >= 0 ? `Day ${i + 1} · ${dayShort(d)}` : dayShort(d)} selected={d === day} onPress={() => setDay(d)} />;
        })}
      </ScrollView>
      <View style={{ gap: 4 }}>
        <TextInput
          testID="stop-time"
          value={timeText}
          onChangeText={setTimeText}
          placeholder="Time (optional), e.g. 9:30am"
          placeholderTextColor={c.textMuted}
          maxLength={10}
          autoCorrect={false}
          accessibilityLabel="Time, optional"
          style={input}
        />
        <Row gap={4}>
          <Clock color={time === 'invalid' ? c.heart : c.textMuted} size={13} />
          <T testID="stop-time-hint" variant="small" color={time === 'invalid' ? c.heart : c.textMuted}>
            {time === 'invalid' ? 'Try something like 9:30, 2pm or 14:00' : time ? `Starts at ${timeLabel(time)}` : 'Any time that day'}
          </T>
        </Row>
      </View>
      <TextInput
        testID="stop-place"
        value={place}
        onChangeText={setPlace}
        placeholder="Where? (optional)"
        placeholderTextColor={c.textMuted}
        maxLength={STOP_LIMITS.place}
        accessibilityLabel="Where? Optional"
        style={input}
      />
      <TextInput
        testID="stop-note"
        value={note}
        onChangeText={setNote}
        placeholder="Notes (optional): booking number, what to bring…"
        placeholderTextColor={c.textMuted}
        maxLength={STOP_LIMITS.note}
        multiline
        accessibilityLabel="Notes, optional"
        style={[input, { minHeight: 72, textAlignVertical: 'top' }]}
      />
      <Button
        testID="stop-save"
        icon={s ? undefined : Plus}
        label={s ? 'Save changes' : 'Add to the plan'}
        loading={busy}
        disabled={!title.trim() || time === 'invalid'}
        hint={!title.trim() ? 'Give the plan a name first' : time === 'invalid' ? 'Check the time' : undefined}
        onPress={save}
      />
      {s ? <Button testID="stop-remove" kind="ghost" small icon={Trash} label="Remove this plan" onPress={remove} /> : null}
    </ScrollView>
  );
}
