/**
 * Argument Reset. Three soft steps, no blame, no recap of what went wrong.
 */
import { router } from 'expo-router';
import { Droplet, HeartHandshake, Lock, Wind } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, Screen, SkeletonPage, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { changeWater, useMyDays } from '@/lib/logs';
import { shareAppreciation, startReset, useReset } from '@/lib/reset';
import { usePaired } from '@/lib/session';
import { radius, space, useTheme } from '@/theme';

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Card tone={done ? 'sage' : 'surface'}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? c.surface : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="bodyStrong" color={c.primary}>
            {done ? '✓' : n}
          </T>
        </View>
        <View style={{ flex: 1, gap: space.sm }}>
          <T variant="heading">{title}</T>
          {children}
        </View>
      </Row>
    </Card>
  );
}

export default function ArgumentReset() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const today = dayKey();
  const { reset, mine, theirs } = useReset(cid, uid, partnerId, today);
  const { days } = useMyDays(uid, today);
  const [paused, setPaused] = useState(false);
  const [drank, setDrank] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (reset === undefined) return <SkeletonPage />;

  if (!reset) {
    return (
      <Screen edges={['bottom']}>
        <Card tone="lavender">
          <HeartHandshake color={c.primary} size={32} />
          <Gap h={space.md} />
          <T variant="title">A gentle reset</T>
          <Gap h={space.sm} />
          <T>
            Tense days happen to every couple. This isn&apos;t about who was right. It&apos;s three small steps you both take,
            in your own time.
          </T>
          <Gap h={space.md} />
          <T muted>
            {partnerName} will get a soft invitation. Nothing about what happened is shared.
          </T>
        </Card>
        <Gap />
        <Button
          testID="start-reset"
          label="Start a reset together"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await startReset(cid, uid, today);
              haptic.soft();
            } catch {
              toast(gentleError.send);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Gap h={space.sm} />
        <Button label="Not today" kind="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const starter = reset.startedBy === uid ? 'You' : partnerName;

  return (
    <Screen edges={['bottom']}>
      <T muted>{starter} started a gentle reset today. Take each step whenever you&apos;re ready.</T>
      <Gap />
      <View style={{ gap: space.md }}>
        <Step n={1} done={paused} title="Pause">
          <T muted>Step away for a moment. A few slow breaths help.</T>
          {!paused ? (
            <Row gap={space.sm}>
              <Button small kind="soft" icon={Wind} label="Breathe" onPress={() => router.push('/calm')} />
              <Button testID="reset-paused" small kind="quiet" label="I've paused" onPress={() => setPaused(true)} />
            </Row>
          ) : null}
        </Step>
        <Step n={2} done={drank} title="Drink some water">
          {!drank ? (
            <Button
              testID="reset-water"
              small
              kind="quiet"
              icon={Droplet}
              label="I had a glass"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => {
                setDrank(true);
                changeWater({ uid, cid }, days[today]?.food?.water ?? 0, 1).catch(() => {});
              }}
            />
          ) : null}
        </Step>
        <Step n={3} done={!!mine} title={`Share one thing you appreciate about ${partnerName}`}>
          {mine ? (
            <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.md }}>
              <T variant="small" muted>
                You shared
              </T>
              <T>{mine.text}</T>
            </View>
          ) : (
            <>
              <TextInput
                testID="reset-input"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
                placeholder="I appreciate how you…"
                placeholderTextColor={c.textMuted}
                style={[input, { minHeight: 90, textAlignVertical: 'top' }]}
              />
              <Row gap={space.xs}>
                <Lock color={c.textMuted} size={13} />
                <T variant="small" muted>
                  You&apos;ll see theirs once you&apos;ve shared yours.
                </T>
              </Row>
              <Button
                testID="reset-share"
                small
                label="Share it"
                disabled={!text.trim()}
                onPress={async () => {
                  try {
                    await shareAppreciation(cid, uid, text, today);
                    haptic.success();
                  } catch {
                    toast(gentleError.send);
                  }
                }}
              />
            </>
          )}
        </Step>
      </View>
      {mine ? (
        <>
          <Gap />
          <Card tone="rose">
            {theirs ? (
              <>
                <T variant="small" muted>
                  {partnerName} appreciates
                </T>
                <T testID="reset-theirs" variant="heading">
                  {theirs.text}
                </T>
              </>
            ) : (
              <T muted>{partnerName}&apos;s appreciation will appear here when they&apos;re ready. No rush.</T>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
