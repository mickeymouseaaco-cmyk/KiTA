/**
 * Voice tools.
 * - VoiceRecorder: hold to record, with a live waveform. Slide left to cancel.
 *   A quick tap instead "locks" recording on, for people who'd rather not hold.
 * - VoicePlayer: play/pause, progress, and playback speed.
 */
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { Heart, Mic, Pause, Play, Square, X } from 'lucide-react-native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, type GestureResponderEvent } from 'react-native';

import { haptic } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { Row, T } from './ui';

export type Recording = { uri: string; durationMs: number };

const CANCEL_DX = -90;
const TAP_MS = 350;
const BARS = 28;

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Waveform({ levels, color, height = 36 }: { levels: number[]; color: string; height?: number }) {
  const padded = [...Array(Math.max(0, BARS - levels.length)).fill(0.05), ...levels.slice(-BARS)];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height, flex: 1 }}>
      {padded.map((l, i) => (
        <View key={i} style={{ flex: 1, maxWidth: 5, height: Math.max(4, l * height), borderRadius: 3, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function VoiceRecorder({
  maxMs,
  onDone,
  hint = 'Hold to record',
  testID,
}: {
  maxMs: number;
  onDone: (r: Recording) => void;
  hint?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const { ensurePermission, toast } = useFeedback();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const [mode, setMode] = useState<'idle' | 'holding' | 'locked'>('idle');
  const [cancelArmed, setCancelArmed] = useState(false);
  const [live, setLive] = useState<{ ms: number; levels: number[] }>({ ms: 0, levels: [] });
  const startedAt = useRef(0);
  const touch = useRef({ x: 0, t: 0, armed: false });
  const starting = useRef<Promise<boolean> | null>(null);

  async function begin(): Promise<boolean> {
    const ok = await ensurePermission('microphone');
    if (!ok) return false;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setLive({ ms: 0, levels: [] });
      haptic.soft();
      return true;
    } catch {
      toast('The microphone isn\u2019t available right now. Let\u2019s try again in a moment.');
      return false;
    }
  }

  async function finish(cancel: boolean) {
    const started = await starting.current;
    starting.current = null;
    setMode('idle');
    setCancelArmed(false);
    if (!started) return;
    const durationMs = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (cancel) {
      haptic.tap();
      return;
    }
    const uri = recorder.uri;
    if (uri && durationMs > 600) {
      haptic.success();
      onDone({ uri, durationMs: Math.min(durationMs, maxMs) });
    }
  }

  const reachedLimit = useEffectEvent(() => void finish(false));

  // While recording: sample duration and level (dB, roughly -60..0) for the
  // waveform, and stop gently at the limit.
  const active = mode !== 'idle';
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const s = recorder.getStatus();
      if (!s.isRecording) return;
      const level = Math.min(1, Math.max(0.05, ((s.metering ?? -60) + 60) / 60));
      setLive((prev) => ({ ms: s.durationMillis, levels: [...prev.levels.slice(-(BARS - 1)), level] }));
      if (s.durationMillis >= maxMs) reachedLimit();
    }, 100);
    return () => clearInterval(id);
  }, [active, recorder, maxMs]);

  // Plain responder props (re-created each render, so they always see fresh state).
  const holdHandlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      touch.current = { x: e.nativeEvent.pageX, t: Date.now(), armed: false };
      setMode('holding');
      starting.current = begin();
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const armed = e.nativeEvent.pageX - touch.current.x < CANCEL_DX;
      if (armed !== touch.current.armed) {
        touch.current.armed = armed;
        setCancelArmed(armed);
        if (armed) haptic.tap();
      }
    },
    onResponderRelease: () => {
      if (Date.now() - touch.current.t < TAP_MS && !touch.current.armed) {
        setMode('locked'); // a quick tap keeps recording until Stop
        return;
      }
      void finish(touch.current.armed);
    },
    onResponderTerminate: () => void finish(true),
  };

  const remaining = Math.max(0, maxMs - live.ms);

  return (
    <View style={{ gap: space.sm }}>
      <Row
        style={{
          minHeight: 72,
          borderRadius: radius.pill,
          backgroundColor: active ? (cancelArmed ? c.surfaceAlt : c.primarySoft) : c.surfaceAlt,
          paddingLeft: space.lg,
          paddingRight: 6,
        }}>
        <View style={{ flex: 1 }}>
          {active ? (
            <Row>
              <T variant="bodyStrong" color={c.primary} style={{ minWidth: 44 }}>
                {fmt(live.ms)}
              </T>
              <Waveform levels={live.levels} color={cancelArmed ? c.textMuted : c.primary} />
            </Row>
          ) : (
            <T muted>{hint}</T>
          )}
        </View>
        {mode === 'locked' ? (
          <Row gap={space.sm}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
              onPress={() => void finish(true)}
              style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
              <X color={c.text} size={22} />
            </Pressable>
            <Pressable
              testID={testID ? `${testID}-stop` : undefined}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              onPress={() => void finish(false)}
              style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary }}>
              <Square color={c.onPrimary} size={20} fill={c.onPrimary} />
            </Pressable>
          </Row>
        ) : (
          <View
            testID={testID}
            {...holdHandlers}
            accessible
            accessibilityRole="button"
            accessibilityLabel={active ? 'Recording. Release to send, slide left to cancel' : 'Record a voice note'}
            accessibilityHint="Hold to record, or tap once to start and tap stop when done"
            accessibilityActions={[{ name: 'activate', label: 'Start recording' }]}
            onAccessibilityAction={() => {
              setMode('locked');
              starting.current = begin();
            }}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primary,
              transform: [{ scale: mode === 'holding' ? 1.12 : 1 }],
              ...(Platform.OS === 'web' ? ({ cursor: 'pointer', userSelect: 'none', touchAction: 'none' } as object) : null),
            }}>
            <Mic color={c.onPrimary} size={26} />
          </View>
        )}
      </Row>
      <T variant="small" muted center accessibilityLiveRegion="polite">
        {mode === 'holding'
          ? cancelArmed
            ? 'Release to let it go'
            : '← Slide left to cancel'
          : mode === 'locked'
            ? `Recording, up to ${fmt(remaining)} left`
            : `Up to ${fmt(maxMs)}. Tap once if you’d rather not hold.`}
      </T>
    </View>
  );
}

const SPEEDS = [1, 1.5, 2] as const;

export function VoicePlayer({
  uri,
  durationMs,
  hug,
  tone = 'surface',
  testID,
}: {
  uri: string;
  durationMs?: number;
  hug?: boolean;
  tone?: 'surface' | 'onPrimary';
  testID?: string;
}) {
  const { c } = useTheme();
  const player = useAudioPlayer(uri, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [pulse] = useState(() => new Animated.Value(1));

  const total = (status.duration || (durationMs ?? 0) / 1000) * 1000;
  const pos = status.currentTime * 1000;
  const progress = total ? Math.min(1, pos / total) : 0;
  const fg = tone === 'onPrimary' ? c.onPrimary : c.primary;
  const track = tone === 'onPrimary' ? 'rgba(255,255,255,0.35)' : c.ringTrack;

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0).catch(() => {});
      player.pause();
    }
  }, [status.didJustFinish, player]);

  useEffect(() => {
    if (!hug || !status.playing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hug, status.playing, pulse]);

  return (
    <Row gap={space.md} style={{ minHeight: 52 }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : hug ? 'Play voice hug' : 'Play voice note'}
        onPress={() => {
          haptic.tap();
          if (status.playing) player.pause();
          else {
            player.setPlaybackRate(speed);
            player.play();
          }
        }}
        style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'onPrimary' ? 'rgba(255,255,255,0.22)' : c.primarySoft }}>
        {hug ? (
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Heart color={fg} fill={status.playing ? fg : 'transparent'} size={22} />
          </Animated.View>
        ) : status.playing ? (
          <Pause color={fg} size={22} fill={fg} />
        ) : (
          <Play color={fg} size={22} fill={fg} />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: fg }} />
        </View>
        <T variant="small" color={tone === 'onPrimary' ? c.onPrimary : c.textMuted}>
          {fmt(status.playing || pos > 0 ? pos : total)}
          {hug ? '  ·  voice hug' : ''}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${speed} times. Tap to change`}
        onPress={() => {
          const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
          setSpeed(next);
          player.setPlaybackRate(next);
        }}
        style={{ minWidth: 48, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm }}>
        <T variant="label" color={fg}>
          {speed}×
        </T>
      </Pressable>
    </Row>
  );
}
