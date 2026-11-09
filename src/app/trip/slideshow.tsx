/**
 * Trip moments slideshow: photos with captions, gently cross-fading.
 * Respects Reduce Motion (no zoom), with pause and manual next/previous.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { friendlyDate } from '@/lib/dates';
import { useMedia, useMediaUrl } from '@/lib/media';
import { usePaired } from '@/lib/session';
import { useTrip, useTripEntries, type TripEntry } from '@/lib/trips';
import { space } from '@/theme';

const SLIDE_MS = 4500;

function Slide({ cid, entry, reduceMotion }: { cid: string; entry: TripEntry; reduceMotion: boolean }) {
  const media = useMedia(cid, entry.mediaId);
  const { url } = useMediaUrl(media ? media.storagePath : undefined);
  const [fade] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!url) return;
    const nd = Platform.OS !== 'web';
    Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: nd }).start();
    if (!reduceMotion) Animated.timing(zoom, { toValue: 1.06, duration: SLIDE_MS + 800, useNativeDriver: nd }).start();
  }, [url, fade, zoom, reduceMotion]);
  return (
    <Animated.View style={{ flex: 1, opacity: fade, transform: [{ scale: zoom }] }}>
      {url ? <Image source={{ uri: url }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={entry.caption || 'Trip photo'} /> : null}
    </Animated.View>
  );
}

export default function Slideshow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cid } = usePaired();
  const insets = useSafeAreaInsets();
  const trip = useTrip(cid, id);
  const { data: entries } = useTripEntries(cid, id);
  const photos = entries.filter((e) => e.type === 'photo' && e.mediaId);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const n = photos.length;
  const current = n ? photos[index % n] : null;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!playing || n < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => clearInterval(t);
  }, [playing, n]);

  const btn = { width: 48, height: 48, borderRadius: 24, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,0.14)' };

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0C12', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg }}>
        <T color="#fff" variant="heading">
          {trip?.title ?? ''}
        </T>
        <Pressable testID="slideshow-close" accessibilityRole="button" accessibilityLabel="Close slideshow" onPress={() => router.back()} style={btn}>
          <X color="#fff" size={22} />
        </Pressable>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {current ? <Slide key={current.id} cid={cid} entry={current} reduceMotion={reduceMotion} /> : <T color="#fff" center>No photos from this trip yet.</T>}
      </View>
      {current ? (
        <View style={{ padding: space.lg, gap: space.sm }}>
          {current.caption ? (
            <T testID="slide-caption" color="#fff" variant="title" center>
              {current.caption}
            </T>
          ) : null}
          <T color="#cfc8dc" center>
            {current.mood ? `${current.mood}  ` : ''}
            {friendlyDate(current.date)} · {(index % n) + 1} of {n}
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => setIndex((i) => (i - 1 + n) % n)} style={btn}>
              <ChevronLeft color="#fff" size={22} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause slideshow' : 'Play slideshow'} onPress={() => setPlaying((p) => !p)} style={btn}>
              {playing ? <Pause color="#fff" size={20} /> : <Play color="#fff" size={20} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => setIndex((i) => (i + 1) % n)} style={btn}>
              <ChevronRight color="#fff" size={22} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
