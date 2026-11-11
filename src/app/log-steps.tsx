import { router } from 'expo-router';
import { Minus, Plus, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useCelebrate } from '@/components/celebrate';
import { useFeedback } from '@/components/feedback';
import { Button, Chip, Field, Gap, IconButton, Row, Screen, SkeletonPage, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { saveSteps, setStepGoal, useMyDays } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

const GOALS = [5000, 6000, 8000, 10000];

export default function LogSteps() {
  const { uid } = usePaired();
  const today = dayKey();
  const { days, ready } = useMyDays(uid, today);
  if (!ready) return <SkeletonPage />;
  return <StepsForm initialSteps={days[today]?.steps ?? 0} />;
}

function StepsForm({ initialSteps }: { initialSteps: number }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, profile } = usePaired();
  const { toast } = useFeedback();
  const celebrate = useCelebrate();
  const [steps, setSteps] = useState(initialSteps);
  const [goal, setGoal] = useState(profile?.stepGoal ?? 8000);
  const [busy, setBusy] = useState(false);

  const bump = (n: number) => {
    haptic.tap();
    setSteps((s) => Math.max(0, s + n));
  };

  async function save() {
    setBusy(true);
    try {
      if (goal !== profile?.stepGoal) await setStepGoal(uid, goal);
      await saveSteps({ uid, cid }, steps, goal);
      if (steps >= goal && initialSteps < goal) celebrate('You reached your step goal today. Lovely!');
      else haptic.success();
      router.back();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <T muted>Enter today&apos;s steps from your phone or watch.</T>
      <Gap h={space.sm} />
      <Button
        testID="open-steps-sync"
        small
        kind="ghost"
        icon={Smartphone}
        label="Sync from iPhone Health instead"
        onPress={() => {
          router.back();
          router.push('/steps-sync');
        }}
      />
      <Gap h={space.xl} />
      <Row gap={space.md} style={{ justifyContent: 'center' }}>
        <IconButton icon={Minus} label="Remove 500 steps" size={56} onPress={() => bump(-500)} />
        <TextInput
          testID="steps-input"
          accessibilityLabel="Steps today"
          value={steps ? String(steps) : ''}
          onChangeText={(t) => setSteps(Number(t.replace(/\D/g, '').slice(0, 6)) || 0)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={c.textMuted}
          style={[input, { flex: 1, maxWidth: 200, fontSize: 32, lineHeight: 40, textAlign: 'center', fontFamily: 'Lora_600SemiBold' }]}
        />
        <IconButton icon={Plus} label="Add 500 steps" size={56} onPress={() => bump(500)} />
      </Row>
      <Gap h={space.md} />
      <Row gap={space.sm} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1000, 2000, 5000].map((n) => (
          <Chip key={n} label={`+${n.toLocaleString()}`} onPress={() => bump(n)} />
        ))}
      </Row>
      <Gap h={space.xxl} />
      <Field label="A gentle daily goal" helper="Just a guide. There's no such thing as falling short here.">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {GOALS.map((g) => (
            <Chip key={g} label={g.toLocaleString()} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>
      </Field>
      <Gap h={space.xxl} />
      <Button testID="save-steps" label="Save" onPress={save} loading={busy} />
    </Screen>
  );
}
