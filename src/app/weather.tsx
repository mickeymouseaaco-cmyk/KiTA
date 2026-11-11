/** Weather & flood watch for home: Shah Alam and Klang. Icons first, details on tap, sources always named. */
import {
  AtSign,
  CalendarHeart,
  ChevronDown,
  ChevronUp,
  Droplets,
  ExternalLink,
  Footprints,
  LocateFixed,
  MapPin,
  HeartHandshake,
  Phone,
  Droplet,
  Shuffle,
  RefreshCw,
  ShieldCheck,
  Sofa,
  Sun as SunIcon,
  Sunset,
  Thermometer,
  Umbrella,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { Animated, Easing, Linking, Platform, Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useFeedback } from '@/components/feedback';
import { PlacePicker } from '@/components/place-picker';
import { Button, Card, Gap, Row, Screen, SectionTitle, SkeletonPage, T } from '@/components/ui';
import { LiveSky } from '@/components/live-sky';
import { VividSquare } from '@/components/vivid';
import { SkyIcon, WARNING_ICON } from '@/components/weather-art';
import { gentleError } from '@/lib/copy';
import { fromDayKey } from '@/lib/dates';
import {
  AREAS,
  LEVEL_LABEL,
  SAFETY_TIPS,
  SOURCE_LINKS,
  WARNING_LEVEL_LABEL,
  rainRisk,
  riverLevel,
  skyKind,
  stationsFor,
  threadsSearchUrl,
  useFloodWatch,
  warningBrief,
  warningsFor,
  weatherWords,
  type AreaId,
  type Warning,
} from '@/lib/flood';
import { haptic } from '@/lib/haptics';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { placeLabel, rainAmount, speed, temp, todFor, usePlaceWeather, useUnits, useWeatherPlace } from '@/lib/places';
import { coupleTips, hourInMalaysia, rangeBar, skyLines, timeOfDay, type TipIcon } from '@/lib/sky-pure';
import { radius, space, useTheme, type VividName } from '@/theme';

const TONE = { calm: 'sage', watch: 'butter', warning: 'peach' } as const;

const TIP_ICON: Record<TipIcon, [LucideIcon, VividName]> = {
  walk: [Footprints, 'green'],
  umbrella: [Umbrella, 'blue'],
  hot: [SunIcon, 'orange'],
  home: [Sofa, 'violet'],
  weekend: [CalendarHeart, 'pink'],
  sunset: [Sunset, 'amber'],
};

/** Colour for each kind of sky in the week list. */
const SKY_TINT = { sun: '#FFB020', partly: '#F5A524', cloud: '#8A97AB', fog: '#9AA4B2', drizzle: '#4C8DFF', rain: '#3B7BFF', storm: '#7C5CFA' } as const;

/** A temperature range bar, cool to warm, placed on the week's scale. */
function TempBar({ from, to }: { from: number; to: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: `${from * 100}%`, width: `${(to - from) * 100}%`, top: 0, bottom: 0, borderRadius: 3, overflow: 'hidden' }}>
        <Svg width="100%" height="6" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="temp-bar" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#5AC8FA" />
              <Stop offset="0.5" stopColor="#FFCE52" />
              <Stop offset="1" stopColor="#FF7A45" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="6" fill="url(#temp-bar)" />
        </Svg>
      </View>
    </View>
  );
}

function untilText(ms: number | null): string | null {
  if (ms === null) return null;
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `until ${time}` : `until ${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

/** One official warning: an icon and a few words. Tap for MET's full wording. */
function WarningRow({ w, statewide }: { w: Warning; statewide: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const b = warningBrief(w);
  const Icon = WARNING_ICON[b.kind];
  const strong = b.level === 'severe' || b.level === 'danger';
  const bg = strong ? c.peach : b.level === 'alert' ? c.butter : c.sky;
  const fg = strong ? c.onPeach : b.level === 'alert' ? c.onButter : c.onSky;
  const until = untilText(b.untilMs);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${b.label}, ${WARNING_LEVEL_LABEL[b.level]}${until ? `, ${until}` : ''}. ${open ? 'Hide' : 'Show'} the full warning`}
      onPress={() => {
        haptic.tap();
        setOpen((v) => !v);
      }}>
      <Card style={{ marginBottom: space.sm, paddingVertical: space.md }}>
        <Row gap={space.md}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon color={fg} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{b.label}</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
                <T variant="label" color={fg}>
                  {WARNING_LEVEL_LABEL[b.level]}
                </T>
              </View>
              <T variant="small" muted>
                {[until, statewide ? 'Selangor-wide' : null].filter(Boolean).join(' · ')}
              </T>
            </Row>
          </View>
          {open ? <ChevronUp color={c.textMuted} size={20} /> : <ChevronDown color={c.textMuted} size={20} />}
        </Row>
        {open ? (
          <View style={{ marginTop: space.md, gap: space.xs }}>
            <T variant="small" muted>
              {w.title}
            </T>
            {w.heading ? <T variant="small">{w.heading}</T> : null}
            {w.text ? <T variant="small">{w.text}</T> : null}
            {w.instruction ? (
              <T variant="small" muted>
                {w.instruction}
              </T>
            ) : null}
            <T variant="small" muted>
              Source: MET Malaysia
            </T>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

export default function Weather() {
  const { c } = useTheme();
  const who = usePaired();
  const { partnerName } = who;
  const { toast } = useFeedback();
  const { data, status, loading: floodLoading, refresh } = useFloodWatch();
  const [place] = useWeatherPlace();
  const [units] = useUnits();
  const [picking, setPicking] = useState(false);
  const anywhere = usePlaceWeather(place);
  const isArea = place?.kind === 'area';
  const areaId: AreaId = place?.kind === 'area' ? place.id : 'shahalam';
  const loading = isArea ? floodLoading : anywhere.loading;
  const deg = (n: number) => temp(n, units);
  const [sent, setSent] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const area = AREAS.find((a) => a.id === areaId)!;
  const st = status[areaId];
  const level = st?.level ?? 'calm';
  const days = isArea ? (data?.forecast[areaId] ?? []) : (anywhere.data?.days ?? []);
  const placeName = place ? placeLabel(place, (id) => AREAS.find((a) => a.id === id)!.name) : '';
  const today = days[0];
  const { local, state } = data ? warningsFor(area, data.warnings, data.fetchedAt) : { local: [], state: [] };
  const rivers = data ? stationsFor(area, data.stations, data.fetchedAt) : [];
  const toneOn = { calm: c.onSage, watch: c.onButter, warning: c.onPeach }[level];
  const now = isArea ? (data?.now?.[areaId] ?? null) : (anywhere.data?.now ?? null);
  // The place's own sunrise and sunset decide dawn, day, dusk and night.
  const tod = todFor(now, isArea ? timeOfDay(hourInMalaysia()) : 'day');
  const kind = now ? skyKind(now.code) : today ? skyKind(today.code) : 'cloud';
  const lines = skyLines(kind, tod, today?.maxC ?? null, partnerName);
  const [lineAt, setLineAt] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const tips = coupleTips(days, partnerName, deg);
  const weekMin = Math.min(...days.map((d) => d.minC));
  const weekMax = Math.max(...days.map((d) => d.maxC));

  function nextLine() {
    haptic.tap();
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setLineAt((n) => n + 1);
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    });
  }

  async function send(kind: 'safe' | 'ask') {
    const text =
      kind === 'safe'
        ? `I’m safe and dry. Just checking in because of the rain in ${area.name}. ♡`
        : `Heavy rain near ${area.name}. Are you okay? Tell me where you are when you can. ♡`;
    try {
      await sendText(who, text, 'quick');
      haptic.success();
      setSent(kind);
      toast(kind === 'safe' ? `${partnerName} knows you’re safe.` : `Sent. ${partnerName} will see it right away.`);
    } catch {
      toast(gentleError.send);
    }
  }

  const open = (url: string) => Linking.openURL(url).catch(() => toast('That link didn’t open. Let’s try again in a moment.'));

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: isArea ? 'Weather & floods' : 'Weather' }} />
      <PlacePicker visible={picking} onClose={() => setPicking(false)} />
      <Pressable
        testID="place-button"
        accessibilityRole="button"
        accessibilityLabel={place ? `Weather for ${placeName}. Change place or units` : 'Choose a place for the weather'}
        onPress={() => setPicking(true)}
        hitSlop={6}
        style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1, minHeight: 40, justifyContent: 'center' })}>
        <Row gap={6}>
          {place?.kind === 'here' ? <LocateFixed color={c.text} size={18} /> : <MapPin color={c.text} size={18} />}
          <T variant="heading" numberOfLines={1} style={{ maxWidth: 260 }}>
            {place ? placeName : 'Choose a place'}
          </T>
          <ChevronDown color={c.textMuted} size={18} />
        </Row>
      </Pressable>
      <Gap h={space.md} />

      {place === undefined ? <SkeletonPage /> : null}
      {place === null ? (
        <Card>
          <T variant="title">Where should we look at the sky?</T>
          <Gap h={space.xs} />
          <T muted>Use your location, or pick any city in the world. You can change it any time.</T>
          <Gap h={space.md} />
          <Button testID="place-choose" icon={MapPin} label="Choose a place" onPress={() => setPicking(true)} />
        </Card>
      ) : null}
      {place ? (
      <>

      {/* The living sky: right now, drawn and moving. Tap it for another line. */}
      <View>
        <LiveSky testID="weather-sky" kind={kind} tod={tod} height={300}>
          <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
            <View>
              <T variant="label" color="#FFFFFF" style={{ opacity: 0.9, letterSpacing: 1 }}>
                {placeName.toUpperCase()} · {tod === 'night' ? 'TONIGHT' : 'NOW'}
              </T>
              <T testID="weather-temp" color="#FFFFFF" style={{ fontSize: 76, lineHeight: 84, fontWeight: '300', letterSpacing: -3, textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 }}>
                {now ? deg(now.tempC) : today ? deg(today.maxC) : '–'}
              </T>
              <T variant="title" color="#FFFFFF" testID="flood-today" style={{ marginTop: -4 }}>
                {now ? weatherWords(now.code) : today ? weatherWords(today.code) : loading ? 'Looking at the sky…' : 'Forecast unavailable'}
              </T>
              {today ? (
                <T variant="bodyStrong" color="#FFFFFF" style={{ opacity: 0.92 }}>
                  H {deg(today.maxC)}  L {deg(today.minC)}{typeof now?.feelsC === 'number' ? `  ·  Feels ${deg(now.feelsC)}` : ''}
                </T>
              ) : null}
            </View>
            <Pressable testID="sky-next" accessibilityRole="button" accessibilityHint="Shows another line" onPress={nextLine} hitSlop={8}>
              <Animated.View style={{ opacity: fade, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <T testID="sky-line" variant="bodyStrong" color="#FFFFFF" style={{ flex: 1, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>
                  {lines[lineAt % lines.length]}
                </T>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Shuffle color="#FFFFFF" size={16} strokeWidth={2.4} />
                </View>
              </Animated.View>
            </Pressable>
          </View>
        </LiveSky>
      </View>
      <Gap h={space.md} />

      {/* Today's numbers, as bright little chips. */}
      {today ? (
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {(
            [
              [Umbrella, 'blue', `${today.rainChance}%`, 'Rain chance'],
              [Droplets, 'teal', rainAmount(today.rainMm, units), 'Rain today'],
              typeof now?.humidity === 'number' ? [Droplet, 'violet', `${now.humidity}%`, 'Humidity'] : [Thermometer, 'orange', deg(today.maxC), 'High'],
              typeof now?.windKmh === 'number' ? [Wind, 'green', speed(now.windKmh, units), 'Wind'] : [Thermometer, 'teal', deg(today.minC), 'Low'],
            ] as [LucideIcon, VividName, string, string][]
          ).map(([Icon, color, value, label]) => (
            <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ flexGrow: 1, flexBasis: '44%', flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.surface, borderRadius: 16, padding: space.sm, borderWidth: 1, borderColor: c.border }}>
              <VividSquare color={color} size={36} radius={11}>
                <Icon color="#FFFFFF" size={18} strokeWidth={2.3} />
              </VividSquare>
              <View>
                <T variant="bodyStrong">{value}</T>
                <T variant="small" muted style={{ fontSize: 12, lineHeight: 16 }}>
                  {label}
                </T>
              </View>
            </View>
          ))}
        </Row>
      ) : null}
      <Gap h={space.md} />

      {/* Flood watch (Malaysian areas): the level, why, and a quick check-in with your partner. */}
      {isArea ? (
      <Card tone={TONE[level]}>
        <Row gap={6}>
          {level === 'calm' ? <ShieldCheck color={toneOn} size={18} /> : <Waves color={toneOn} size={18} />}
          <T variant="label" color={toneOn}>
            {st ? `FLOOD WATCH · ${LEVEL_LABEL[level].toUpperCase()}` : 'CHECKING…'}
          </T>
        </Row>
        {st?.headline ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: why }}
            onPress={() => setWhy((v) => !v)}
            hitSlop={6}
            style={{ marginTop: space.xs, minHeight: 36, justifyContent: 'center' }}>
            <Row gap={6}>
              <T variant="bodyStrong" color={toneOn} style={{ flex: 1 }}>
                {st.headline}
              </T>
              {st.reasons.length ? why ? <ChevronUp color={toneOn} size={18} /> : <ChevronDown color={toneOn} size={18} /> : null}
            </Row>
          </Pressable>
        ) : null}
        {why
          ? st?.reasons.map((r) => (
              <T key={r} variant="small" color={toneOn} style={{ marginTop: space.xs }}>
                • {r}
              </T>
            ))
          : null}
        <Gap h={space.md} />
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          <Button testID="flood-safe" small kind="soft" icon={HeartHandshake} label={sent === 'safe' ? 'Sent ✓' : 'I’m safe'} onPress={() => send('safe')} />
          <Button small kind="soft" label={sent === 'ask' ? 'Asked ✓' : `Check on ${partnerName}`} onPress={() => send('ask')} />
        </Row>
      </Card>
      ) : null}
      {isArea ? <Gap /> : null}

      {tips.length ? (
        <>
          <SectionTitle>{`For you and ${partnerName}`}</SectionTitle>
          <Card style={{ paddingVertical: space.md }}>
            {tips.map((t, i) => {
              const [Icon, color] = TIP_ICON[t.icon];
              return (
                <Row key={t.text} testID="couple-tip" gap={space.md} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <VividSquare color={color} size={40} radius={12}>
                    <Icon color="#FFFFFF" size={20} strokeWidth={2.3} />
                  </VividSquare>
                  <T style={{ flex: 1 }}>{t.text}</T>
                </Row>
              );
            })}
          </Card>
          <Gap />
        </>
      ) : null}

      {isArea && (local.length || state.length) ? (
        <>
          <SectionTitle>{`Official warnings · ${local.length + state.length}`}</SectionTitle>
          {local.map((w) => (
            <WarningRow key={`${w.title}${w.validFrom}`} w={w} statewide={false} />
          ))}
          {state.map((w) => (
            <WarningRow key={`${w.title}${w.validFrom}`} w={w} statewide />
          ))}
          <Gap h={space.sm} />
        </>
      ) : null}

      <SectionTitle>The week ahead</SectionTitle>
      {days.length === 0 ? (
        <Card>
          <T muted>{loading ? 'Loading the forecast…' : 'The forecast didn’t load. Tap refresh to try again.'}</T>
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {days.map((d, i) => {
            const risk = rainRisk(d);
            const k = skyKind(d.code);
            const day = i === 0 ? 'Today' : fromDayKey(d.date).toLocaleDateString(undefined, { weekday: 'short' });
            const bar = rangeBar(d, weekMin, weekMax);
            return (
              <View
                key={d.date}
                testID="week-day"
                accessible
                accessibilityLabel={`${day}: ${weatherWords(d.code)}, ${deg(d.minC)} to ${deg(d.maxC)}, ${d.rainChance}% chance of rain${risk >= 2 ? ', heavy rain possible' : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <T variant="bodyStrong" style={{ width: 52 }}>
                  {day}
                </T>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <SkyIcon kind={k} size={24} color={SKY_TINT[k]} />
                  {d.rainChance >= 30 ? (
                    <T variant="small" color="#3B7BFF" style={{ fontSize: 11, lineHeight: 13, fontFamily: 'Raleway_700Bold' }}>
                      {d.rainChance}%
                    </T>
                  ) : null}
                </View>
                <T variant="small" muted style={{ width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {deg(d.minC)}
                </T>
                <TempBar from={bar.from} to={bar.to} />
                <T variant="bodyStrong" style={{ width: 34, fontVariant: ['tabular-nums'] }}>
                  {deg(d.maxC)}
                </T>
                {risk >= 2 ? <Umbrella color={risk >= 3 ? '#FF6136' : '#FFA41B'} size={16} accessibilityLabel="Heavy rain possible" /> : <View style={{ width: 16 }} />}
              </View>
            );
          })}
        </Card>
      )}
      <Gap />

      {isArea ? (
      <>
      <SectionTitle>Rivers nearby · JPS</SectionTitle>
      <Card>
        {rivers.length ? (
          rivers.slice(0, 6).map((s) => {
            const lvl = riverLevel(s);
            const dot = lvl === 'danger' || lvl === 'warning' ? c.onPeach : lvl === 'alert' ? c.onButter : lvl === 'normal' ? c.ring : c.border;
            return (
              <Row key={s.name} gap={space.md} style={{ paddingVertical: space.xs }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
                <View style={{ flex: 1 }}>
                  <T>{s.name}</T>
                  <T variant="small" muted>
                    {s.levelM !== null ? `${s.levelM} m` : 'no reading'}
                    {s.alertM !== null ? ` · alert at ${s.alertM} m` : ''}
                  </T>
                </View>
                <T variant="small" color={lvl === 'normal' ? c.textMuted : c.text}>
                  {lvl === 'normal' ? 'Normal' : lvl === 'unknown' ? '—' : lvl[0].toUpperCase() + lvl.slice(1)}
                </T>
              </Row>
            );
          })
        ) : (
          <T muted>{data ? 'Live river levels aren’t in the app right now. JPS has them.' : 'Loading river levels…'}</T>
        )}
        <Gap h={space.sm} />
        <Pressable accessibilityRole="link" onPress={() => open(SOURCE_LINKS.jps)} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
          <Row gap={6}>
            <ExternalLink color={c.primary} size={16} />
            <T variant="small" color={c.primary}>
              Open JPS Public Infobanjir
            </T>
          </Row>
        </Pressable>
      </Card>
      <Gap />

      <SectionTitle right={<AtSign color={c.textMuted} size={18} />}>On Threads</SectionTitle>
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {area.threads.map((s) => (
          <Button key={s.query} testID={`threads-${s.query}`} small kind="soft" icon={ExternalLink} label={s.label} onPress={() => open(threadsSearchUrl(s.query))} />
        ))}
      </Row>
      <Gap h={space.xs} />
      <T variant="small" muted>
        Posts from people, not the authorities. Check the date.
      </T>
      <Gap />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: tipsOpen || level === 'warning' }}
        onPress={() => setTipsOpen((v) => !v)}
        style={{ minHeight: 44, justifyContent: 'center' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="heading">{level === 'warning' ? 'Right now' : 'Be ready'}</T>
          {level === 'warning' ? null : tipsOpen ? <ChevronUp color={c.textMuted} size={20} /> : <ChevronDown color={c.textMuted} size={20} />}
        </Row>
      </Pressable>
      {tipsOpen || level === 'warning' ? (
        <Card>
          {SAFETY_TIPS[level].map((t) => (
            <T key={t} style={{ marginBottom: space.sm }}>
              • {t}
            </T>
          ))}
        </Card>
      ) : null}
      <Gap h={space.sm} />
      <Button testID="call-999" kind={level === 'warning' ? 'primary' : 'ghost'} small icon={Phone} label="Emergency: call 999" onPress={() => open('tel:999')} />
      <Gap />
      </>
      ) : null}

      <Button kind="ghost" small icon={RefreshCw} label={loading ? 'Refreshing…' : 'Refresh'} disabled={loading} onPress={() => (isArea ? refresh(true) : anywhere.refresh())} />
      <Gap h={space.sm} />
      <T variant="small" muted center>
        {isArea ? 'Open-Meteo · MET Malaysia · JPS via data.gov.my' : 'Forecast from Open-Meteo'}
        {isArea && data ? ` · ${new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
        {anywhere.failed && !isArea ? '\nCouldn’t refresh just now. Showing the last forecast.' : ''}
        {isArea ? '\nA gentle guide. Always follow the authorities.' : ''}
      </T>
      </>
      ) : null}
    </Screen>
  );
}
