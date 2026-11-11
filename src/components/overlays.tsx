import { router } from 'expo-router';
import { Gift, Heart, KeyRound, Lock, ScanFace } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { useLock } from '@/lib/lock';
import { markRead, useMessages } from '@/lib/messages';
import { useSession } from '@/lib/session';
import { useDeliveredToMe } from '@/lib/together-data';
import { updateKindWordWidget } from '@/widgets/kind-word';
import { radius, space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { Button, Gap, Row, T } from './ui';

const nativeDriver = Platform.OS !== 'web';

/**
 * Watches for hugs and love notes that arrive while the app is open.
 * A hug plays a heartbeat haptic and a soft blooming heart.
 */
export function IncomingLove() {
  const { cid, uid, partnerName } = useSession();
  const { messages, ready } = useMessages(cid, 20);
  const { toast } = useFeedback();
  const { c } = useTheme();
  const seen = useRef<Set<string> | null>(null);
  const [hugVisible, setHugVisible] = useState(false);
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));

  // Keep the home screen widget showing the newest kind word to me.
  const latestWord = messages.find((m) => m.toUid === uid && (m.kind === 'text' || m.kind === 'quick') && m.text && !m.expiresAt);
  useEffect(() => {
    if (latestWord?.text) updateKindWordWidget({ from: partnerName, text: latestWord.text });
  }, [latestWord?.id, latestWord?.text, partnerName]);

  useEffect(() => {
    if (!cid || !uid || !ready) return;
    if (seen.current === null) {
      // First load: everything already here is "old news".
      seen.current = new Set(messages.map((m) => m.id));
      return;
    }
    const fresh = messages.filter((m) => !seen.current!.has(m.id));
    fresh.forEach((m) => seen.current!.add(m.id));
    const forMe = fresh.filter((m) => m.toUid === uid);
    if (!forMe.length) return;
    if (forMe.some((m) => m.kind === 'hug')) {
      haptic.hug();
      setHugVisible(true);
      forMe.filter((m) => m.kind === 'hug').forEach((m) => markRead(cid, m).catch(() => {}));
    } else {
      haptic.soft();
      toast(`Surat cinta daripada ${partnerName} ♥`);
    }
  }, [messages, ready, cid, uid, partnerName, toast]);

  useEffect(() => {
    if (!hugVisible) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: nativeDriver }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          Animated.timing(scale, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        ]),
        { iterations: 2 },
      ),
    ]).start();
    const t = setTimeout(() => setHugVisible(false), 4200);
    return () => clearTimeout(t);
  }, [hugVisible, scale, opacity]);

  if (!hugVisible) return null;
  return (
    <Pressable
      testID="hug-overlay"
      accessibilityRole="alert"
      accessibilityLabel={`${partnerName} sent you a hug`}
      onPress={() => setHugVisible(false)}
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.overlay }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }], opacity }}>
        <View style={[styles.heartCircle, { backgroundColor: c.heartSoft }]}>
          <Heart color={c.heart} fill={c.heart} size={72} />
        </View>
        <Gap h={space.lg} />
        <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: space.xl, paddingVertical: space.md }}>
          <T variant="title" center>
            {partnerName} sent you a hug
          </T>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const PIN_LENGTH = 4;

export function LockScreen() {
  const { c } = useTheme();
  const lock = useLock();
  const [pin, setPin] = useState('');
  const [hint, setHint] = useState('Enter your PIN');

  useEffect(() => {
    if (lock.locked && lock.settings.biometrics && lock.biometricsAvailable) {
      lock.unlockWithBiometrics().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.locked]);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    lock.unlockWithPin(pin).then((ok) => {
      if (ok) {
        haptic.success();
        setHint('Enter your PIN');
      } else {
        haptic.tap();
        setHint('That wasn’t quite it. Take your time.');
      }
      setPin('');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!lock.supported || !lock.locked) return null;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

  return (
    <Modal visible animationType="fade" onRequestClose={() => {}}>
      <View style={[styles.center, { flex: 1, backgroundColor: c.bg, padding: space.xl }]}>
        <View style={[styles.lockIcon, { backgroundColor: c.primarySoft }]}>
          <Lock color={c.primary} size={28} />
        </View>
        <T variant="title" center>
          Welcome back
        </T>
        <Gap h={space.xs} />
        <T muted center accessibilityLiveRegion="polite">
          {hint}
        </T>
        <Gap h={space.xl} />
        <Row gap={space.lg} style={{ justifyContent: 'center' }} accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < pin.length ? c.primary : c.ringTrack }} />
          ))}
        </Row>
        <Gap h={space.xxl} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'space-between', rowGap: space.lg }}>
          {keys.map((k) => {
            if (k === 'bio') {
              return lock.settings.biometrics && lock.biometricsAvailable ? (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel="Unlock with Face ID or fingerprint" onPress={() => lock.unlockWithBiometrics()} style={[styles.key]}>
                  <ScanFace color={c.primary} size={28} />
                </Pressable>
              ) : (
                <View key={k} style={styles.key} />
              );
            }
            if (k === 'del') {
              return (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel="Delete digit" onPress={() => setPin((p) => p.slice(0, -1))} style={styles.key}>
                  <T variant="bodyStrong" muted>
                    Delete
                  </T>
                </Pressable>
              );
            }
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={k}
                onPress={() => {
                  haptic.tap();
                  setPin((p) => (p.length < PIN_LENGTH ? p + k : p));
                }}
                style={({ pressed }) => [styles.key, { backgroundColor: pressed ? c.primarySoft : c.surfaceAlt }]}>
                <T variant="title">{k}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

/** Set a PIN: enter it twice. Used from Settings. */
export function PinSetup({ onDone, onCancel }: { onDone: (pin: string) => void; onCancel: () => void }) {
  const { c } = useTheme();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('Choose a 4-digit PIN');

  function press(k: string) {
    if (k === '<') return setPin((p) => p.slice(0, -1));
    const next = pin.length < PIN_LENGTH ? pin + k : pin;
    if (next.length < PIN_LENGTH) return setPin(next);
    setPin('');
    if (first === null) {
      setFirst(next);
      setNote('Once more, to be sure');
    } else if (next === first) {
      onDone(next);
    } else {
      setFirst(null);
      setNote('Those didn’t match. Let’s start again.');
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={[styles.lockIcon, { backgroundColor: c.primarySoft, marginBottom: 0 }]}>
        <KeyRound color={c.primary} size={26} />
      </View>
      <T variant="heading" center accessibilityLiveRegion="polite">
        {note}
      </T>
      <Row gap={space.lg}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < pin.length ? c.primary : c.ringTrack }} />
        ))}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'space-between', rowGap: space.md }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.keySmall} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === '<' ? 'Delete digit' : k}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.keySmall, { backgroundColor: pressed ? c.primarySoft : c.surfaceAlt }]}>
              <T variant="heading">{k === '<' ? '⌫' : k}</T>
            </Pressable>
          ),
        )}
      </View>
      <Button label="Cancel" kind="ghost" onPress={onCancel} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  heartCircle: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keySmall: { width: 72, height: 60, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

/**
 * "Next time you open the app" surprises: a gentle card when one is waiting.
 * Shown once per app session.
 */
export function SurpriseWatcher() {
  const { c } = useTheme();
  const { cid, uid, partnerName } = useSession();
  const delivered = useDeliveredToMe(cid, uid);
  const waiting = delivered.filter((n) => n.surprise !== 'none' && !n.openedAt);
  const [dismissed, setDismissed] = useState(false);
  const insets = useSafeAreaInsets();
  if (!waiting.length || dismissed) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <View
        testID="surprise-waiting"
        accessibilityLiveRegion="polite"
        style={{ margin: space.lg, marginBottom: insets.bottom + 88, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.border, gap: space.sm, boxShadow: '0px 8px 24px rgba(40, 20, 60, 0.18)' }}>
        <Row gap={space.sm}>
          <Gift color={c.heart} size={24} />
          <T variant="heading" style={{ flex: 1 }}>
            {partnerName} left you {waiting.length === 1 ? 'a surprise' : `${waiting.length} surprises`}
          </T>
        </Row>
        <Row gap={space.sm}>
          <Button
            testID="surprise-go"
            small
            label="Open Surat Cinta"
            style={{ flex: 1 }}
            onPress={() => {
              setDismissed(true);
              router.navigate('/(tabs)/notes');
            }}
          />
          <Button small kind="ghost" label="Later" onPress={() => setDismissed(true)} />
        </Row>
      </View>
    </View>
  );
}
