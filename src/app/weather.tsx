/** Weather & flood watch for home: Shah Alam and Klang. Calm, clear, and honest about its sources. */
import { AtSign, CloudRain, ExternalLink, HeartHandshake, Phone, RefreshCw, ShieldCheck, Waves } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, Screen, Segmented, SectionTitle, T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { fromDayKey } from '@/lib/dates';
import {
  AREAS,
  LEVEL_LABEL,
  SAFETY_TIPS,
  SOURCE_LINKS,
  rainRisk,
  riverLevel,
  stationsFor,
  threadsSearchUrl,
  useFloodWatch,
  warningsFor,
  weatherWords,
  type AreaId,
} from '@/lib/flood';
import { haptic } from '@/lib/haptics';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

const TONE = { calm: 'sage', watch: 'butter', warning: 'peach' } as const;
const RAIN_WORD = ['Dry', 'Some rain', 'Heavy showers', 'Very heavy rain'];

export default function Weather() {
  const { c } = useTheme();
  const who = usePaired();
  const { partnerName } = who;
  const { toast } = useFeedback();
  const { data, status, loading, refresh } = useFloodWatch();
  const [areaId, setAreaId] = useState<AreaId>('shahalam');
  const [sent, setSent] = useState<string | null>(null);
  const area = AREAS.find((a) => a.id === areaId)!;
  const st = status[areaId];
  const now = data?.fetchedAt ?? Date.now();
  const days = data?.forecast[areaId] ?? [];
  const { local, state } = data ? warningsFor(area, data.warnings, now) : { local: [], state: [] };
  const rivers = data ? stationsFor(area, data.stations, now) : [];
  const toneOn = { calm: c.onSage, watch: c.onButter, warning: c.onPeach }[st?.level ?? 'calm'];

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

      <Card tone={TONE[st?.level ?? 'calm']}>
        <Row gap={space.sm}>
          {st?.level === 'calm' ? <ShieldCheck color={toneOn} size={22} /> : <Waves color={toneOn} size={22} />}
          <T variant="label" color={toneOn}>
            {st ? LEVEL_LABEL[st.level].toUpperCase() : 'CHECKING…'}
          </T>
        </Row>
        <Gap h={space.sm} />
        <T variant="heading" color={toneOn}>
          {st?.headline ?? (loading ? 'Looking at the sky for you…' : 'We couldn’t get the latest weather. Let’s try again in a moment.')}
        </T>
        {st?.reasons.map((r) => (
          <T key={r} variant="small" color={toneOn} style={{ marginTop: space.xs }}>
            • {r}
          </T>
        ))}
        <Gap h={space.md} />
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          <Button testID="flood-safe" small kind="soft" icon={HeartHandshake} label={sent === 'safe' ? 'Sent ✓' : `Tell ${partnerName} I’m safe`} onPress={() => send('safe')} />
          <Button small kind="soft" label={sent === 'ask' ? 'Asked ✓' : 'Ask if they’re okay'} onPress={() => send('ask')} />
        </Row>
      </Card>
      <Gap />

      {local.length || state.length ? (
        <>
          <SectionTitle>Official warnings · MET Malaysia</SectionTitle>
          {[...local, ...state].map((w) => (
            <Card key={`${w.title}${w.validFrom}`} style={{ marginBottom: space.md }}>
              <T variant="bodyStrong">{w.title}</T>
              {w.heading ? <T muted>{w.heading}</T> : null}
              {w.text ? (
                <T variant="small" style={{ marginTop: space.xs }}>
                  {w.text}
                </T>
              ) : null}
              {w.instruction ? (
                <T variant="small" muted style={{ marginTop: space.xs }}>
                  {w.instruction}
                </T>
              ) : null}
              {w.validTo ? (
                <T variant="small" muted style={{ marginTop: space.xs }}>
                  Until {w.validTo}
                </T>
              ) : null}
            </Card>
          ))}
          <Gap h={space.sm} />
        </>
      ) : null}

      <SectionTitle right={<CloudRain color={c.textMuted} size={18} />}>{`Next 7 days in ${area.name}`}</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {days.length === 0 ? (
          <T muted style={{ paddingVertical: space.md }}>
            {loading ? 'Loading the forecast…' : 'The forecast didn’t load. Tap refresh to try again.'}
          </T>
        ) : (
          days.map((d, i) => {
            const risk = rainRisk(d);
            return (
              <Row key={d.date} gap={space.md} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <T variant="bodyStrong" style={{ width: 52 }}>
                  {i === 0 ? 'Today' : fromDayKey(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
                </T>
                <View style={{ flex: 1 }}>
                  <T>{weatherWords(d.code)}</T>
                  <T variant="small" muted>
                    {RAIN_WORD[risk]} · {d.rainMm} mm · {d.rainChance}% chance
                  </T>
                </View>
                <T variant="small" muted>
                  {d.minC}–{d.maxC}°
                </T>
              </Row>
            );
          })
        )}
      </Card>
      <Gap />

      <SectionTitle right={<AtSign color={c.textMuted} size={18} />}>What people are posting · Threads</SectionTitle>
      <Card>
        <T variant="small" muted>
          {`Recent public posts about flooding around ${area.name}: photos of roads, water levels, closures. Opens in Threads.`}
        </T>
        <Gap h={space.md} />
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {area.threads.map((s) => (
            <Button key={s.query} testID={`threads-${s.query}`} small kind="soft" icon={ExternalLink} label={s.label} onPress={() => open(threadsSearchUrl(s.query))} />
          ))}
        </Row>
        <Gap h={space.sm} />
        <T variant="small" muted>
          Posts are from people, not the authorities, and can be old or wrong. Check the date, and trust MET and JPS first.
        </T>
      </Card>
      <Gap />

      <SectionTitle>Rivers nearby · JPS</SectionTitle>
      <Card>
        {rivers.length ? (
          rivers.slice(0, 6).map((s) => {
            const lvl = riverLevel(s);
            return (
              <Row key={s.name} gap={space.md} style={{ paddingVertical: space.xs }}>
                <View style={{ flex: 1 }}>
                  <T>{s.name}</T>
                  <T variant="small" muted>
                    {s.basin ? `${s.basin} · ` : ''}
                    {s.levelM !== null ? `${s.levelM} m` : 'no reading'}
                    {s.alertM !== null ? ` (alert at ${s.alertM} m)` : ''}
                  </T>
                </View>
                <T variant="small" color={lvl === 'normal' ? c.textMuted : c.text}>
                  {lvl === 'normal' ? 'Normal' : lvl === 'unknown' ? '—' : lvl[0].toUpperCase() + lvl.slice(1)}
                </T>
              </Row>
            );
          })
        ) : (
          <T muted>
            {data
              ? 'Live river levels aren’t available in the app right now. JPS Public Infobanjir has the latest readings.'
              : 'Loading river levels…'}
          </T>
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

      <SectionTitle>{st?.level === 'warning' ? 'Right now' : 'Be ready, gently'}</SectionTitle>
      <Card>
        {SAFETY_TIPS[st?.level ?? 'calm'].map((t) => (
          <T key={t} style={{ marginBottom: space.sm }}>
            • {t}
          </T>
        ))}
        <Button testID="call-999" kind={st?.level === 'warning' ? 'primary' : 'ghost'} small icon={Phone} label="Emergency: call 999" onPress={() => open('tel:999')} />
      </Card>
      <Gap />

      <Button kind="ghost" small icon={RefreshCw} label={loading ? 'Refreshing…' : 'Refresh'} disabled={loading} onPress={() => refresh(true)} />
      <Gap h={space.sm} />
      <T variant="small" muted center>
        Forecast: Open-Meteo. Warnings: MET Malaysia. Rivers: JPS, via data.gov.my.
        {data ? ` Updated ${new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.` : ''}
        {'\n'}This is a gentle guide. Always follow official warnings and the authorities.
      </T>
    </Screen>
  );
}
