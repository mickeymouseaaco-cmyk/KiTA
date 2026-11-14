import { router } from 'expo-router';
import { CalendarDays, CalendarHeart, CalendarRange, CloudRain, Dices, Gift, HandHeart, Hammer, Heart, HeartHandshake, ListTodo, MapPin, Mic, Plus, Sparkles, Wind } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { MediaById } from '@/components/media-view';
import { PlantCard } from '@/components/plant';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { Button, Card, EmptyState, Gap, Row, Screen, T } from '@/components/ui';
import { WIDGET_GAP, Widget, WidgetCaption, WidgetRow, WidgetValue, type WidgetFill } from '@/components/widgets';
import { empty } from '@/lib/copy';
import { dayKey, friendlyDate } from '@/lib/dates';
import { daysUntil, nextOccurrence, planningPrompt } from '@/lib/ideas';
import { useMemories } from '@/lib/memories';
import { usePaired } from '@/lib/session';
import { useMilestones, type Milestone } from '@/lib/together-data';
import type { Memory } from '@/lib/types';
import { space, useTheme } from '@/theme';

type Tile = {
  route: '/todos' | '/find' | '/weather' | '/weekend' | '/gratitude' | '/mood-calendar' | '/date-night' | '/milestones' | '/reset' | '/schedule-note' | '/bucket-list' | '/calm' | '/stress-smash';
  testID: string;
  icon: typeof ListTodo;
  title: string;
  detail: string;
  fill: Exclude<WidgetFill, 'surface'>;
};

/** Grouped by what you're doing: making plans, or looking after each other. */
const GROUPS: { title: string; line: string; tiles: Tile[] }[] = [
  {
    title: 'Plan',
    line: 'Things to do and look forward to',
    tiles: [
      { route: '/todos', testID: 'open-todos-tile', icon: ListTodo, title: 'To-dos', detail: 'A shared, gentle list', fill: 'blue' },
      { route: '/weekend', testID: 'open-weekend', icon: CalendarRange, title: 'This weekend', detail: 'A simple plan for two', fill: 'orange' },
      { route: '/date-night', testID: 'open-date-night', icon: Dices, title: 'Date night', detail: 'Ideas for any budget', fill: 'pink' },
      { route: '/milestones', testID: 'open-milestones', icon: Heart, title: 'Special days', detail: 'With a nudge before each', fill: 'amber' },
      { route: '/bucket-list', testID: 'open-bucket-tile', icon: MapPin, title: 'Bucket list', detail: 'Places to go one day', fill: 'teal' },
      { route: '/schedule-note', testID: 'open-surprise', icon: Gift, title: 'Surprise note', detail: 'Hide one for later', fill: 'violet' },
    ],
  },
  {
    title: 'Care',
    line: 'Looking after each other',
    tiles: [
      { route: '/gratitude', testID: 'open-gratitude', icon: HandHeart, title: 'Gratitude', detail: 'One thank-you a day', fill: 'amber' },
      { route: '/mood-calendar', testID: 'open-mood-calendar', icon: CalendarDays, title: 'Our moods', detail: 'A month, side by side', fill: 'violet' },
      { route: '/calm', testID: 'open-calm-tile', icon: Wind, title: 'Calm Corner', detail: 'Breathe, sounds, vent', fill: 'green' },
      { route: '/stress-smash', testID: 'open-stress-smash', icon: Hammer, title: 'Stress Smash', detail: 'Bonk the stress away', fill: 'pink' },
      { route: '/reset', testID: 'open-reset-tile', icon: HeartHandshake, title: 'Gentle reset', detail: 'After a tense day', fill: 'orange' },
      { route: '/find', testID: 'open-find-tile', icon: MapPin, title: 'Find each other', detail: 'Where you both are', fill: 'teal' },
      { route: '/weather', testID: 'open-weather-tile', icon: CloudRain, title: 'Weather', detail: 'Anywhere, plus flood watch', fill: 'blue' },
    ],
  },
];

/** Tiles two to a row (an odd one out spans the row). */
function pairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

/** "Remember this day?": a memory from this day in an earlier month or year. */
function rememberThisDay(memories: Memory[]): Memory | null {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return memories.find((m) => m.date.endsWith(`-${dd}`) && !m.date.startsWith(thisMonth)) ?? null;
}

export default function Together() {
  const { c } = useTheme();
  const { uid, cid, partnerName } = usePaired();
  const { memories, ready } = useMemories(cid);
  const pending = useOutbox((j) => j.uid === uid && j.cid === cid && j.target.kind === 'memory');
  const throwback = rememberThisDay(memories);
  const { couple } = usePaired();
  const { data: milestones } = useMilestones(cid);
  const today = dayKey();
  const nextMilestone = milestones
    .map((m) => ({ m, next: nextOccurrence(m.date, m.yearly, today) }))
    .filter((x): x is { m: Milestone; next: string } => !!x.next)
    .map((x) => ({ ...x, days: daysUntil(x.next, today) }))
    .filter((x) => x.days <= 30)
    .sort((a, b) => a.days - b.days)[0];

  return (
    <Screen>
      <View style={{ marginBottom: space.lg }}>
        <T variant="small" muted>
          You &amp; {partnerName}
        </T>
        <T variant="display" accessibilityRole="header">
          Together
        </T>
      </View>

      <PlantCard cid={cid} uid={uid} members={couple?.members ?? [uid]} />
      <Gap />

      {nextMilestone ? (
        <>
          <Widget fill="pink" style={{ marginBottom: WIDGET_GAP }} onPress={() => router.push('/milestones')} accessibilityLabel={`${nextMilestone.m.title}. Open special days`}>
            <WidgetCaption icon={Heart} label="Coming up" fill="pink" />
            <View style={{ flex: 1, justifyContent: 'flex-end', gap: 2 }}>
              <WidgetValue color="#FFFFFF" size={30}>
                {nextMilestone.days === 0 ? 'Today!' : nextMilestone.days === 1 ? 'Tomorrow' : `${nextMilestone.days} days`}
              </WidgetValue>
              <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>
                {nextMilestone.m.title}
              </T>
              <T variant="small" color="rgba(255,255,255,0.8)" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
                {planningPrompt(nextMilestone.m.kind, nextMilestone.days)}
              </T>
            </View>
          </Widget>
        </>
      ) : null}

      {GROUPS.map((g) => (
        <View key={g.title} style={{ marginBottom: space.lg }}>
          <T variant="title" accessibilityRole="header">
            {g.title}
          </T>
          <T variant="small" muted style={{ marginBottom: space.md }}>
            {g.line}
          </T>
          {pairs(g.tiles).map((row) => (
            <WidgetRow key={row[0].route}>
              {row.map((r) => (
                <Widget
                  key={r.route}
                  fill={r.fill}
                  height={138}
                  testID={r.testID}
                  accessibilityLabel={`${r.title}. ${r.detail}`}
                  style={{ flex: 1 }}
                  onPress={() => router.push(r.route)}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <r.icon color="#FFFFFF" size={21} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }} />
                  <T variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ fontSize: 16, lineHeight: 21 }}>
                    {r.title}
                  </T>
                  <T variant="small" color="rgba(255,255,255,0.8)" numberOfLines={1} style={{ fontSize: 13, lineHeight: 17 }}>
                    {r.detail}
                  </T>
                </Widget>
              ))}
            </WidgetRow>
          ))}
        </View>
      ))}

      <Gap h={space.xl} />
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <T variant="title" accessibilityRole="header">
          Memory Jar
        </T>
        <Button testID="new-memory" small label="Add" icon={Plus} onPress={() => router.push('/memory-new')} />
      </Row>

      {throwback ? (
        <>
          <Widget fill="amber" height={132} style={{ marginBottom: WIDGET_GAP }} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: throwback.id } })} accessibilityLabel="Remember this day? Open the memory">
            <WidgetCaption icon={Sparkles} label="Remember this day?" fill="amber" />
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <T variant="heading" color="#FFFFFF" numberOfLines={2} style={{ fontSize: 18, lineHeight: 23 }}>
                {throwback.caption || 'A little moment together'}
              </T>
              <T variant="small" color="rgba(255,255,255,0.85)" style={{ fontSize: 13, lineHeight: 17 }}>
                {friendlyDate(throwback.date)}
              </T>
            </View>
          </Widget>
        </>
      ) : null}

      {pending.length ? (
        <View style={{ gap: space.sm, marginBottom: space.lg }}>
          {pending.map((j) => (
            <OutboxRow key={j.id} job={j} />
          ))}
        </View>
      ) : null}

      {ready && memories.length === 0 && pending.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarHeart}
            line={empty.memories}
            action={<Button small kind="soft" label="Add our first memory" onPress={() => router.push('/memory-new')} />}
          />
        </Card>
      ) : null}

      <View style={{ gap: space.lg }}>
        {memories.map((m) => (
          <Pressable
            key={m.id}
            testID="memory-card"
            accessibilityRole="button"
            accessibilityLabel={`${m.caption || 'Memory'}, ${friendlyDate(m.date)}`}
            onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}>
            <Card style={{ padding: space.md }}>
              {m.mediaIds[0] ? <MemoryCover cid={cid} memory={m} /> : null}
              <View style={{ padding: space.sm, gap: 2 }}>
                <T variant="heading" numberOfLines={2}>
                  {m.caption || 'A little moment'}
                </T>
                <Row gap={space.sm}>
                  <T variant="small" muted>
                    {friendlyDate(m.date)}
                    {m.location ? ` · ${m.location}` : ''}
                  </T>
                  {m.mediaIds.length > 1 ? <Mic color={c.textMuted} size={14} accessibilityLabel="Has a voice clip" /> : null}
                </Row>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

    </Screen>
  );
}

function MemoryCover({ cid, memory }: { cid: string; memory: Memory }) {
  return (
    <View pointerEvents="box-none">
      <MediaById cid={cid} mediaId={memory.mediaIds[0]} caption={memory.caption} />
    </View>
  );
}
