/**
 * Follow a flight live: where the plane is on a map, how high and fast, the
 * usual route with a rough time to landing, and a button to open the same
 * flight in Flightradar24. Checks again every 20 seconds while open.
 *
 * Positions come from free, community-run aircraft receivers (via our server),
 * so a plane far out over the sea can drop out of sight for a while.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, Compass, ExternalLink, Gauge, Mountain, Plane, PlaneLanding, PlaneTakeoff, RefreshCw, SearchX } from 'lucide-react-native';
import { createElement, type ElementType } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';

import { Button, Card, EmptyState, Gap, Row, Screen, T } from '@/components/ui';
import {
  FLIGHT_REFRESH_MS,
  cleanFlightNo,
  compass,
  etaWords,
  fr24Url,
  ftToM,
  ktsToKmh,
  mapSpan,
  phaseWord,
  prettyFlightNo,
  routeProgress,
  useFlightWatch,
  type FlightPosition,
  type FlightRoute,
} from '@/lib/flights';
import { haptic } from '@/lib/haptics';
import { osmEmbed } from '@/lib/location';
import { radius, space, useTheme } from '@/theme';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function FlightScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ no?: string; label?: string }>();
  const flight = cleanFlightNo(params.no ?? '');
  const label = typeof params.label === 'string' ? params.label.slice(0, 60) : '';
  const { answer, failed, refresh } = useFlightWatch(flight);

  if (!flight) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Flight' }} />
        <EmptyState icon={SearchX} line="That doesn’t look like a flight number. Try the one on the ticket, like MH 2520." />
      </Screen>
    );
  }

  const p = answer?.position ?? null;
  const route = answer?.route ?? null;
  const progress = routeProgress(route, p);
  const status = !answer ? (failed ? 'Can’t check right now' : 'Looking for it…') : p ? phaseWord(p) : 'Not in the air right now';
  const open = () => Linking.openURL(fr24Url(flight, p?.callsign)).catch(() => {});

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Flight ${prettyFlightNo(flight)}` }} />

      <Card tone="sky">
        <Row gap={space.md}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            {p && (p.climbFpm ?? 0) < -400 ? <PlaneLanding color={c.primary} size={26} /> : p && (p.climbFpm ?? 0) > 400 ? <PlaneTakeoff color={c.primary} size={26} /> : <Plane color={c.primary} size={26} />}
          </View>
          <View style={{ flex: 1 }}>
            <T testID="flight-no" variant="display" color={c.onSky} style={{ fontSize: 28, lineHeight: 34 }}>
              {prettyFlightNo(flight)}
            </T>
            {label || route?.airline ? (
              <T variant="small" color={c.onSky} numberOfLines={1}>
                {[label, route?.airline].filter(Boolean).join(' · ')}
              </T>
            ) : null}
          </View>
        </Row>
        <Gap h={space.sm} />
        <Row gap={space.sm}>
          {!answer && !failed ? <ActivityIndicator color={c.onSky} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p ? '#3DB36B' : c.textMuted }} />}
          <T testID="flight-status" variant="bodyStrong" color={c.onSky} accessibilityLiveRegion="polite">
            {status}
          </T>
        </Row>
      </Card>
      <Gap />

      {route ? (
        <>
          <RouteCard route={route} fraction={progress?.fraction ?? null} />
          {progress ? (
            <T testID="flight-eta" muted center style={{ marginTop: space.sm }}>
              {progress.remainingKm.toLocaleString()} km to go
              {progress.etaMin ? ` · lands in ${etaWords(progress.etaMin)} (a rough guess)` : ''}
            </T>
          ) : null}
          <Gap />
        </>
      ) : null}

      {p ? (
        <>
          <FlightMap p={p} />
          <Gap />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <Stat icon={Mountain} label="Height" value={p.onGround ? 'On the ground' : p.altFt === null ? 'Unknown' : `${p.altFt.toLocaleString()} ft`} sub={p.onGround || p.altFt === null ? undefined : `${ftToM(p.altFt).toLocaleString()} m`} />
            <Stat icon={Gauge} label="Speed" value={p.speedKts === null ? 'Unknown' : `${ktsToKmh(p.speedKts).toLocaleString()} km/h`} sub={p.speedKts === null ? undefined : `${p.speedKts} knots`} />
            <Stat icon={Compass} label="Heading" value={p.heading === null ? 'Unknown' : cap(compass(p.heading))} sub={p.heading === null ? undefined : `${p.heading}°`} />
            <Stat icon={Plane} label="Aircraft" value={p.typeName || p.type || 'Unknown'} sub={p.reg ?? undefined} />
          </View>
          <Gap />
          <T testID="flight-fresh" variant="small" muted center>
            {failed
              ? 'Couldn’t check just now. Trying again shortly.'
              : p.seenSec > 90
                ? `Last heard ${Math.round(p.seenSec / 60)} min ago. It may be out of reach of receivers for a while (common over the sea).`
                : `Live. Checks again every ${FLIGHT_REFRESH_MS / 1000} seconds.`}
          </T>
        </>
      ) : answer ? (
        <Card>
          <T testID="flight-missing" variant="bodyStrong">
            We can’t see {prettyFlightNo(flight)} in the air right now.
          </T>
          <Gap h={space.xs} />
          <T muted>It may not have taken off yet, may have landed already, or is over the sea where no receiver can hear it. This page keeps checking every {FLIGHT_REFRESH_MS / 1000} seconds.</T>
          <Gap h={space.xs} />
          <T variant="small" muted>
            Flightradar24 also shows the timetable: when it’s due to leave and land.
          </T>
        </Card>
      ) : failed ? (
        <Card>
          <T variant="bodyStrong">Live flight data isn’t answering right now.</T>
          <Gap h={space.xs} />
          <T muted>It’s a free community service and has quiet moments. We’ll keep trying, or you can open the flight in Flightradar24.</T>
        </Card>
      ) : null}

      <Gap />
      <Button testID="flight-fr24" icon={ExternalLink} label="Open in Flightradar24" onPress={open} />
      <Gap h={space.sm} />
      <Button
        testID="flight-refresh"
        kind="soft"
        small
        icon={RefreshCw}
        label="Check now"
        onPress={() => {
          haptic.tap();
          refresh();
        }}
      />
      <Gap />
      <T variant="small" muted center>
        Live positions from airplanes.live and adsb.fi (community-run receivers); usual route from adsbdb.com. For keeping each other company, not for navigation.
      </T>
    </Screen>
  );
}

function RouteCard({ route, fraction }: { route: FlightRoute; fraction: number | null }) {
  const { c } = useTheme();
  const end = (a: FlightRoute['from'], align: 'flex-start' | 'flex-end') => (
    <View style={{ alignItems: align, maxWidth: '38%' }}>
      <T variant="title">{a?.code ?? '?'}</T>
      <T variant="small" muted numberOfLines={1}>
        {a?.city || a?.name || ''}
      </T>
    </View>
  );
  const at = fraction === null ? null : Math.round(fraction * 100);
  return (
    <Card>
      <View testID="flight-route" accessible accessibilityLabel={`Usual route: ${route.from?.city || route.from?.code || 'unknown'} to ${route.to?.city || route.to?.code || 'unknown'}${at === null ? '' : `, ${at} percent of the way`}`}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {end(route.from, 'flex-start')}
          <ArrowUpRight color={c.textMuted} size={18} style={{ transform: [{ rotate: '45deg' }], marginBottom: 6 }} />
          {end(route.to, 'flex-end')}
        </Row>
        <View style={{ height: 28, justifyContent: 'center', marginTop: space.sm }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceAlt }} />
          {at !== null ? (
            <>
              <View style={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, width: `${at}%`, backgroundColor: c.primary }} />
              <View style={{ position: 'absolute', left: `${at}%`, marginLeft: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Plane color={c.onPrimary} size={15} style={{ transform: [{ rotate: '45deg' }] }} />
              </View>
            </>
          ) : null}
        </View>
        <T variant="small" muted center style={{ marginTop: 2 }}>
          The usual route for this flight number
        </T>
      </View>
    </Card>
  );
}

/** Where the plane is (OpenStreetMap on the web; a maps link on phones). */
function FlightMap({ p }: { p: FlightPosition }) {
  const { c } = useTheme();
  if (Platform.OS !== 'web') {
    return <Button small kind="soft" icon={ExternalLink} label="See where it is on a map" onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=8/${p.lat}/${p.lon}`).catch(() => {})} />;
  }
  return (
    <View testID="flight-map" style={{ height: 260, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {createElement('iframe' as unknown as ElementType, {
        title: `Map: the plane is at ${p.lat}, ${p.lon}`,
        src: osmEmbed(p.lat, p.lon, mapSpan(p)),
        style: { border: 0, width: '100%', height: '100%' },
        referrerPolicy: 'no-referrer-when-downgrade',
      })}
      {p.heading !== null ? (
        <View style={{ position: 'absolute', left: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: c.border, pointerEvents: 'none' }}>
          <Plane color={c.primary} size={15} style={{ transform: [{ rotate: `${p.heading - 45}deg` }] }} />
          <T variant="small">Flying {compass(p.heading)}</T>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Plane; label: string; value: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '44%', backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.md, gap: 2 }}>
      <Row gap={6}>
        <Icon color={c.textMuted} size={15} />
        <T variant="small" muted>
          {label}
        </T>
      </Row>
      <T variant="bodyStrong" numberOfLines={2}>
        {value}
      </T>
      {sub ? (
        <T variant="small" muted>
          {sub}
        </T>
      ) : null}
    </View>
  );
}
