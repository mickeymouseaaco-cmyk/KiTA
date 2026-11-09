/**
 * Calm Corner: two minutes of guided breathing, soft looping sounds, and the
 * private Vent. Nothing here is logged or shared.
 */
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { CloudRain, Pause, Play, Waves, Wind } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';

import { Button, Card, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { useCelebrate } from '@/components/celebrate';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { care } from '@/lib/together-data';
import { space, useTheme } from '@/theme';

const PHASES = [
  { key: 'in', label: 'Breathe in', ms: 4000, to: 1 },
  { key: 'hold', label: 'Hold softly', ms: 2000, to: 1 },
  { key: 'out', label: 'Breathe out', ms: 6000, to: 0.55 },
] as const;
const CYCLE_MS = PHASES.reduce((a, p) => a + p.ms, 0);
const SESSION_MS = 120_000;

const SOUNDS = [
  { key: 'rain', label: 'Rain', icon: CloudRain, source: require('@/assets/sounds/rain.wav') },
  { key: 'ocean', label: 'Ocean', icon: Waves, source: require('@/assets/sounds/ocean.wav') },
  { key: 'brown', label: 'Soft hum', icon: Wind, source: require('@/assets/sounds/brown-noise.wav') },
] as const;

function phaseAt(elapsed: number) {
  let t = elapsed % CYCLE_MS;
  for (let i = 0; i < PHASES.length; i++) {
    if (t < PHASES[i].ms) return { index: i, remaining: PHASES[i].ms - t };
    t -= PHASES[i].ms;
  }
  return { index: 0, remaining: PHASES[0].ms };
}

function Breathing() {
  const { c } = useTheme();
  const { uid, cid } = useSession();
  const celebrate = useCelebrate();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [scale] = useState(() => new Animated.Value(0.55));
  const running = startedAt !== null && elapsed < SESSION_MS;
  const done = startedAt !== null && elapsed >= SESSION_MS;
  const { index } = phaseAt(elapsed);
  const phase = PHASES[index];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [startedAt]);

  // A gentle tap and an eased change of size at each phase.
  useEffect(() => {
    if (!running) return;
    haptic.soft();
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: phase.to,
      duration: phase.ms,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, running, reduceMotion, phase, scale]);

  // Two calm minutes: a little care for you (and the plant).
  useEffect(() => {
    if (!done || !uid) return;
    void care({ uid, cid });
    celebrate();
  }, [done, uid, cid, celebrate]);

  const left = Math.max(0, Math.ceil((SESSION_MS - elapsed) / 1000));

  return (
    <Card tone="sage">
      <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: c.surface,
              opacity: 0.85,
              transform: [{ scale }],
            }}
          />
          <T variant="title" color={c.onSage} center accessibilityLiveRegion="polite" testID="breath-label">
            {done ? 'Well done' : running ? phase.label : 'Ready?'}
          </T>
        </View>
        <Gap h={space.md} />
        <T color={c.onSage} center>
          {done
            ? 'Two minutes, just for you. Carry this calm with you.'
            : running
              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`
              : 'In for 4, hold for 2, out for 6. Two minutes.'}
        </T>
        <Gap h={space.lg} />
        <Button
          testID="breathe-toggle"
          kind="quiet"
          small
          label={running ? 'Stop' : done ? 'Again' : 'Begin'}
          onPress={() => {
            if (running) {
              setStartedAt(null);
              setElapsed(0);
              scale.setValue(0.55);
            } else {
              setElapsed(0);
              setStartedAt(Date.now());
            }
          }}
        />
      </View>
    </Card>
  );
}

/** Players are native objects; configure them outside render. */
function playLooping(p: AudioPlayer) {
  p.loop = true;
  p.volume = 0.7;
  p.play();
}

function Sounds() {
  const { c } = useTheme();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  function choose(key: string) {
    const s = SOUNDS.find((x) => x.key === key)!;
    haptic.tap();
    if (current === key && status.playing) {
      player.pause();
      return;
    }
    if (current !== key) {
      player.replace(s.source);
      setCurrent(key);
    }
    playLooping(player);
  }

  return (
    <Row gap={space.sm}>
      {SOUNDS.map((s) => {
        const on = current === s.key && status.playing;
        const Icon = s.icon;
        return (
          <Pressable
            key={s.key}
            testID={`sound-${s.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={on ? `Pause ${s.label}` : `Play ${s.label}`}
            onPress={() => choose(s.key)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 96,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              backgroundColor: on ? c.primary : c.surfaceAlt,
              opacity: pressed ? 0.85 : 1,
            })}>
            <Icon color={on ? c.onPrimary : c.primary} size={26} />
            <Row gap={4}>
              {on ? <Pause color={c.onPrimary} size={12} fill={c.onPrimary} /> : <Play color={c.primary} size={12} fill={c.primary} />}
              <T variant="small" color={on ? c.onPrimary : c.text}>
                {s.label}
              </T>
            </Row>
          </Pressable>
        );
      })}
    </Row>
  );
}

export default function Calm() {
  const { c } = useTheme();
  return (
    <Screen edges={['bottom']}>
      <Breathing />
      <Gap />
      <SectionTitle>Soft sounds</SectionTitle>
      <Sounds />
      <Gap h={space.xl} />
      <Card tone="lavender">
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Wind color={c.primary} size={24} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="heading">Need to let something out?</T>
            <T muted>Vent by typing or talking. Never saved, never shared.</T>
          </View>
        </Row>
        <Gap h={space.md} />
        <Button testID="open-vent" small kind="soft" label="Open a private vent" onPress={() => router.push('/vent')} />
      </Card>
    </Screen>
  );
}
