/** Date Night Generator: random ideas filtered by budget, energy, and time. */
import { Dices, Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, EmptyState, Field, Gap, Row, Screen, T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { pickIdea, type Budget, type DateIdea, type Energy, type IdeaFilter, type TimeNeeded } from '@/lib/ideas';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

const BUDGETS: { v: Budget; label: string }[] = [
  { v: 0, label: 'Free' },
  { v: 1, label: 'A little' },
  { v: 2, label: 'A treat' },
];
const ENERGY: { v: Energy; label: string }[] = [
  { v: 'cozy', label: 'Cozy' },
  { v: 'active', label: 'Up for it' },
];
const TIME: { v: TimeNeeded; label: string }[] = [
  { v: 'short', label: 'An hour' },
  { v: 'evening', label: 'An evening' },
  { v: 'day', label: 'A whole day' },
];

export default function DateNight() {
  const { c } = useTheme();
  const who = usePaired();
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<IdeaFilter>({});
  const [idea, setIdea] = useState<DateIdea | null>(null);
  const [tried, setTried] = useState(false);

  function roll(f = filter) {
    haptic.soft();
    setTried(true);
    setIdea(pickIdea(f, idea?.id));
  }

  function toggle<K extends keyof IdeaFilter>(key: K, v: IdeaFilter[K]) {
    const next = { ...filter, [key]: filter[key] === v ? undefined : v };
    setFilter(next);
  }

  return (
    <Screen edges={['bottom']}>
      <Field label="Budget">
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {BUDGETS.map((b) => (
            <Chip key={b.v} testID={`budget-${b.v}`} label={b.label} selected={filter.budget === b.v} onPress={() => toggle('budget', b.v)} />
          ))}
        </Row>
      </Field>
      <Gap />
      <Field label="Energy">
        <Row gap={space.sm}>
          {ENERGY.map((e) => (
            <Chip key={e.v} testID={`energy-${e.v}`} label={e.label} selected={filter.energy === e.v} onPress={() => toggle('energy', e.v)} />
          ))}
        </Row>
      </Field>
      <Gap />
      <Field label="Time">
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {TIME.map((t) => (
            <Chip key={t.v} testID={`time-${t.v}`} label={t.label} selected={filter.time === t.v} onPress={() => toggle('time', t.v)} />
          ))}
        </Row>
      </Field>
      <Gap h={space.xl} />
      <Button testID="roll-idea" label={idea ? 'Another idea' : 'Give us an idea'} icon={Dices} onPress={() => roll()} />
      <Gap />
      {idea ? (
        <Card tone="rose">
          <T testID="idea-title" variant="title">
            {idea.title}
          </T>
          <Gap h={space.sm} />
          <T>{idea.detail}</T>
          <Gap h={space.md} />
          <T variant="small" muted>
            {BUDGETS[idea.budget].label} · {ENERGY.find((e) => e.v === idea.energy)?.label} · {TIME.find((t) => t.v === idea.time)?.label}
          </T>
          <Gap h={space.md} />
          <Button
            testID="send-idea"
            small
            kind="quiet"
            icon={Send}
            label={`Suggest it to ${who.partnerName}`}
            onPress={async () => {
              try {
                await sendText(who, `Date idea: ${idea.title}? ${idea.detail}`, 'quick');
                toast(`Sent to ${who.partnerName} ♥`);
              } catch {
                toast(gentleError.send);
              }
            }}
          />
        </Card>
      ) : tried ? (
        <View>
          <EmptyState icon={Dices} line="Nothing quite fits those choices. Try loosening one?" />
        </View>
      ) : (
        <T muted center>
          Pick what fits tonight, or leave it open for a surprise.
        </T>
      )}
      <Gap />
      <T variant="small" muted center style={{ color: c.textMuted }}>
        Ideas are just ideas. The best date is the one you both enjoy.
      </T>
    </Screen>
  );
}
