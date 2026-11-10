/** Milestones: anniversary, birthdays, first trip, with sweet planning prompts. */
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Cake, Heart, Plane, Sparkles, Trash } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, EmptyState, Field, Gap, Row, Screen, SectionTitle, T, ToggleRow, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { dayKey, friendlyDate } from '@/lib/dates';
import { db } from '@/lib/firebase';
import { haptic } from '@/lib/haptics';
import { MILESTONE_LABEL, daysUntil, nextOccurrence, planningPrompt, yearsSince, type MilestoneKind } from '@/lib/ideas';
import { usePaired } from '@/lib/session';
import { useMilestones, type Milestone } from '@/lib/together-data';
import { space, useTheme } from '@/theme';

const ICON = { anniversary: Heart, birthday: Cake, 'first-trip': Plane, other: Sparkles };

export default function Milestones() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerId, partnerName, myName } = usePaired();
  const { toast } = useFeedback();
  const { data } = useMilestones(cid);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MilestoneKind>('anniversary');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(true);
  const [person, setPerson] = useState<string>(partnerId);
  const today = dayKey();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime());

  const upcoming = useMemo(
    () =>
      data
        .map((m) => ({ m, next: nextOccurrence(m.date, m.yearly, today) }))
        .filter((x): x is { m: Milestone; next: string } => !!x.next)
        .sort((a, b) => (a.next < b.next ? -1 : 1)),
    [data, today],
  );

  async function save() {
    try {
      const doc: Record<string, unknown> = {
        title: title.trim() || (kind === 'birthday' ? `${person === uid ? myName : partnerName}’s birthday` : MILESTONE_LABEL[kind]),
        kind,
        date,
        yearly,
        createdBy: uid,
        createdAt: serverTimestamp(),
      };
      if (kind === 'birthday') doc.personUid = person;
      await addDoc(collection(db, 'couples', cid, 'milestones'), doc);
      haptic.success();
      setAdding(false);
      setTitle('');
      setDate('');
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {upcoming.length === 0 && !adding ? <EmptyState icon={Heart} line="Your special days will gather here, with a gentle nudge before each one." /> : null}
      <View style={{ gap: space.md }}>
        {upcoming.map(({ m, next }, i) => {
          const days = daysUntil(next, today);
          const Icon = ICON[m.kind];
          const years = m.yearly ? yearsSince(m.date, next) : 0;
          const name = m.personUid ? (m.personUid === uid ? 'you' : partnerName) : undefined;
          return (
            <Card key={m.id} tone={i === 0 ? 'rose' : 'surface'}>
              <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                <Icon color={c.heart} size={24} />
                <View style={{ flex: 1 }}>
                  <T testID="milestone-title" variant="heading">
                    {m.title}
                  </T>
                  <T muted>
                    {friendlyDate(next)}
                    {years > 0 && m.kind === 'anniversary' ? ` · ${years} ${years === 1 ? 'year' : 'years'} together` : ''}
                  </T>
                  <T testID="milestone-days" variant="bodyStrong" style={{ marginTop: space.xs }}>
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                  </T>
                  <T testID="milestone-prompt" style={{ marginTop: space.xs }}>
                    {planningPrompt(m.kind, days, name === 'you' ? 'your' : name)}
                  </T>
                </View>
                {m.createdBy === uid ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.title}`} hitSlop={8} onPress={() => deleteDoc(doc(db, 'couples', cid, 'milestones', m.id))} style={{ padding: 6 }}>
                    <Trash color={c.textMuted} size={16} />
                  </Pressable>
                ) : null}
              </Row>
            </Card>
          );
        })}
      </View>
      <Gap />
      {adding ? (
        <Card>
          <SectionTitle>Add a special day</SectionTitle>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {(Object.keys(MILESTONE_LABEL) as MilestoneKind[]).map((k) => (
              <Chip key={k} testID={`ms-kind-${k}`} label={MILESTONE_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </Row>
          {kind === 'birthday' ? (
            <>
              <Gap h={space.sm} />
              <Row gap={space.sm}>
                <Chip label={`${partnerName}’s`} selected={person === partnerId} onPress={() => setPerson(partnerId)} />
                <Chip label="Mine" selected={person === uid} onPress={() => setPerson(uid)} />
              </Row>
            </>
          ) : null}
          <Gap h={space.md} />
          <Field label="Name (optional)">
            <TextInput testID="ms-title" value={title} onChangeText={setTitle} placeholder={MILESTONE_LABEL[kind]} placeholderTextColor={c.textMuted} maxLength={120} style={input} />
          </Field>
          <Gap h={space.md} />
          <Field label="Date" helper={date && !validDate ? 'Let’s use year-month-day, like 2021-06-14.' : 'Year-month-day, like 2021-06-14.'}>
            <TextInput testID="ms-date" value={date} onChangeText={setDate} placeholder="2021-06-14" placeholderTextColor={c.textMuted} keyboardType="numbers-and-punctuation" maxLength={10} style={input} />
          </Field>
          <ToggleRow title="Every year" value={yearly} onChange={setYearly} />
          <Gap h={space.sm} />
          <Button testID="ms-save" label="Save" onPress={save} disabled={!validDate} hint="Choose a real date first." />
          <Gap h={space.sm} />
          <Button label="Cancel" kind="ghost" small onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button testID="ms-add" kind="soft" label="Add a special day" onPress={() => setAdding(true)} />
      )}
      <Gap />
      <T variant="small" muted center>
        You&apos;ll both get a gentle reminder a week before, the day before, and on the day.
      </T>
    </Screen>
  );
}
