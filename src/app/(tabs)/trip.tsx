import { router } from 'expo-router';
import { CalendarDays, ChevronRight, MapPin, Plane, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { FlightsCard } from '@/components/flights-card';
import { Button, Card, EmptyState, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { WorldMap } from '@/components/world-map';
import { empty } from '@/lib/copy';
import { dayKey, friendlyDate } from '@/lib/dates';
import { usePaired } from '@/lib/session';
import { countdownLine, daysBetween, miniTaskFor, tripPhase } from '@/lib/trip-logic';
import { useBucket, useTrips, type Trip as TripT } from '@/lib/trips';
import { space, useTheme } from '@/theme';

function TripRow({ t }: { t: TripT }) {
  const { c } = useTheme();
  return (
    <Pressable testID="trip-row" accessibilityRole="button" onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}>
      <Card style={{ paddingVertical: space.lg }}>
        <Row gap={space.md}>
          <Plane color={c.primary} size={22} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{t.title}</T>
            <T variant="small" muted>
              {friendlyDate(t.startDate)} → {friendlyDate(t.endDate)}
              {t.destination ? ` · ${t.destination}` : ''}
            </T>
          </View>
          <ChevronRight color={c.textMuted} size={20} />
        </Row>
      </Card>
    </Pressable>
  );
}

export default function Trip() {
  const { c } = useTheme();
  const { cid } = usePaired();
  const { data: trips, ready } = useTrips(cid);
  const { data: pins } = useBucket(cid);
  const today = dayKey();
  const next = trips.find((t) => tripPhase(t.startDate, t.endDate, today) !== 'after');
  const others = trips.filter((t) => t !== next);
  const upcoming = others.filter((t) => tripPhase(t.startDate, t.endDate, today) !== 'after');
  const past = others.filter((t) => tripPhase(t.startDate, t.endDate, today) === 'after').reverse();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.lg }}>
        <T variant="display" accessibilityRole="header">
          Trip
        </T>
        <Button testID="new-trip" small icon={Plus} label="Plan a trip" onPress={() => router.push('/trip-new')} />
      </Row>

      {next ? (
        <Pressable testID="next-trip" accessibilityRole="button" onPress={() => router.push({ pathname: '/trip/[id]', params: { id: next.id } })}>
          <Card tone="sky">
            <T variant="label" color={c.onSky}>
              {tripPhase(next.startDate, next.endDate, today) === 'during' ? 'ON YOUR TRIP' : 'NEXT TRIP'}
            </T>
            <T variant="title" color={c.onSky}>
              {next.title}
            </T>
            <T testID="countdown" variant="display" color={c.onSky} style={{ marginTop: space.sm }}>
              {countdownLine(next.startDate, next.endDate, today)}
            </T>
            {tripPhase(next.startDate, next.endDate, today) === 'upcoming' ? (
              <View style={{ marginTop: space.md, backgroundColor: c.surface, borderRadius: 16, padding: space.md }}>
                <T variant="label" muted>
                  TODAY&apos;S LITTLE TASK
                </T>
                <T testID="mini-task">{miniTaskFor(daysBetween(today, next.startDate))}</T>
              </View>
            ) : null}
          </Card>
        </Pressable>
      ) : ready ? (
        <Card tone="sky">
          <EmptyState icon={Plane} line={empty.trip} action={<Button small kind="quiet" label="Plan our first trip" onPress={() => router.push('/trip-new')} />} />
        </Card>
      ) : null}

      {upcoming.length ? (
        <>
          <Gap />
          <SectionTitle>Coming up</SectionTitle>
          <View style={{ gap: space.sm }}>
            {upcoming.map((t) => (
              <TripRow key={t.id} t={t} />
            ))}
          </View>
        </>
      ) : null}

      <Gap />
      <FlightsCard />
      <Gap />
      <Pressable testID="open-bucket" accessibilityRole="button" onPress={() => router.push('/bucket-list')}>
        <Card>
          <SectionTitle right={<ChevronRight color={c.textMuted} size={20} />}>Our bucket list</SectionTitle>
          <WorldMap pins={pins.filter((p) => typeof p.lat === 'number').map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, visited: p.visited, label: p.name }))} />
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <MapPin color={c.textMuted} size={14} />
            <T variant="small" muted>
              {pins.length ? `${pins.length} places dreamed of · ${pins.filter((p) => p.visited).length} visited` : 'Pin the places you dream of going together.'}
            </T>
          </Row>
        </Card>
      </Pressable>

      {past.length ? (
        <>
          <Gap />
          <SectionTitle>Travel journal</SectionTitle>
          <View style={{ gap: space.sm }}>
            {past.map((t) => (
              <TripRow key={t.id} t={t} />
            ))}
          </View>
        </>
      ) : null}
      <Gap />
      <Row gap={space.xs} style={{ justifyContent: 'center' }}>
        <CalendarDays color={c.textMuted} size={14} />
        <T variant="small" muted>
          Trips sync live between you both.
        </T>
      </Row>
    </Screen>
  );
}
