import { router } from 'expo-router';
import { MapPin, Minus, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Field, Gap, IconButton, Row, Screen, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { addDays, dayKey, friendlyDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { createTrip } from '@/lib/trips';
import { findPlace, type Place } from '@/lib/weather';
import { space, useTheme } from '@/theme';

function Stepper({ label, value, onChange, min, max, unit }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; unit: string }) {
  return (
    <Row gap={space.md}>
      <IconButton icon={Minus} label={`Less ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <T variant="title" style={{ minWidth: 56, textAlign: 'center' }} accessibilityLabel={`${value} ${unit}`}>
        {value}
      </T>
      <IconButton icon={Plus} label={`More ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
      <T muted>{unit}</T>
    </Row>
  );
}

export default function NewTrip() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid } = usePaired();
  const { toast } = useFeedback();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [looking, setLooking] = useState(false);
  const [inDays, setInDays] = useState(30);
  const [nights, setNights] = useState(5);
  const [busy, setBusy] = useState(false);
  const start = dayKey(addDays(new Date(), inDays));
  const end = dayKey(addDays(new Date(), inDays + nights));

  async function look() {
    if (!destination.trim()) return;
    setLooking(true);
    try {
      const p = await findPlace(destination);
      setPlace(p);
      if (!p) toast('We couldn’t find that place, but you can still plan the trip.');
    } catch {
      toast('We couldn’t look that up right now. You can still plan the trip.');
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const id = await createTrip(cid, uid, {
        title: title || destination || 'Our trip',
        destination: place ? `${place.name}${place.country ? `, ${place.country}` : ''}` : destination,
        lat: place?.lat,
        lon: place?.lon,
        startDate: start,
        endDate: end,
      });
      haptic.success();
      router.replace({ pathname: '/trip/[id]', params: { id } });
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Field label="Trip name">
        <TextInput testID="trip-title" value={title} onChangeText={setTitle} placeholder="Our summer escape" placeholderTextColor={c.textMuted} maxLength={120} style={input} />
      </Field>
      <Gap />
      <Field label="Where to?" helper="Used for the weather-aware packing list and your map.">
        <Row gap={space.sm}>
          <TextInput
            testID="trip-destination"
            value={destination}
            onChangeText={(t) => {
              setDestination(t);
              setPlace(null);
            }}
            onSubmitEditing={look}
            placeholder="Lisbon"
            placeholderTextColor={c.textMuted}
            style={[input, { flex: 1 }]}
          />
          <IconButton testID="trip-find" icon={Search} label="Find this place" onPress={look} />
        </Row>
      </Field>
      {place ? (
        <Row gap={space.xs} style={{ marginTop: space.sm }}>
          <MapPin color={c.primary} size={16} />
          <T testID="trip-place" variant="small" color={c.primary}>
            {place.name}
            {place.country ? `, ${place.country}` : ''}
          </T>
        </Row>
      ) : looking ? (
        <T variant="small" muted style={{ marginTop: space.sm }}>
          Looking…
        </T>
      ) : null}
      <Gap h={space.xl} />
      <Field label="Leaving in" helper={friendlyDate(start)}>
        <Stepper label="days until we leave" value={inDays} onChange={setInDays} min={0} max={365} unit="days" />
      </Field>
      <Gap />
      <Field label="Staying for" helper={`Home on ${friendlyDate(end)}`}>
        <Stepper label="nights" value={nights} onChange={setNights} min={0} max={60} unit="nights" />
      </Field>
      <Gap h={space.xl} />
      <Card tone="lavender">
        <T variant="small">We&apos;ll start your shared checklist with passports, insurance and bookings. Both of you can tick things off.</T>
      </Card>
      <Gap />
      <Button testID="save-trip" label="Start planning" onPress={save} loading={busy} disabled={!title.trim() && !destination.trim()} hint="Give the trip a name or a place first." />
    </Screen>
  );
}
