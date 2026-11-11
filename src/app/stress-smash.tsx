/**
 * Stress Smash: type who's bugging you, press LET IT OUT, and watch a cute
 * cartoon friend bonk a squeaky toy dummy with their name on it.
 *
 * Silly, never violent: a toy hammer, a bouncy bop-bag dummy, stars and
 * "BONK!". The name stays on this screen only. It isn't saved, sent or shown
 * to your partner. Respects "Reduce motion" (and Look & feel → Animations: Off)
 * with a calm, still version.
 */
import { router } from 'expo-router';
import { ArrowLeft, Hammer, Lock, RotateCcw, UserRoundPen, Volume2, VolumeX } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from 'react-native-svg';

import { Card, Gap, IconButton, Row, Screen, T, focusRing, useInputStyle } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { BONK_WORDS, BONUS_WORDS, HITS, NAME_MAX, cheerFor, nameSize, stressAfter, targetName } from '@/lib/smash-pure';
import { sfx } from '@/lib/smash-sounds';
import { radius, space, useTheme } from '@/theme';

const ND = Platform.OS !== 'web';
const MUTE_KEY = 'kita.smashMuted';

// The little stage is drawn at 340×280 and scaled to fit the screen.
const SCENE_W = 340;
const SCENE_H = 280;
const PIVOT = { x: 140, y: 192 }; // the hand holding the hammer
const ARM = 140; // hand → middle of the hammer head
const HS = 190; // half the hammer layer (it turns around its middle: the hand)
const DUMMY = { left: 196, top: 100, w: 120, h: 140 };
const IMPACT = { x: 258, y: 104 };

// Hammer angles (degrees; 0 = straight up, positive = towards the dummy).
const REST = -18;
const WINDUP = -62;
const WINDUP_BIG = -92;
const STRIKE = 50;

// Cartoon colours that stay bright in light and dark mode.
const INK = '#24304A';
const SKIN = '#F9D2B5';
const HERO_INK = '#4A2C22';
const HAIR = '#3B2A2A';
const SHIRT = '#F08BA0';
const PANTS = '#3E4C7A';
const FEET = { x: 92, y: 258 }; // she leans from her feet
const LW = 240; // half the lean layer (it turns around its middle: her feet)
const LH = 280;
const DUMMY_FILL = '#8FCBEA';
const DUMMY_BELLY = '#C9E8F8';
const TOY_RED = '#E5566B';
const TOY_YELLOW = '#FFCB4C';

type Phase = 'ready' | 'smashing' | 'done';
type Face = 'happy' | 'squish' | 'dizzy';
type Mood = 'ready' | 'fierce' | 'proud';

const play = (a: Animated.CompositeAnimation) => new Promise<void>((done) => a.start(() => done()));
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
function saveMuted(on: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    // Private mode: it just resets next time.
  }
}

// Stars and confetti that fly out on each bonk (angle in degrees, distance in px).
const STARS = [
  { a: 195, d: 70, s: 18 },
  { a: 238, d: 82, s: 22 },
  { a: 272, d: 66, s: 16 },
  { a: 308, d: 86, s: 22 },
  { a: 345, d: 66, s: 18 },
  { a: 18, d: 52, s: 14 },
];
const DOTS = [
  { a: 210, d: 54, r: 4, c: TOY_RED },
  { a: 250, d: 100, r: 5, c: '#B8A4E3' },
  { a: 290, d: 96, r: 4, c: TOY_YELLOW },
  { a: 325, d: 58, r: 5, c: '#FFFFFF' },
  { a: 0, d: 84, r: 4, c: TOY_RED },
  { a: 160, d: 80, r: 5, c: '#FFFFFF' },
  { a: 228, d: 120, r: 3, c: TOY_YELLOW },
  { a: 300, d: 128, r: 3, c: '#8FE3B8' },
];
const STAR_PATH = 'M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z';

/** The spiky comic-book bubble behind "BONK!". */
const BURST_POINTS = Array.from({ length: 28 }, (_, i) => {
  const t = (i / 28) * Math.PI * 2;
  const out = i % 2 === 0;
  const rx = out ? 84 : 62;
  const ry = out ? 44 : 31;
  return `${(88 + rx * Math.cos(t)).toFixed(1)},${(47 + ry * Math.sin(t)).toFixed(1)}`;
}).join(' ');

const ORBIT = Array.from({ length: 13 }, (_, i) => i / 12);
function orbit(v: Animated.Value, phase: number, rx: number, ry: number) {
  return [
    { translateX: v.interpolate({ inputRange: ORBIT, outputRange: ORBIT.map((p) => rx * Math.cos(2 * Math.PI * (p + phase))) }) },
    { translateY: v.interpolate({ inputRange: ORBIT, outputRange: ORBIT.map((p) => ry * Math.sin(2 * Math.PI * (p + phase))) }) },
  ];
}

export default function StressSmash() {
  const { c, look, motion } = useTheme();
  const inputStyle = useInputStyle();
  const reduced = motion === 'off';

  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [word, setWord] = useState('BONK!');
  const [face, setFace] = useState<Face>('happy');
  const [muted, setMuted] = useState(readMuted);
  const [stageW, setStageW] = useState(0);

  const runRef = useRef(0);
  const busyRef = useRef(false);
  const bonusRef = useRef(0);
  const mutedRef = useRef(muted);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [swing] = useState(() => new Animated.Value(REST));
  const [squash] = useState(() => new Animated.Value(0));
  const [wobble] = useState(() => new Animated.Value(0));
  const [sway] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [wordV] = useState(() => new Animated.Value(1));
  const [dizzy] = useState(() => new Animated.Value(0));
  const [hop] = useState(() => new Animated.Value(0));
  const [stress] = useState(() => new Animated.Value(100)); // drives a width, so never on the native driver

  const target = targetName(name);

  // Stop everything when leaving the page.
  useEffect(
    () => () => {
      runRef.current += 1;
    },
    [],
  );

  // While waiting, the dummy sways cheekily.
  useEffect(() => {
    if (phase !== 'ready' || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 3, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
        Animated.timing(sway, { toValue: -3, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      sway.setValue(0);
    };
  }, [phase, reduced, sway]);

  // Afterwards, little stars circle its head.
  useEffect(() => {
    if (phase !== 'done' || reduced) return;
    const loop = Animated.loop(Animated.timing(dizzy, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: ND }));
    loop.start();
    return () => loop.stop();
  }, [phase, reduced, dizzy]);

  const sound = (f: () => void) => {
    if (!mutedRef.current) f();
  };

  /** One bonk. `stressTo` moves the meter (null for bonus bonks). */
  async function hit(text: string, big: boolean, id: number, stressTo: number | null) {
    const live = () => runRef.current === id;
    if (reduced) {
      // Still version: the hammer rests on the dummy, the word fades in and out. Nothing moves.
      swing.setValue(STRIKE);
      setWord(text);
      setFace('squish');
      sound(() => sfx.bonk(big));
      haptic.soft();
      if (stressTo !== null) stress.setValue(stressTo);
      wordV.setValue(0);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 800, useNativeDriver: ND }).start();
      await play(Animated.timing(wordV, { toValue: 1, duration: big ? 1200 : 850, easing: Easing.linear, useNativeDriver: ND }));
      if (live()) setFace('happy');
      return;
    }

    await play(Animated.timing(swing, { toValue: big ? WINDUP_BIG : WINDUP, duration: big ? 420 : 210, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
    if (!live()) return;
    sound(sfx.whoosh);
    await play(Animated.timing(swing, { toValue: STRIKE, duration: big ? 110 : 90, easing: Easing.in(Easing.cubic), useNativeDriver: ND }));
    if (!live()) return;

    // Impact!
    sound(() => sfx.bonk(big));
    if (big) setTimeout(() => sound(sfx.boing), 110);
    haptic.soft();
    setWord(text);
    setFace('squish');
    squash.setValue(big ? 1.15 : 1);
    wobble.setValue(0);
    wordV.setValue(0);
    burst.setValue(0);
    const amp = (big ? 1.8 : 1) * (motion === 'lively' ? 9 : 6);
    Animated.parallel([
      Animated.spring(squash, { toValue: 0, friction: 3.2, tension: 160, useNativeDriver: ND }),
      Animated.sequence([
        Animated.timing(wobble, { toValue: big ? 16 : 9, duration: 80, useNativeDriver: ND }),
        Animated.spring(wobble, { toValue: 0, friction: 2.6, tension: 110, useNativeDriver: ND }),
      ]),
      Animated.timing(wordV, { toValue: 1, duration: big ? 1150 : 760, easing: Easing.linear, useNativeDriver: ND }),
      Animated.timing(burst, { toValue: 1, duration: big ? 850 : 600, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.sequence([amp, -amp, amp * 0.6, -amp * 0.35, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 40, useNativeDriver: ND }))),
    ]).start();
    if (stressTo !== null) Animated.timing(stress, { toValue: stressTo, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

    await play(Animated.timing(swing, { toValue: STRIKE - 28, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
    await wait(big ? 650 : 110);
    if (live()) setFace('happy');
  }

  function restHammer() {
    if (reduced) swing.setValue(REST);
    else Animated.timing(swing, { toValue: REST, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }).start();
  }

  async function smash() {
    if (phase === 'smashing') return;
    Keyboard.dismiss();
    const id = ++runRef.current;
    sfx.unlock();
    setPhase('smashing');
    setFace('happy');
    stress.setValue(100);
    for (let i = 0; i < HITS; i++) {
      await hit(BONK_WORDS[i], i === HITS - 1, id, stressAfter(i + 1));
      if (runRef.current !== id) return;
    }
    restHammer();
    setFace('dizzy');
    setRound((r) => r + 1);
    setPhase('done');
    if (!reduced)
      Animated.sequence([
        Animated.timing(hop, { toValue: -16, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
        Animated.spring(hop, { toValue: 0, friction: 4, tension: 140, useNativeDriver: ND }),
      ]).start();
    sound(sfx.tada);
    haptic.success();
  }

  /** Tap the dummy for one more, any time it isn't already being bonked. */
  async function bonus() {
    if (phase === 'smashing' || busyRef.current) return;
    busyRef.current = true;
    sfx.unlock();
    const id = runRef.current;
    const n = bonusRef.current++;
    await hit(BONUS_WORDS[n % BONUS_WORDS.length], false, id, null);
    if (runRef.current === id) {
      restHammer();
      setFace(phase === 'done' ? 'dizzy' : 'happy');
    }
    busyRef.current = false;
  }

  function someoneElse() {
    runRef.current += 1;
    setName('');
    setPhase('ready');
    setFace('happy');
    stress.setValue(100);
    swing.setValue(REST);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function toggleMute() {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    saveMuted(next);
  }

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/together');
  }

  const scale = stageW ? Math.min(1.45, stageW / SCENE_W) : 1;
  const stageH = Math.round(SCENE_H * scale);
  const DEG = { inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] };

  const wordOpacity = wordV.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const wordScale = reduced ? 1 : wordV.interpolate({ inputRange: [0, 0.18, 0.32, 1], outputRange: [0.3, 1.25, 1, 1.06] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Screen>
      {/* Header: back, title, sound */}
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
        <IconButton testID="smash-back" icon={ArrowLeft} label="Back" onPress={back} />
        <T variant="title" accessibilityRole="header">
          Stress Smash
        </T>
        {Platform.OS === 'web' ? (
          <IconButton testID="smash-mute" icon={muted ? VolumeX : Volume2} label={muted ? 'Sound off. Tap to turn on' : 'Sound on. Tap to mute'} active={muted} onPress={toggleMute} />
        ) : (
          <View style={{ width: 48 }} />
        )}
      </Row>

      <T variant="display" style={{ fontSize: 26, lineHeight: 32 }}>
        Who’s stressing you out today?
      </T>
      <Gap h={space.md} />
      <TextInput
        ref={inputRef}
        testID="smash-name"
        value={name}
        onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
        placeholder="Type a name… or leave it to Mr. Stress"
        placeholderTextColor={c.textMuted}
        maxLength={NAME_MAX}
        autoCorrect={false}
        autoComplete="off"
        autoCapitalize="words"
        returnKeyType="go"
        onSubmitEditing={smash}
        editable={phase !== 'smashing'}
        accessibilityLabel="Who’s stressing you out today?"
        style={inputStyle}
      />
      <Row gap={6} style={{ marginTop: space.xs }}>
        <Lock color={c.textMuted} size={13} />
        <T variant="small" muted style={{ flex: 1 }}>
          Just for this moment. The name isn’t saved or shared, not even with your partner.
        </T>
      </Row>

      <Gap h={space.lg} />

      {/* Stress meter */}
      <Row gap={space.sm} accessible accessibilityLabel={`Stress meter: ${phase === 'done' ? 'all gone' : phase === 'smashing' ? 'going down' : 'full'}`}>
        <T variant="small" muted>
          Stress
        </T>
        <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: c.surfaceAlt, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          <Animated.View
            testID="smash-meter"
            style={{
              height: '100%',
              borderRadius: 7,
              width: stress.interpolate({ inputRange: [0, 100], outputRange: ['3%', '100%'] }),
              backgroundColor: stress.interpolate({ inputRange: [0, 50, 100], outputRange: ['#4DB37E', '#F2B53A', TOY_RED] }),
            }}
          />
        </View>
        <Text style={{ fontSize: 20 }}>{phase === 'done' ? '😌' : phase === 'smashing' ? '😤' : '😣'}</Text>
      </Row>
      <Gap h={space.sm} />

      {/* The stage */}
      <View
        testID="smash-stage"
        onLayout={(e: LayoutChangeEvent) => setStageW(e.nativeEvent.layout.width)}
        style={{ height: stageH, borderRadius: look.name === 'professional' ? 12 : radius.lg, backgroundColor: c.primarySoft, overflow: 'hidden', borderWidth: look.outlined ? 2 : 0, borderColor: c.text }}>
        {stageW ? (
          <Animated.View
            style={{
              position: 'absolute',
              width: SCENE_W,
              height: SCENE_H,
              left: (stageW - SCENE_W) / 2,
              top: (stageH - SCENE_H) / 2,
              transform: [{ scale }, { translateX: shake }, { translateY: Animated.multiply(shake, 0.4) }],
            }}>
            <Backdrop c={c} />
            <SpringBase />

            {/* The dummy: squashes and wobbles from its feet (its layer's middle). */}
            <Animated.View
              style={{
                position: 'absolute',
                left: DUMMY.left,
                top: DUMMY.top - DUMMY.h,
                width: DUMMY.w,
                height: DUMMY.h * 2,
                pointerEvents: 'box-none',
                transform: [
                  { rotate: Animated.add(wobble, sway).interpolate(DEG) },
                  { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) },
                  { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }) },
                ],
              }}>
              <Pressable
                testID="smash-dummy"
                accessibilityRole="button"
                accessibilityLabel={`Bonus bonk for ${target}`}
                onPress={bonus}
                style={{ position: 'absolute', left: 0, top: DUMMY.h, width: DUMMY.w, height: DUMMY.h }}>
                <DummyArt face={face} />
                <View
                  style={{
                    position: 'absolute',
                    left: 14,
                    right: 14,
                    top: 84,
                    minHeight: 32,
                    paddingHorizontal: 4,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: '#FFF3B0',
                    borderWidth: 2,
                    borderColor: INK,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ rotate: '-5deg' }],
                  }}>
                  <Text testID="smash-target" numberOfLines={2} style={{ fontFamily: 'Raleway_700Bold', fontSize: nameSize(target), lineHeight: nameSize(target) + 3, color: '#3A2F12', textAlign: 'center' }}>
                    {target}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Our girl: she leans back to wind up and forward into each bonk (from her feet). */}
            <Animated.View
              style={{
                position: 'absolute',
                left: FEET.x - LW,
                top: FEET.y - LH,
                width: LW * 2,
                height: LH * 2,
                pointerEvents: 'none',
                transform: [
                  { translateY: hop },
                  { rotate: swing.interpolate({ inputRange: [WINDUP_BIG, WINDUP, REST, STRIKE], outputRange: ['-8deg', '-6deg', '0deg', '7deg'], extrapolate: 'clamp' }) },
                ],
              }}>
              <View style={{ position: 'absolute', left: LW - FEET.x, top: LH - FEET.y, width: SCENE_W, height: SCENE_H }}>
                {/* The toy hammer turns around her hand, behind her as she winds up. */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: PIVOT.x - HS,
                    top: PIVOT.y - HS,
                    width: HS * 2,
                    height: HS * 2,
                    transform: [{ rotate: swing.interpolate(DEG) }],
                  }}>
                  <HammerArt />
                </Animated.View>
                <GirlArt mood={phase === 'smashing' ? 'fierce' : phase === 'done' ? 'proud' : 'ready'} />
                <View style={{ position: 'absolute', left: PIVOT.x - 9, top: PIVOT.y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: SKIN, borderWidth: 2.5, borderColor: HERO_INK }} />
              </View>
            </Animated.View>

            {/* Stars and confetti */}
            {STARS.map((s, i) => {
              const dx = s.d * Math.cos((s.a * Math.PI) / 180);
              const dy = s.d * Math.sin((s.a * Math.PI) / 180);
              return (
                <Animated.View
                  key={`s${i}`}
                  style={{
                    position: 'absolute',
                    left: IMPACT.x - s.s / 2,
                    top: IMPACT.y - s.s / 2,
                    width: s.s,
                    height: s.s,
                    pointerEvents: 'none',
                    opacity: burstOpacity,
                    transform: reduced
                      ? [{ translateX: dx * 0.8 }, { translateY: dy * 0.8 }]
                      : [
                          { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                          { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                          { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? -160 : 160}deg`] }) },
                        ],
                  }}>
                  <Svg width={s.s} height={s.s} viewBox="0 0 24 24">
                    <Path d={STAR_PATH} fill={TOY_YELLOW} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                  </Svg>
                </Animated.View>
              );
            })}
            {reduced
              ? null
              : DOTS.map((d, i) => {
                  const dx = d.d * Math.cos((d.a * Math.PI) / 180);
                  const dy = d.d * Math.sin((d.a * Math.PI) / 180);
                  return (
                    <Animated.View
                      key={`d${i}`}
                      style={{
                        position: 'absolute',
                        left: IMPACT.x - d.r,
                        top: IMPACT.y - d.r,
                        width: d.r * 2,
                        height: d.r * 2,
                        borderRadius: d.r,
                        backgroundColor: d.c,
                        borderWidth: 1,
                        borderColor: 'rgba(36,48,74,0.35)',
                        pointerEvents: 'none',
                        opacity: burstOpacity,
                        transform: [
                          { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                          { translateY: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, dy * 0.85, dy + 26] }) },
                        ],
                      }}
                    />
                  );
                })}

            {/* BONK! */}
            <Animated.View
              testID="smash-word"
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                width: 176,
                height: 94,
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: phase === 'ready' ? 0 : wordOpacity,
                transform: [{ rotate: '-8deg' }, { scale: wordScale }],
              }}>
              <Svg width={176} height={94} viewBox="0 0 176 94" style={{ position: 'absolute' }}>
                <Polygon points={BURST_POINTS} fill="#FFFFFF" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
              </Svg>
              <Text
                style={{
                  fontFamily: 'Raleway_700Bold',
                  fontSize: word.length > 6 ? 22 : 30,
                  color: TOY_RED,
                  letterSpacing: 1,
                  textShadowColor: INK,
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 0,
                }}>
                {word}
              </Text>
            </Animated.View>

            {/* Dizzy stars */}
            {phase === 'done' ? (
              <View style={{ position: 'absolute', left: DUMMY.left + DUMMY.w / 2, top: DUMMY.top - 4, width: 0, height: 0, pointerEvents: 'none' }}>
                {[0, 1 / 3, 2 / 3].map((p) => (
                  <Animated.View
                    key={p}
                    style={{
                      position: 'absolute',
                      left: -8,
                      top: -8,
                      transform: reduced ? [{ translateX: 34 * Math.cos(2 * Math.PI * p) }, { translateY: 10 * Math.sin(2 * Math.PI * p) }] : orbit(dizzy, p, 34, 10),
                    }}>
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path d={STAR_PATH} fill={TOY_YELLOW} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                    </Svg>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
      <T variant="small" muted center style={{ marginTop: space.xs }}>
        Tip: tap the dummy for a bonus bonk.
      </T>

      <Gap h={space.lg} />

      {phase === 'done' ? (
        <Card tone="butter">
          <T testID="smash-cheer" variant="title" center accessibilityLiveRegion="polite" accessibilityRole="alert">
            {cheerFor(round - 1)}
          </T>
          <Gap h={space.md} />
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            <BigButton testID="smash-replay" label="Bonk again" icon={RotateCcw} onPress={smash} small />
            <BigButton testID="smash-someone-else" label="Someone else" icon={UserRoundPen} onPress={someoneElse} small soft />
          </Row>
        </Card>
      ) : (
        <BigButton testID="smash-go" label={phase === 'smashing' ? 'BONKING…' : 'LET IT OUT!'} icon={Hammer} onPress={smash} disabled={phase === 'smashing'} />
      )}
    </Screen>
  );
}

/** A big, squishy, playful button. */
function BigButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  small,
  soft,
  testID,
}: {
  label: string;
  icon: typeof Hammer;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  soft?: boolean;
  testID?: string;
}) {
  const { c, look, motion } = useTheme();
  const bg = soft ? c.surface : c.primary;
  const fg = soft ? c.primary : c.onPrimary;
  const depth = small ? 4 : 6;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => {
        const down = pressed && motion !== 'off';
        return [
          {
            flexGrow: 1,
            minHeight: small ? 52 : 68,
            paddingHorizontal: space.lg,
            borderRadius: look.name === 'professional' ? 12 : 999,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: soft ? 2 : 0,
            borderColor: c.primary,
            borderBottomWidth: down ? 2 : depth,
            borderBottomColor: soft ? c.primary : 'rgba(0,0,0,0.28)',
            marginTop: down ? depth - 2 : 0,
            opacity: disabled ? 0.75 : 1,
          },
          focusRing(focused && !disabled, c.primary),
        ];
      }}>
      <Row gap={10}>
        <Icon color={fg} size={small ? 20 : 26} strokeWidth={2.4} />
        <T color={fg} style={{ fontFamily: 'Raleway_700Bold', fontSize: small ? 17 : 23, lineHeight: small ? 22 : 28, letterSpacing: small ? 0.3 : 1.5 }}>
          {label}
        </T>
      </Row>
    </Pressable>
  );
}

// ------------------------------------------------------------------- drawings

function Backdrop({ c }: { c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <Svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={{ position: 'absolute' }}>
      <Ellipse cx={60} cy={44} rx={30} ry={13} fill={c.surface} opacity={0.75} />
      <Ellipse cx={82} cy={38} rx={20} ry={12} fill={c.surface} opacity={0.75} />
      <Ellipse cx={300} cy={150} rx={22} ry={10} fill={c.surface} opacity={0.6} />
      <Circle cx={170} cy={30} r={4} fill={c.heartSoft} />
      <Circle cx={24} cy={120} r={3} fill={c.butter} />
      <Circle cx={326} cy={60} r={3} fill={c.butter} />
      <Ellipse cx={170} cy={264} rx={168} ry={16} fill={c.surface} opacity={0.65} />
      <Ellipse cx={84} cy={258} rx={44} ry={6} fill={INK} opacity={0.12} />
      <Ellipse cx={256} cy={262} rx={42} ry={6} fill={INK} opacity={0.12} />
    </Svg>
  );
}

/** The bouncy spring the dummy stands on. */
function SpringBase() {
  return (
    <Svg width={80} height={30} viewBox="0 0 80 30" style={{ position: 'absolute', left: DUMMY.left + DUMMY.w / 2 - 40, top: DUMMY.top + DUMMY.h - 6 }}>
      <Path d="M40 2 l-12 4 l24 4 l-24 4 l24 4 l-12 4" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Ellipse cx={40} cy={25} rx={32} ry={5} fill="#7E8CA3" stroke={INK} strokeWidth={2.5} />
    </Svg>
  );
}

/** A round, squeaky bop-bag dummy with a goofy face. */
function DummyArt({ face }: { face: Face }) {
  return (
    <Svg width={DUMMY.w} height={DUMMY.h} viewBox={`0 0 ${DUMMY.w} ${DUMMY.h}`}>
      <Path
        d="M60 6 C90 6 102 34 100 62 C98 88 114 104 108 122 C102 138 18 138 12 122 C6 104 22 88 20 62 C18 34 30 6 60 6 Z"
        fill={DUMMY_FILL}
        stroke={INK}
        strokeWidth={3}
      />
      <Ellipse cx={60} cy={108} rx={38} ry={22} fill={DUMMY_BELLY} />
      <Path d="M40 16 C46 11 54 10 60 10" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.7} fill="none" />
      <Circle cx={33} cy={60} r={6} fill="#F7A8B8" opacity={0.85} />
      <Circle cx={87} cy={60} r={6} fill="#F7A8B8" opacity={0.85} />
      {face === 'happy' ? (
        <>
          <Circle cx={45} cy={42} r={11} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
          <Circle cx={75} cy={42} r={11} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
          <Circle cx={48} cy={45} r={5} fill={INK} />
          <Circle cx={72} cy={38} r={5} fill={INK} />
          <Path d="M46 63 Q60 76 74 63" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M58 69 Q62 78 67 68" fill="#F27B92" stroke={INK} strokeWidth={2} />
        </>
      ) : face === 'squish' ? (
        <>
          <Path d="M36 36 L50 43 L36 50" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M84 36 L70 43 L84 50" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Ellipse cx={60} cy={67} rx={8} ry={9} fill={INK} />
          <Ellipse cx={60} cy={71} rx={5} ry={4} fill="#F27B92" />
        </>
      ) : (
        <>
          <Path d="M45 42 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M75 42 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M44 66 q4 -5 8 0 t8 0 t8 0 t8 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M62 67 Q64 78 70 70" fill="#F27B92" stroke={INK} strokeWidth={2} />
        </>
      )}
    </Svg>
  );
}

/** Our hero: a cheerful cartoon girl with a ponytail and a bow, ready to bonk. */
function GirlArt({ mood }: { mood: Mood }) {
  const line = { stroke: HERO_INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const };
  return (
    <Svg width={120} height={162} viewBox="0 0 120 162" style={{ position: 'absolute', left: PIVOT.x - 108, top: PIVOT.y - 94 }}>
      {/* ponytail, behind */}
      <Path d="M32 40 C8 46 6 84 20 100 C22 86 28 68 42 54 Z" fill={HAIR} {...line} />
      {/* legs and shoes */}
      <Rect x={46} y={126} width={11} height={24} rx={5} fill={PANTS} {...line} />
      <Rect x={63} y={126} width={11} height={24} rx={5} fill={PANTS} {...line} />
      <Ellipse cx={50} cy={152} rx={10} ry={6} fill="#FFFFFF" {...line} />
      <Ellipse cx={70} cy={152} rx={10} ry={6} fill="#FFFFFF" {...line} />
      {/* other hand on her hip */}
      <Path d="M46 104 Q30 112 36 124" stroke={HERO_INK} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M46 104 Q30 112 36 124" stroke={SKIN} strokeWidth={6} strokeLinecap="round" fill="none" />
      {/* neck and T-shirt with a little heart */}
      <Rect x={54} y={86} width={12} height={14} fill={SKIN} {...line} />
      <Path d="M42 100 Q60 93 78 100 L84 132 Q60 138 36 132 Z" fill={SHIRT} {...line} />
      <Path d="M60 122 C54 116 54 111 58 111 C59.5 111 60 112 60 113 C60 112 60.5 111 62 111 C66 111 66 116 60 122 Z" fill="#FFFFFF" />
      {/* head and hair */}
      <Circle cx={60} cy={60} r={32} fill={SKIN} {...line} />
      <Path d="M27 64 C24 34 44 22 62 23 C82 24 96 38 93 64 C88 54 80 46 70 44 C66 52 52 56 40 52 C36 56 30 60 27 64 Z" fill={HAIR} {...line} />
      <Path d="M28 58 C26 72 28 82 33 90 C35 80 35 70 35 60 Z" fill={HAIR} {...line} />
      <Path d="M92 58 C94 72 92 82 87 90 C85 80 85 70 85 60 Z" fill={HAIR} {...line} />
      <Path d="M32 38 L18 28 L20 48 Z" fill={TOY_RED} {...line} />
      <Path d="M32 38 L46 26 L46 46 Z" fill={TOY_RED} {...line} />
      <Circle cx={32} cy={38} r={5} fill={TOY_RED} {...line} />
      {/* face */}
      <Ellipse cx={42} cy={76} rx={5} ry={3.5} fill="#F7A8B8" opacity={0.85} />
      <Ellipse cx={78} cy={76} rx={5} ry={3.5} fill="#F7A8B8" opacity={0.85} />
      {mood === 'proud' ? (
        <>
          <Path d="M44 67 Q49 61 54 67" stroke={HERO_INK} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M66 67 Q71 61 76 67" stroke={HERO_INK} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M50 76 Q60 90 70 76 Z" fill={HERO_INK} {...line} />
          <Path d="M55 82 Q60 86 65 82" stroke="#F27B92" strokeWidth={3} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Path d={mood === 'fierce' ? 'M41 54 L55 60' : 'M42 56 L54 59'} stroke={HERO_INK} strokeWidth={3} strokeLinecap="round" />
          <Path d={mood === 'fierce' ? 'M79 54 L65 60' : 'M78 56 L66 59'} stroke={HERO_INK} strokeWidth={3} strokeLinecap="round" />
          <Ellipse cx={49} cy={67} rx={4} ry={5.5} fill={HERO_INK} />
          <Ellipse cx={71} cy={67} rx={4} ry={5.5} fill={HERO_INK} />
          <Circle cx={50.5} cy={65} r={1.6} fill="#FFFFFF" />
          <Circle cx={72.5} cy={65} r={1.6} fill="#FFFFFF" />
          {mood === 'fierce' ? (
            <>
              <Path d="M52 77 Q60 73 68 77 Q66 89 60 89 Q54 89 52 77 Z" fill={HERO_INK} {...line} />
              <Ellipse cx={60} cy={85} rx={4} ry={2.5} fill="#F27B92" />
            </>
          ) : (
            <Path d="M52 78 Q60 85 68 78" stroke={HERO_INK} strokeWidth={3} strokeLinecap="round" fill="none" />
          )}
        </>
      )}
      {/* the arm holding the hammer (her hand is drawn on top of the handle) */}
      <Path d="M76 104 Q92 104 106 95" stroke={HERO_INK} strokeWidth={12} strokeLinecap="round" fill="none" />
      <Path d="M76 104 Q92 104 106 95" stroke={SKIN} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Circle cx={77} cy={103} r={8} fill={SHIRT} {...line} />
    </Svg>
  );
}

/** A big squeaky toy hammer, drawn pointing straight up from the hand (the layer's middle). */
function HammerArt() {
  const top = HS - ARM; // middle of the head
  return (
    <Svg width={HS * 2} height={HS * 2} viewBox={`0 0 ${HS * 2} ${HS * 2}`}>
      <Rect x={HS - 7} y={top + 16} width={14} height={ARM + 10} rx={7} fill={TOY_YELLOW} stroke={INK} strokeWidth={3} />
      <Rect x={HS - 40} y={top - 24} width={80} height={48} rx={16} fill={TOY_RED} stroke={INK} strokeWidth={3} />
      <Rect x={HS - 46} y={top - 26} width={16} height={52} rx={7} fill={TOY_YELLOW} stroke={INK} strokeWidth={3} />
      <Rect x={HS + 30} y={top - 26} width={16} height={52} rx={7} fill={TOY_YELLOW} stroke={INK} strokeWidth={3} />
      <Path d={`M${HS - 24} ${top - 14} H${HS + 18}`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
    </Svg>
  );
}
