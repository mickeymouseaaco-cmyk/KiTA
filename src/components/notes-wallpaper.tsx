/**
 * The wallpaper behind your notes, and the sheet to choose it: a few soft
 * colours, little hearts, or your own photo. Only you see your choice.
 */
import { Image } from 'expo-image';
import { Check, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

import { useFeedback } from '@/components/feedback';
import { pickPhoto } from '@/lib/compose';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { usePaired, useSession } from '@/lib/session';
import { WALLPAPER_PRESETS, parseWallpaper, setPhotoWallpaper, setPresetWallpaper, useWallpaperUrl, type WallpaperPreset } from '@/lib/wallpaper';
import { radius, space, useTheme } from '@/theme';

import { Row, T } from './ui';

const HEART = 'M8 14s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 14 6c0 4.4-6 8-6 8z';

/** A preset painted as a soft gradient (and little hearts for that one). */
function PresetFill({ p, id }: { p: WallpaperPreset; id: string }) {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={p.from} />
          <Stop offset="1" stopColor={p.to} />
        </LinearGradient>
        {p.hearts ? (
          <Pattern id={`${id}-h`} width="56" height="56" patternUnits="userSpaceOnUse">
            <Path d={HEART} fill="#FF5C8D" opacity={0.13} />
            <Path d={HEART} fill="#FF5C8D" opacity={0.09} transform="translate(30 30) scale(0.75)" />
          </Pattern>
        ) : null}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-g)`} />
      {p.hearts ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-h)`} /> : null}
    </Svg>
  );
}

/** Fills its parent, behind the notes. Renders nothing when there's no wallpaper. */
export function WallpaperLayer() {
  const { c, dark } = useTheme();
  const { uid } = usePaired();
  const { profile } = useSession();
  const w = parseWallpaper(profile?.notesWallpaper);
  const url = useWallpaperUrl(uid, w);
  if (!w) return null;
  const night = w.kind === 'preset' && w.preset.id === 'night';
  return (
    <View testID="notes-wallpaper" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {w.kind === 'preset' ? <PresetFill p={w.preset} id="wp-bg" /> : url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={250} /> : null}
      {/* A light veil keeps the notes easy to read on any picture, and calms bright colours in dark mode. */}
      {w.kind === 'photo' ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, opacity: dark ? 0.35 : 0.2 }} /> : null}
      {w.kind === 'preset' && dark && !night ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, opacity: 0.7 }} /> : null}
    </View>
  );
}

function Swatch({ label, selected, onPress, testID, children }: { label: string; selected: boolean; onPress: () => void; testID: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={{ width: '30%', gap: 6, alignItems: 'center' }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 0.72,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? c.primary : c.border,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
        {selected ? (
          <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Check color={c.onPrimary} size={14} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <T variant="small" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** The chooser, shown inside a Sheet. */
export function WallpaperPicker({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const { uid } = usePaired();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const current = profile?.notesWallpaper ?? null;
  const w = parseWallpaper(current);
  const photoUrl = useWallpaperUrl(uid, w);
  const [busy, setBusy] = useState(false);

  async function choosePreset(id: string | null) {
    haptic.tap();
    try {
      await setPresetWallpaper(uid, id, current);
      onDone();
    } catch {
      toast(gentleError.save);
    }
  }

  async function choosePhoto() {
    const photo = await pickPhoto('library').catch(() => null);
    if (!photo) return;
    setBusy(true);
    try {
      await setPhotoWallpaper(uid, photo, current);
      haptic.success();
      onDone();
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID="wallpaper-picker" style={{ gap: space.md }}>
      <View>
        <T variant="title">Notes wallpaper</T>
        <T variant="small" muted>
          Only you see this. It doesn’t change your partner’s screen.
        </T>
      </View>
      <Row gap={space.md} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Swatch testID="wallpaper-photo" label={w?.kind === 'photo' ? 'Your photo' : 'Choose photo'} selected={w?.kind === 'photo'} onPress={choosePhoto}>
          {photoUrl ? <Image source={{ uri: photoUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : null}
          {busy ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: photoUrl ? 'rgba(0,0,0,0.35)' : c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ImagePlus color={photoUrl ? '#FFFFFF' : c.primary} size={20} />
            </View>
          )}
        </Swatch>
        {WALLPAPER_PRESETS.map((p) => (
          <Swatch key={p.id} testID={`wallpaper-${p.id}`} label={p.label} selected={w?.kind === 'preset' && w.preset.id === p.id} onPress={() => choosePreset(p.id)}>
            <PresetFill p={p} id={`wp-${p.id}`} />
            {/* Two tiny bubbles so you can picture the notes on it. */}
            <View style={{ position: 'absolute', left: 8, right: 8, bottom: 10, gap: 4 }}>
              <View style={{ alignSelf: 'flex-start', width: '62%', height: 10, borderRadius: 5, backgroundColor: c.surface }} />
              <View style={{ alignSelf: 'flex-end', width: '50%', height: 10, borderRadius: 5, backgroundColor: c.primary }} />
            </View>
          </Swatch>
        ))}
        <Swatch testID="wallpaper-none" label="None" selected={!w} onPress={() => choosePreset(null)}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg }} />
          <X color={c.textMuted} size={22} />
        </Swatch>
      </Row>
    </View>
  );
}
