/**
 * The first-time welcome: four short pages before signing up. Swipe or tap
 * Next; Skip or "I have an account" go straight to the form. Shown once per
 * device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { CalendarHeart, CloudSun, Footprints, Lock, Plane, ShieldCheck, Smile, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { space, useTheme, type VividName } from '@/theme';

import { CoupleArt, PageWash } from './art';
import { KitaLogo } from './logo';
import { Button, Row, T } from './ui';
import { VividSquare } from './vivid';

const KEY = 'kita.welcomed';
const ND = Platform.OS !== 'web';

/** undefined while checking, then whether this device has seen the welcome. */
export function useWelcomed(): [boolean | undefined, () => void] {
  const [seen, setSeen] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true));
  }, []);
  return [
    seen,
    () => {
      setSeen(true);
      AsyncStorage.setItem(KEY, '1').catch(() => {});
    },
  ];
}

type Page = { title: string; line: string; art: 'couple' | [LucideIcon, VividName][] };

const PAGES: Page[] = [
  { title: 'Your little world for two', line: 'Love notes, hugs and a daily question, just between you and your partner.', art: 'couple' },
  {
    title: 'Look after yourselves',
    line: 'Steps, moods and meals. Private by default; you choose what your partner sees.',
    art: [
      [Footprints, 'green'],
      [Smile, 'amber'],
      [UtensilsCrossed, 'orange'],
    ],
  },
  {
    title: 'Plan life together',
    line: 'Trips and itineraries, date nights, special days, and the weather wherever you are.',
    art: [
      [Plane, 'blue'],
      [CalendarHeart, 'pink'],
      [CloudSun, 'teal'],
    ],
  },
  {
    title: 'Safe and private',
    line: 'No ads. Nothing sold. Your space stays yours, and you can delete it any time.',
    art: [
      [Lock, 'violet'],
      [ShieldCheck, 'green'],
    ],
  },
];

function Art({ art, active }: { art: Page['art']; active: boolean }) {
  const { motion } = useTheme();
  const [v] = useState(() => new Animated.Value(motion === 'off' ? 1 : 0));
  useEffect(() => {
    if (!active || motion === 'off') return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: ND }).start();
  }, [active, motion, v]);
  if (art === 'couple') {
    return (
      <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
        <CoupleArt size={200} />
      </Animated.View>
    );
  }
  return (
    <Row gap={space.md} style={{ height: 156, alignItems: 'center' }}>
      {art.map(([Icon, color], i) => (
        <Animated.View
          key={color}
          style={{
            opacity: v,
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18 + i * 8, i % 2 ? 14 : -6] }) },
              { rotate: `${(i - (art.length - 1) / 2) * 7}deg` },
            ],
          }}>
          <VividSquare color={color} size={84} radius={26}>
            <Icon color="#FFFFFF" size={38} strokeWidth={2.1} />
          </VividSquare>
        </Animated.View>
      ))}
    </Row>
  );
}

export function Welcome({ onDone }: { onDone: (mode: 'new' | 'returning') => void }) {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  const pageW = Math.min(width, 560);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [at, setAt] = useState(0);
  const [pageH, setPageH] = useState(0);
  // While we scroll to a page ourselves, don't let the in-between positions change the page.
  const target = useRef<number | null>(null);
  const last = at === PAGES.length - 1;

  const go = (i: number) => {
    haptic.tap();
    target.current = i;
    scroller.current?.scrollTo({ x: i * pageW, animated: true });
    setAt(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (target.current !== null) {
      if (Math.abs(e.nativeEvent.contentOffset.x - target.current * pageW) < 2) target.current = null;
      return;
    }
    if (i !== at && i >= 0 && i < PAGES.length) setAt(i);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <PageWash />
      <View style={{ width: pageW, alignSelf: 'center', flex: 1 }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md }}>
          <KitaLogo height={30} onDark={dark} />
          {last ? <View style={{ height: 40 }} /> : (
            <Pressable testID="welcome-skip" accessibilityRole="button" onPress={() => onDone('new')} hitSlop={10} style={{ minHeight: 40, justifyContent: 'center' }}>
              <T variant="bodyStrong" muted>
                Skip
              </T>
            </Pressable>
          )}
        </Row>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'stretch' }}>
          {PAGES.map((p, i) => (
            <View key={p.title} testID={`welcome-page-${i}`} style={{ width: pageW, height: pageH || undefined, paddingHorizontal: space.xl, justifyContent: 'center', alignItems: 'center', gap: space.xl }}>
              <View style={{ height: 180, justifyContent: 'center' }}>
                <Art art={p.art} active={i === at} />
              </View>
              <View style={{ gap: space.sm, maxWidth: 360 }}>
                <T variant="display" center accessibilityRole="header">
                  {p.title}
                </T>
                <T muted center style={{ fontSize: 17, lineHeight: 25 }}>
                  {p.line}
                </T>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md }}>
          <Row gap={6} style={{ justifyContent: 'center' }} accessible accessibilityLabel={`Page ${at + 1} of ${PAGES.length}`}>
            {PAGES.map((p, i) => (
              <Pressable key={p.title} accessibilityRole="button" accessibilityLabel={`Go to page ${i + 1}`} onPress={() => go(i)} hitSlop={6}>
                <View style={{ width: i === at ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === at ? c.text : c.border }} />
              </Pressable>
            ))}
          </Row>
          <Button testID={last ? 'welcome-start' : 'welcome-next'} label={last ? 'Get started' : 'Next'} onPress={() => (last ? onDone('new') : go(at + 1))} />
          <Pressable testID="welcome-have-account" accessibilityRole="button" onPress={() => onDone('returning')} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
            <T variant="bodyStrong" center>
              I already have an account
            </T>
          </Pressable>
          <T variant="small" muted center>
            By continuing you agree to our{' '}
            <T variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/terms')} accessibilityRole="link">
              Terms
            </T>{' '}
            and{' '}
            <T variant="small" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/privacy-policy')} accessibilityRole="link">
              Privacy policy
            </T>
            .
          </T>
        </View>
      </View>
    </SafeAreaView>
  );
}
