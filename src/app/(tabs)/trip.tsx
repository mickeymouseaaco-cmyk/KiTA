import { router } from 'expo-router';
import { CalendarDays, ChevronRight, MapPin, Plane, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { FlightsCard } from '@/components/flights-card';
import { Button, Card, EmptyState, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { Widget, WidgetCaption, WidgetValue } from '@/components/widgets';
import { WorldMap } from '@/components/world-map';
import { empty } from '@/lib/copy';
import { dayKey, friendlyDate } from '@/lib/dates';
import { usePaired } from '@/lib/session';
import { countdownLine, daysBetween, miniTaskFor, tripPhase } from '@/lib/trip-logic';
import { useBucket, useTrips, type Trip as TripT } from '@/lib/trips';
import { space, useTheme } from '@/theme';

function TripRow({ t, past }: { t: TripT; past?: boolean }) {
  return (
    <Widget testID="trip-row" fill={past ? 'ink' : 'teal'} height={84} accessibilityLabel={`${t.title}. Open`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}>
      <Row gap={space.md} style={{ flex: 1 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <Plane color="#FFFFFF" size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
            {t.title}
          </T>
          <T variant="small" color="rgba(255,255,255,0.78)" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17 }}>
            {friendlyDate(t.startDate)} → {friendlyDate(t.endDate)}
            {t.destination ? ` · ${t.destination}` : ''}
          </T>
        </View>
        <ChevronRight color="rgba(255,255,255,0.7)" size={20} />
      </Row>
    </Widget>
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
        <Widget testID="next-trip" fill="blue" accessibilityLabel={`${next.title}: ${countdownLine(next.startDate, next.endDate, today)}. Open`} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: next.id } })}>
          <WidgetCaption icon={Plane} label={tripPhase(next.startDate, next.endDate, today) === 'during' ? 'On your trip' : 'Next trip'} fill="blue" />
          <T variant="title" color="#FFFFFF" numberOfLines={1} style={{ marginTop: space.sm }}>
            {next.title}
          </T>
          <WidgetValue testID="countdown" color="#FFFFFF" size={36} numberOfLines={2}>
            {countdownLine(next.startDate, next.endDate, today)}
          </WidgetValue>
          {tripPhase(next.startDate, next.endDate, today) === 'upcoming' ? (
            <View style={{ marginTop: space.md, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, borderCurve: 'continuous', padding: space.md }}>
              <T variant="label" color="rgba(255,255,255,0.75)">
                TODAY&apos;S LITTLE TASK
              </T>
              <T testID="mini-task" color="#FFFFFF">
                {miniTaskFor(daysBetween(today, next.startDate))}
              </T>
            </View>
          ) : null}
        </Widget>
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
              <TripRow key={t.id} t={t} past />
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
