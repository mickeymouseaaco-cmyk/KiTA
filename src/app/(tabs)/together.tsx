import { router } from 'expo-router';
import { CalendarDays, CalendarHeart, CalendarRange, CloudRain, Dices, Gift, HandHeart, Heart, HeartHandshake, ListTodo, MapPin, Mic, Plus, Sparkles, Wind } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { MediaById } from '@/components/media-view';
import { PlantCard } from '@/components/plant';
import { OutboxRow, useOutbox } from '@/components/outbox-row';
import { Button, Card, EmptyState, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { empty } from '@/lib/copy';
import { dayKey, friendlyDate } from '@/lib/dates';
import { daysUntil, nextOccurrence, planningPrompt } from '@/lib/ideas';
import { useMemories } from '@/lib/memories';
import { usePaired } from '@/lib/session';
import { useMilestones, type Milestone } from '@/lib/together-data';
import type { Memory } from '@/lib/types';
import { space, useTheme } from '@/theme';

type Tile = {
  route: '/todos' | '/find' | '/weather' | '/weekend' | '/gratitude' | '/mood-calendar' | '/date-night' | '/milestones' | '/reset' | '/schedule-note' | '/bucket-list' | '/calm';
  testID: string;
  icon: typeof ListTodo;
  title: string;
  detail: string;
  tone: 'lavender' | 'sky' | 'peach' | 'butter' | 'rose' | 'sage';
};

/** Grouped by what you're doing: making plans, or looking after each other. */
const GROUPS: { title: string; line: string; tiles: Tile[] }[] = [
  {
    title: 'Plan',
    line: 'Things to do and look forward to',
    tiles: [
      { route: '/todos', testID: 'open-todos-tile', icon: ListTodo, title: 'To-dos', detail: 'A shared, gentle list', tone: 'lavender' },
      { route: '/weekend', testID: 'open-weekend', icon: CalendarRange, title: 'This weekend', detail: 'A simple plan for two', tone: 'peach' },
      { route: '/date-night', testID: 'open-date-night', icon: Dices, title: 'Date night', detail: 'Ideas for any budget', tone: 'rose' },
      { route: '/milestones', testID: 'open-milestones', icon: Heart, title: 'Special days', detail: 'With a nudge before each', tone: 'butter' },
      { route: '/bucket-list', testID: 'open-bucket-tile', icon: MapPin, title: 'Bucket list', detail: 'Places to go one day', tone: 'sky' },
      { route: '/schedule-note', testID: 'open-surprise', icon: Gift, title: 'Surprise note', detail: 'Hide one for later', tone: 'sage' },
    ],
  },
  {
    title: 'Care',
    line: 'Looking after each other',
    tiles: [
      { route: '/gratitude', testID: 'open-gratitude', icon: HandHeart, title: 'Gratitude', detail: 'One thank-you a day', tone: 'butter' },
      { route: '/mood-calendar', testID: 'open-mood-calendar', icon: CalendarDays, title: 'Our moods', detail: 'A month, side by side', tone: 'lavender' },
      { route: '/calm', testID: 'open-calm-tile', icon: Wind, title: 'Calm Corner', detail: 'Breathe, sounds, vent', tone: 'sage' },
      { route: '/reset', testID: 'open-reset-tile', icon: HeartHandshake, title: 'Gentle reset', detail: 'After a tense day', tone: 'peach' },
      { route: '/find', testID: 'open-find-tile', icon: MapPin, title: 'Find each other', detail: 'Where you both are', tone: 'lavender' },
      { route: '/weather', testID: 'open-weather-tile', icon: CloudRain, title: 'Weather & floods', detail: 'Shah Alam and Klang', tone: 'sky' },
    ],
  },
];

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
          <Pressable accessibilityRole="button" onPress={() => router.push('/milestones')}>
            <Card tone="rose">
              <Row gap={space.sm}>
                <Heart color={c.heart} size={20} />
                <T variant="bodyStrong" style={{ flex: 1 }}>
                  {nextMilestone.m.title}: {nextMilestone.days === 0 ? 'today!' : nextMilestone.days === 1 ? 'tomorrow' : `in ${nextMilestone.days} days`}
                </T>
              </Row>
              <T muted style={{ marginTop: space.xs }}>
                {planningPrompt(nextMilestone.m.kind, nextMilestone.days)}
              </T>
            </Card>
          </Pressable>
          <Gap />
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {g.tiles.map((r) => (
              <Pressable
                key={r.route}
                testID={r.testID}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}. ${r.detail}`}
                style={{ width: '48%', flexGrow: 1 }}
                onPress={() => router.push(r.route)}>
                <Card tone={r.tone} style={{ flex: 1, minHeight: 100, padding: space.lg }}>
                  <r.icon color={c.primary} size={24} />
                  <Gap h={space.sm} />
                  <T variant="bodyStrong">{r.title}</T>
                  <T variant="small" muted>
                    {r.detail}
                  </T>
                </Card>
              </Pressable>
            ))}
          </View>
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
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/memory/[id]', params: { id: throwback.id } })}>
            <Card tone="butter">
              <Row gap={space.sm}>
                <Sparkles color={c.onButter} size={20} />
                <T variant="heading" color={c.onButter}>
                  Remember this day?
                </T>
              </Row>
              <T color={c.onButter} style={{ marginTop: space.xs }}>
                {friendlyDate(throwback.date)}: {throwback.caption || 'a little moment together'}
              </T>
            </Card>
          </Pressable>
          <Gap />
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
