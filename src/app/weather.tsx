/** Weather & flood watch for home: Shah Alam and Klang. Icons first, details on tap, sources always named. */
import {
  AtSign,
  ChevronDown,
  ChevronUp,
  Droplets,
  ExternalLink,
  HeartHandshake,
  Phone,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Umbrella,
  Waves,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, Screen, Segmented, SectionTitle, T } from '@/components/ui';
import { SkyIcon, SkyScene, WARNING_ICON } from '@/components/weather-art';
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
import { radius, space, useTheme } from '@/theme';

const TONE = { calm: 'sage', watch: 'butter', warning: 'peach' } as const;

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
  const { data, status, loading, refresh } = useFloodWatch();
  const [areaId, setAreaId] = useState<AreaId>('shahalam');
  const [sent, setSent] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const area = AREAS.find((a) => a.id === areaId)!;
  const st = status[areaId];
  const level = st?.level ?? 'calm';
  const days = data?.forecast[areaId] ?? [];
  const today = days[0];
  const { local, state } = data ? warningsFor(area, data.warnings, data.fetchedAt) : { local: [], state: [] };
  const rivers = data ? stationsFor(area, data.stations, data.fetchedAt) : [];
  const toneOn = { calm: c.onSage, watch: c.onButter, warning: c.onPeach }[level];

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
      <Segmented value={areaId} onChange={setAreaId} options={AREAS.map((a) => ({ value: a.id, label: a.name }))} />
      <Gap />

      {/* At a glance: the sky, the level, today's numbers. */}
      <Card tone={TONE[level]}>
        <Row gap={space.md}>
          <SkyScene kind={today ? skyKind(today.code) : 'cloud'} level={level} color={toneOn} size={76} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Row gap={6}>
              {level === 'calm' ? <ShieldCheck color={toneOn} size={18} /> : <Waves color={toneOn} size={18} />}
              <T variant="label" color={toneOn}>
                {st ? LEVEL_LABEL[level].toUpperCase() : 'CHECKING…'}
              </T>
            </Row>
            <T variant="title" color={toneOn} testID="flood-today">
              {today ? weatherWords(today.code) : loading ? 'Looking at the sky…' : 'Not loaded'}
            </T>
            {today ? (
              <Row gap={space.md} style={{ flexWrap: 'wrap' }}>
                <Row gap={4}>
                  <Thermometer color={toneOn} size={16} />
                  <T variant="small" color={toneOn}>
                    {today.minC}–{today.maxC}°
                  </T>
                </Row>
                <Row gap={4}>
                  <Umbrella color={toneOn} size={16} />
                  <T variant="small" color={toneOn}>
                    {today.rainChance}%
                  </T>
                </Row>
                <Row gap={4}>
                  <Droplets color={toneOn} size={16} />
                  <T variant="small" color={toneOn}>
                    {today.rainMm} mm
                  </T>
                </Row>
              </Row>
            ) : null}
          </View>
        </Row>
        {st?.headline ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: why }}
            onPress={() => setWhy((v) => !v)}
            hitSlop={6}
            style={{ marginTop: space.md, minHeight: 36, justifyContent: 'center' }}>
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
      <Gap />

      {local.length || state.length ? (
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

      <SectionTitle>Next 7 days</SectionTitle>
      {days.length === 0 ? (
        <Card>
          <T muted>{loading ? 'Loading the forecast…' : 'The forecast didn’t load. Tap refresh to try again.'}</T>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xs }}>
          {days.map((d, i) => {
            const risk = rainRisk(d);
            const bg = risk >= 3 ? c.peach : risk === 2 ? c.butter : c.surface;
            const fg = risk >= 3 ? c.onPeach : risk === 2 ? c.onButter : c.text;
            const day = i === 0 ? 'Today' : fromDayKey(d.date).toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <View
                key={d.date}
                accessible
                accessibilityLabel={`${day}: ${weatherWords(d.code)}, ${d.minC} to ${d.maxC} degrees, ${d.rainChance}% chance of rain`}
                style={{
                  width: 76,
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: space.md,
                  borderRadius: radius.md,
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: c.border,
                }}>
                <T variant="label" color={fg}>
                  {day}
                </T>
                <SkyIcon kind={skyKind(d.code)} size={28} color={fg} />
                <T variant="bodyStrong" color={fg}>
                  {d.maxC}°
                </T>
                <T variant="small" color={risk >= 2 ? fg : c.textMuted}>
                  {d.minC}°
                </T>
                <Row gap={2}>
                  <Umbrella color={risk >= 2 ? fg : c.textMuted} size={13} />
                  <T variant="small" color={risk >= 2 ? fg : c.textMuted}>
                    {d.rainChance}%
                  </T>
                </Row>
              </View>
            );
          })}
        </ScrollView>
      )}
      <Gap />

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

      <Button kind="ghost" small icon={RefreshCw} label={loading ? 'Refreshing…' : 'Refresh'} disabled={loading} onPress={() => refresh(true)} />
      <Gap h={space.sm} />
      <T variant="small" muted center>
        Open-Meteo · MET Malaysia · JPS via data.gov.my
        {data ? ` · ${new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
        {'\n'}A gentle guide. Always follow the authorities.
      </T>
    </Screen>
  );
}
