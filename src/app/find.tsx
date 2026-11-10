/** Find my partner: where each of you is right now, only if you both choose to share. */
import { createElement, useEffect, useState, type ElementType } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Copy, Link2, LocateFixed, MapPin, Navigation, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Linking, Platform, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, Screen, SectionTitle, T, ToggleRow } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { relativeTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import {
  canLocate,
  currentPosition,
  distanceM,
  distanceWords,
  mapLinks,
  osmEmbed,
  placeName,
  saveMyLocation,
  setLocationSharing,
  useLocationSharing,
  useSharedLocation,
  type SharedLocation,
} from '@/lib/location';
import { usePaired } from '@/lib/session';
import { startStepsSync, useStepsSync } from '@/lib/steps-sync';
import { radius, space, useTheme } from '@/theme';

/** A live map on the web (OpenStreetMap). The phone apps open a maps app instead. */
function MapView({ lat, lng }: { lat: number; lng: number }) {
  const { c } = useTheme();
  if (Platform.OS !== 'web') return null;
  return (
    <View style={{ height: 240, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      {createElement('iframe' as unknown as ElementType, {
        title: 'Map',
        src: osmEmbed(lat, lng),
        style: { border: 0, width: '100%', height: '100%' },
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
      })}
    </View>
  );
}

function usePlace(loc: SharedLocation | null | undefined) {
  const [name, setName] = useState<string | null>(null);
  // Rounded to ~100 m, so small moves don't look the place up again.
  const lat = loc ? Math.round(loc.lat * 1000) / 1000 : null;
  const lng = loc ? Math.round(loc.lng * 1000) / 1000 : null;
  useEffect(() => {
    if (lat === null || lng === null) return;
    let alive = true;
    placeName(lat, lng).then((n) => alive && setName(n));
    return () => {
      alive = false;
    };
  }, [lat, lng]);
  return loc ? name : null;
}

export default function FindScreen() {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const sharing = useLocationSharing(uid);
  const mine = useSharedLocation(cid, uid);
  const theirs = useSharedLocation(cid, partnerId);
  const place = usePlace(theirs);
  const link = useStepsSync(uid);
  const [busy, setBusy] = useState(false);

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      await setLocationSharing(uid, cid, on);
      haptic.success();
      toast(on ? `${partnerName} can now see where you are.` : 'Stopped. Your location was deleted.');
    } catch (e) {
      toast((e as Error).message === 'denied' ? 'Location is blocked for KiTA. Allow it in your browser or phone settings.' : gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  async function updateNow() {
    setBusy(true);
    try {
      await saveMyLocation(cid, uid, await currentPosition());
      toast('Updated.');
    } catch {
      toast('Couldn’t get your location just now.');
    } finally {
      setBusy(false);
    }
  }

  const shortcutUrl = link?.url ? link.url.replace('/syncSteps?', '/syncLocation?') : null;
  const apart = mine && theirs ? distanceM(mine, theirs) : null;
  const links = theirs ? mapLinks(theirs.lat, theirs.lng) : null;
  const open = (url: string) => Linking.openURL(url).catch(() => toast('That didn’t open. Let’s try again.'));

  return (
    <Screen edges={['bottom']}>
      {/* Where they are */}
      <SectionTitle>{`Where ${partnerName} is`}</SectionTitle>
      {theirs ? (
        <Card>
          <MapView lat={theirs.lat} lng={theirs.lng} />
          <Gap h={space.md} />
          <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <MapPin color={c.heart} size={22} />
            <View style={{ flex: 1 }}>
              <T testID="partner-place" variant="bodyStrong">
                {place ?? `${theirs.lat.toFixed(4)}, ${theirs.lng.toFixed(4)}`}
              </T>
              <T variant="small" muted>
                {[
                  theirs.at ? `Updated ${relativeTime(theirs.at.toDate())}` : 'Just now',
                  theirs.accuracy > 0 ? `within ${Math.round(theirs.accuracy)} m` : null,
                  apart !== null ? distanceWords(apart) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </View>
          </Row>
          <Gap h={space.md} />
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            <Button small icon={Navigation} label="Waze" onPress={() => open(links!.waze)} />
            <Button small kind="soft" label="Google Maps" onPress={() => open(links!.google)} />
            <Button small kind="soft" label="Apple Maps" onPress={() => open(links!.apple)} />
          </Row>
        </Card>
      ) : (
        <Card tone="lavender">
          <T testID="partner-not-sharing">
            {theirs === undefined ? 'Checking…' : `${partnerName} isn’t sharing their location. They can turn it on here, in their own KiTA.`}
          </T>
        </Card>
      )}
      <Gap />

      {/* My sharing */}
      <SectionTitle>You</SectionTitle>
      <Card>
        <ToggleRow
          testID="share-location"
          title={`Share my location with ${partnerName}`}
          detail={
            canLocate()
              ? 'Only your latest location, never a history. Turning this off deletes it straight away.'
              : 'This device can’t share its location.'
          }
          value={!!sharing}
          disabled={busy || sharing === undefined || !canLocate()}
          onChange={toggle}
        />
        {sharing ? (
          <>
            <T variant="small" muted style={{ marginTop: space.xs }}>
              {mine?.at ? `Last sent ${relativeTime(mine.at.toDate())}${mine.source === 'shortcut' ? ' by your iPhone Shortcut' : ''}. ` : ''}
              KiTA updates it while it’s open. On iPhone, a Shortcut can keep it fresh when KiTA is closed (below).
            </T>
            <Gap h={space.sm} />
            <Button small kind="soft" icon={LocateFixed} label="Update now" loading={busy} onPress={updateNow} />
          </>
        ) : null}
        <Gap h={space.sm} />
        <Row gap={6}>
          <ShieldCheck color={c.textMuted} size={14} />
          <T variant="small" muted style={{ flex: 1 }}>
            Only {partnerName} can see it. {partnerName} gets a notification when you start sharing.
          </T>
        </Row>
      </Card>

      {sharing ? (
        <>
          <Gap />
          <SectionTitle right={<Smartphone color={c.textMuted} size={18} />}>Keep it fresh on iPhone</SectionTitle>
          <Card>
            <T variant="small" muted>
              Websites can’t check your location while closed. An iPhone Shortcut can: it sends your location to KiTA when you arrive or leave
              places, or at set times.
            </T>
            <Gap h={space.md} />
            {shortcutUrl ? (
              <>
                <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.md }}>
                  <T variant="small" selectable testID="location-link">
                    {shortcutUrl}
                  </T>
                </View>
                <Gap h={space.sm} />
                <Button
                  small
                  icon={Copy}
                  label="Copy link"
                  onPress={() =>
                    Clipboard.setStringAsync(shortcutUrl)
                      .then(() => toast('Copied.'))
                      .catch(() => toast('Press and hold the link to copy it.'))
                  }
                />
              </>
            ) : (
              <Button
                small
                icon={Link2}
                label="Make my private link"
                onPress={() => startStepsSync().then(() => toast('Your link is ready.')).catch(() => toast(gentleError.save))}
              />
            )}
            <Gap h={space.md} />
            {[
              'In the Shortcuts app, tap + and name it “KiTA location”.',
              'Add “Get Current Location”.',
              'Add “Get Details of Locations” and choose Latitude. Add it again and choose Longitude.',
              'Add “Get Contents of URL”. Paste your link, then type &lat= and insert Latitude, then &lng= and insert Longitude.',
              'Automation tab → + → “Arrive” or “Leave” (home, work) or “Time of Day”, then run KiTA location.',
            ].map((s, i) => (
              <Row key={s} gap={space.sm} style={{ alignItems: 'flex-start', marginBottom: space.sm }}>
                <T variant="bodyStrong" color={c.primary} style={{ width: 20 }}>
                  {i + 1}
                </T>
                <T style={{ flex: 1 }}>{s}</T>
              </Row>
            ))}
            <T variant="small" muted>
              It’s the same private link as Steps from iPhone. It only works while location sharing is on.
            </T>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
