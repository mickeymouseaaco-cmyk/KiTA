/**
 * Cycle tracker (optional). Setup and today's symptoms. Private by default:
 * the setup itself is never shared, and today's phase only if the person
 * turns cycle sharing on.
 */
import { router } from 'expo-router';
import { CalendarHeart, Lock, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, Field, Gap, IconButton, Row, Screen, SectionTitle, SkeletonPage, T, ToggleRow } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { PHASE_LABEL, PHASE_LINE, SYMPTOMS, cycleToday, predictionLine } from '@/lib/cycle';
import { addDays, dayKey, friendlyDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { saveCycleSettings, setShareCategory, syncCycleDay, useCycleSettings, useMyDays, useShareSettings } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import type { CycleSettings } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function Cycle() {
  const { uid } = usePaired();
  const settings = useCycleSettings(uid);
  const today = dayKey();
  const { days, ready } = useMyDays(uid, today);
  if (!settings || !ready) return <SkeletonPage />;
  return settings.enabled ? <CycleToday settings={settings} symptoms={days[today]?.cycle?.symptoms ?? []} /> : <CycleSetup initial={settings} />;
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <Row gap={space.md}>
      <IconButton icon={Minus} label={`Fewer days for ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <T variant="title" style={{ minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${value} days`}>
        {value}
      </T>
      <IconButton icon={Plus} label={`More days for ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
      <T muted>days</T>
    </Row>
  );
}

function CycleSetup({ initial }: { initial: CycleSettings }) {
  const { c } = useTheme();
  const { uid, cid } = usePaired();
  const { toast } = useFeedback();
  const [ago, setAgo] = useState(0);
  const [cycleLength, setCycleLength] = useState(initial.cycleLength || 28);
  const [periodLength, setPeriodLength] = useState(initial.periodLength || 5);
  const [busy, setBusy] = useState(false);
  const lastStart = dayKey(addDays(new Date(), -ago));

  async function start() {
    setBusy(true);
    try {
      await saveCycleSettings({ uid, cid }, { enabled: true, lastStart, cycleLength, periodLength });
      haptic.success();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card tone="lavender">
        <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
          <Lock color={c.primary} size={18} style={{ marginTop: 3 }} />
          <T style={{ flex: 1 }}>
            Completely optional, and just for you unless you choose to share it. Predictions are gentle estimates, not medical advice.
          </T>
        </Row>
      </Card>
      <Gap />
      <Field label="When did your last period start?" helper={friendlyDate(lastStart)}>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 5, 7, 10, 14, 21].map((n) => (
            <Chip key={n} label={n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`} selected={ago === n} onPress={() => setAgo(n)} />
          ))}
        </Row>
      </Field>
      <Gap h={space.xl} />
      <Field label="Usual cycle length" helper="About 28 days is common, but everyone is different.">
        <Stepper value={cycleLength} onChange={setCycleLength} min={18} max={60} label="cycle length" />
      </Field>
      <Gap h={space.xl} />
      <Field label="Usual period length">
        <Stepper value={periodLength} onChange={setPeriodLength} min={1} max={10} label="period length" />
      </Field>
      <Gap h={space.xxl} />
      <Button testID="start-cycle" label="Start tracking" onPress={start} loading={busy} />
    </Screen>
  );
}

function CycleToday({ settings, symptoms }: { settings: CycleSettings; symptoms: string[] }) {
  const { c } = useTheme();
  const { uid, cid, partnerName } = usePaired();
  const share = useShareSettings(uid);
  const { toast } = useFeedback();
  const info = cycleToday(settings, dayKey(), symptoms);

  async function toggleSymptom(s: string) {
    const next = symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s];
    try {
      await syncCycleDay({ uid, cid }, settings, next);
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {info ? (
        <Card tone="rose">
          <Row gap={space.md}>
            <CalendarHeart color={c.heart} size={28} />
            <View style={{ flex: 1 }}>
              <T testID="cycle-phase" variant="title">
                {PHASE_LABEL[info.phase]} · day {info.day}
              </T>
              <T muted>{predictionLine(info)}</T>
            </View>
          </Row>
          <Gap h={space.md} />
          <T>{PHASE_LINE[info.phase]}</T>
        </Card>
      ) : (
        <Card>
          <T muted>Your cycle will show here from your start date.</T>
        </Card>
      )}
      <Gap />
      <SectionTitle>How is your body today?</SectionTitle>
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {SYMPTOMS.map((s) => (
          <Chip key={s} testID={`symptom-${s}`} label={s} selected={symptoms.includes(s)} onPress={() => toggleSymptom(s)} />
        ))}
      </Row>
      <Gap h={space.xl} />
      <Card>
        {share ? (
          <ToggleRow
            testID="share-cycle-toggle"
            title={`Share with ${partnerName}`}
            detail="They'd see today's phase and symptoms, with gentle ideas for how to help. Never your dates or history."
            value={share.cycle}
            onChange={(v) => setShareCategory({ uid, cid }, 'cycle', v).catch(() => toast(gentleError.save))}
          />
        ) : null}
      </Card>
      <Gap h={space.xl} />
      <Button label="My period started today" kind="soft" onPress={() => saveCycleSettings({ uid, cid }, { ...settings, lastStart: dayKey() }).then(() => toast('Noted. Be gentle with yourself.'))} />
      <Gap h={space.sm} />
      <Button
        label="Turn off cycle tracking"
        kind="ghost"
        onPress={async () => {
          await saveCycleSettings({ uid, cid }, { ...settings, enabled: false });
          router.back();
        }}
      />
    </Screen>
  );
}
