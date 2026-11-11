/**
 * "Track a flight": type a flight number and follow it live. On a trip, the
 * flight is saved for both of you (so it's one tap next time); on the Trips
 * tab it's a quick one-off look.
 */
import { router } from 'expo-router';
import { ChevronRight, Plane, Radar, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, SectionTitle, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { addTripFlight, cleanFlightNo, prettyFlightNo, removeTripFlight, useTripFlights } from '@/lib/flights';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';

const openFlight = (no: string, label?: string | null) => router.push({ pathname: '/flight', params: label ? { no, label } : { no } });

export function FlightsCard({ tripId }: { tripId?: string }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid } = usePaired();
  const { toast } = useFeedback();
  const saved = useTripFlights(tripId ? cid : null, tripId ?? '');
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const flight = cleanFlightNo(text);

  function go() {
    if (!flight) return;
    haptic.tap();
    if (tripId) addTripFlight(cid, tripId, uid, flight, label).catch(() => toast(gentleError.save));
    openFlight(flight, label.trim() || null);
    setText('');
    setLabel('');
  }

  return (
    <Card>
      <SectionTitle right={<Radar color={c.textMuted} size={20} />}>{tripId ? 'Flights' : 'Track a flight'}</SectionTitle>
      <T variant="small" muted>
        See where the plane is right now, on a map, with a rough landing time.
      </T>
      <Gap h={space.sm} />
      {saved.map((f) => (
        <Row key={f.id} gap={space.xs} style={{ marginBottom: space.xs }}>
          <Pressable
            testID={`flight-row-${f.flight}`}
            accessibilityRole="button"
            accessibilityLabel={`Track flight ${prettyFlightNo(f.flight)}${f.label ? `, ${f.label}` : ''}`}
            onPress={() => openFlight(f.flight, f.label)}
            style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: radius.md, backgroundColor: pressed ? c.surfaceAlt : c.primarySoft, paddingHorizontal: space.md, justifyContent: 'center' })}>
            <Row gap={space.sm}>
              <Plane color={c.primary} size={18} />
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{prettyFlightNo(f.flight)}</T>
                {f.label ? (
                  <T variant="small" muted numberOfLines={1}>
                    {f.label}
                  </T>
                ) : null}
              </View>
              <T variant="small" color={c.primary}>
                Track
              </T>
              <ChevronRight color={c.primary} size={18} />
            </Row>
          </Pressable>
          <Pressable
            testID={`flight-remove-${f.flight}`}
            accessibilityRole="button"
            accessibilityLabel={`Remove flight ${prettyFlightNo(f.flight)}`}
            hitSlop={6}
            onPress={() => removeTripFlight(cid, tripId!, f.id).catch(() => toast(gentleError.save))}
            style={{ padding: 10 }}>
            <X color={c.textMuted} size={18} />
          </Pressable>
        </Row>
      ))}
      <TextInput
        testID="flight-input"
        value={text}
        onChangeText={setText}
        placeholder="Flight no., e.g. MH 2520"
        placeholderTextColor={c.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        returnKeyType="go"
        onSubmitEditing={go}
        accessibilityLabel="Flight number"
        style={input}
      />
      {tripId ? (
        <>
          <TextInput
            testID="flight-label"
            value={label}
            onChangeText={setLabel}
            placeholder="Whose flight? (optional)"
            placeholderTextColor={c.textMuted}
            maxLength={60}
            accessibilityLabel="A label for this flight, like Aina to Penang. Optional"
            style={[input, { marginTop: space.sm }]}
          />
          <Gap h={space.sm} />
          <Button testID="flight-track" small icon={Plane} label="Save and track" disabled={!flight} hint="Type a flight number first" onPress={go} />
        </>
      ) : (
        <>
          <Gap h={space.sm} />
          <Button testID="flight-track" small icon={Plane} label="Track" disabled={!flight} hint="Type a flight number first" onPress={go} />
        </>
      )}
      {text.trim() && !flight ? (
        <T variant="small" color={c.heart} style={{ marginTop: space.xs }}>
          Use the number on the ticket: letters then numbers, like MH 2520 or AK 6124.
        </T>
      ) : null}
    </Card>
  );
}
