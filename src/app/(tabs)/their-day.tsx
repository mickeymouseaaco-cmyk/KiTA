import { router } from 'expo-router';
import {
  Bath,
  Coffee,
  Gift,
  HandHeart,
  Heart,
  HeartHandshake,
  Mic,
  Moon,
  PhoneOff,
  Send,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ProgressRing, WeekBars } from '@/components/charts';
import { useFeedback } from '@/components/feedback';
import { DaySwitch, TopBar } from '@/components/headers';
import { SharedFood } from '@/components/food-card';
import { HugButton } from '@/components/hug-button';
import { MediaById } from '@/components/media-view';
import { Button, Card, Chip, EmptyState, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { QUICK_MESSAGES, STRESS_LABELS, empty, gentleError } from '@/lib/copy';
import { PHASE_LABEL, partnerCycleTips } from '@/lib/cycle';
import { dayKey, lastNDays } from '@/lib/dates';
import { usePartnerDays } from '@/lib/logs';
import { sendText } from '@/lib/messages';
import { useReset } from '@/lib/reset';
import { usePaired } from '@/lib/session';
import { gentleAlert, suggestionsFor, type SuggestionIcon } from '@/lib/suggestions';
import { space, useTheme } from '@/theme';

const ICONS: Record<SuggestionIcon, LucideIcon> = {
  heart: Heart,
  coffee: Coffee,
  moon: Moon,
  gift: Gift,
  bath: Bath,
  'phone-off': PhoneOff,
  sparkles: Sparkles,
  utensils: UtensilsCrossed,
  mic: Mic,
  hand: HandHeart,
};

export default function TheirDay() {
  const { c } = useTheme();
  const { uid, cid, partnerId, partnerName, couple } = usePaired();
  const { toast } = useFeedback();
  const week = useMemo(() => lastNDays(7), []);
  const { days, ready } = usePartnerDays(cid, partnerId, week[0]);
  const today = days[dayKey()];
  const alert = gentleAlert(partnerName, today);
  const ideas = suggestionsFor(partnerName, today, couple?.loveLanguages?.[partnerId] ?? []);
  const { reset } = useReset(cid, uid, partnerId);
  const hasSteps = typeof today?.steps === 'number';
  const sharedAnyStepsThisWeek = week.some((k) => typeof days[k]?.steps === 'number');

  async function quick(text: string) {
    try {
      await sendText({ uid, cid, partnerId }, text, 'quick');
      toast(`Sent to ${partnerName} ♥`);
    } catch {
      toast(gentleError.send);
    }
  }

  return (
    <Screen>
      <TopBar subtitle="Their Day" title={`${partnerName}’s day`} />
      <DaySwitch value="theirs" />

      {alert ? (
        <>
          <Card tone="butter">
            <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
              <HeartHandshake color={c.onButter} size={24} />
              <T testID="gentle-alert" color={c.onButter} style={{ flex: 1 }}>
                {alert.text}
              </T>
            </Row>
          </Card>
          <Gap />
        </>
      ) : null}

      {ready && !today?.mood && !hasSteps && !today?.food && !today?.cycle ? (
        <Card>
          <EmptyState icon={HeartHandshake} line={empty.theirDayNothing(partnerName)} />
        </Card>
      ) : null}
      {ready && !today?.mood && !hasSteps && !today?.food && !today?.cycle ? <Gap /> : null}

      {today?.mood ? (
        <>
          <Card>
            <SectionTitle>Mood</SectionTitle>
            <Row gap={space.lg}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 36, lineHeight: 44 }} accessibilityElementsHidden>
                  {today.mood.emoji}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T testID="partner-mood" variant="heading">
                  Feeling {today.mood.label.toLowerCase()}
                </T>
                <T muted>Stress: {STRESS_LABELS[today.mood.stress].toLowerCase()}</T>
              </View>
            </Row>
            {today.mood.mediaId ? (
              <View style={{ marginTop: space.md }}>
                <MediaById cid={cid} mediaId={today.mood.mediaId} caption={`${partnerName}'s mood`} />
              </View>
            ) : null}
            {today.mood.note ? (
              <T style={{ marginTop: space.md, fontStyle: 'italic' }} muted>
                &ldquo;{today.mood.note}&rdquo;
              </T>
            ) : null}
          </Card>
          <Gap />
        </>
      ) : null}

      {sharedAnyStepsThisWeek ? (
        <>
          <Card>
            <SectionTitle>Steps</SectionTitle>
            <Row gap={space.xl}>
              <ProgressRing value={today?.steps ?? 0} goal={today?.stepGoal ?? 8000} size={120} stroke={12} label={`${partnerName}'s steps`} />
              <WeekBarsFlex days={week} values={week.map((k) => days[k]?.steps)} goal={today?.stepGoal ?? 8000} />
            </Row>
          </Card>
          <Gap />
        </>
      ) : null}

      {today?.food ? (
        <>
          <Card>
            <SectionTitle>Meals</SectionTitle>
            <SharedFood food={today.food} />
          </Card>
          <Gap />
        </>
      ) : null}

      {today?.cycle ? (
        <>
          <Card tone="rose">
            <SectionTitle>Cycle</SectionTitle>
            <T testID="partner-cycle" variant="bodyStrong">
              {PHASE_LABEL[today.cycle.phase]} · day {today.cycle.day}
            </T>
            {today.cycle.symptoms.length ? (
              <T muted>Today: {today.cycle.symptoms.join(', ').toLowerCase()}</T>
            ) : null}
            <Gap h={space.md} />
            <View style={{ gap: space.sm }}>
              {partnerCycleTips(partnerName, today.cycle).map((t) => (
                <Row key={t.id} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                  <Heart color={c.heart} size={16} style={{ marginTop: 4 }} />
                  <View style={{ flex: 1, gap: space.xs }}>
                    <T>{t.text}</T>
                    {t.quickText ? (
                      <Button small kind="quiet" icon={Send} label="Offer it" onPress={() => quick(t.quickText!)} style={{ alignSelf: 'flex-start' }} />
                    ) : null}
                  </View>
                </Row>
              ))}
            </View>
          </Card>
          <Gap />
        </>
      ) : null}

      {reset ? (
        <>
          <Pressable testID="open-reset-banner" accessibilityRole="button" onPress={() => router.push('/reset')}>
            <Card tone="lavender">
              <Row gap={space.sm}>
                <HeartHandshake color={c.primary} size={22} />
                <T variant="bodyStrong" style={{ flex: 1 }}>
                  {reset.startedBy === uid ? 'You started a gentle reset today.' : `${partnerName} would like a gentle reset.`}
                </T>
              </Row>
              <T muted style={{ marginTop: space.xs }}>
                Pause, drink some water, then share one thing you appreciate.
              </T>
            </Card>
          </Pressable>
          <Gap />
        </>
      ) : null}

      <Card tone="rose">
        <HugButton />
        <Gap h={space.lg} />
        <T variant="label" muted center>
          OR SEND A QUICK NOTE
        </T>
        <Gap h={space.sm} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
          {QUICK_MESSAGES.map((m) => (
            <Chip key={m} testID={`quick-${m}`} label={m} onPress={() => quick(m)} />
          ))}
        </View>
      </Card>
      <Gap />

      {!reset ? (
        <Button
          testID="open-reset"
          kind="ghost"
          small
          icon={HeartHandshake}
          label="Tense day between you? Try a gentle reset"
          onPress={() => router.push('/reset')}
          style={{ marginBottom: space.lg }}
        />
      ) : null}
      <SectionTitle>Little ways to show up</SectionTitle>
      <View style={{ gap: space.md }}>
        {ideas.map((s) => {
          const Icon = ICONS[s.icon];
          return (
            <Card key={s.id} style={{ paddingVertical: space.lg }}>
              <Row gap={space.md}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon color={c.primary} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{s.title}</T>
                  <T variant="small" muted>
                    {s.detail}
                  </T>
                </View>
              </Row>
              {s.quickText ? (
                <Button small kind="soft" icon={Send} label={`Send "${s.quickText}"`} onPress={() => quick(s.quickText!)} style={{ marginTop: space.md }} />
              ) : s.id === 'voice-hug' ? (
                <Button
                  small
                  kind="soft"
                  icon={Mic}
                  label="Record a voice hug"
                  onPress={() => router.navigate({ pathname: '/(tabs)/notes', params: { compose: 'voiceHug' } })}
                  style={{ marginTop: space.md }}
                />
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

function WeekBarsFlex(props: Parameters<typeof WeekBars>[0]) {
  return (
    <View style={{ flex: 1 }}>
      <WeekBars {...props} height={80} />
    </View>
  );
}
