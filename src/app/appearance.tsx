/** Settings → Look & feel: colours, style, animations and light/dark. Saved for this person on every phone. */
import { Check, Heart, Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Button, Card, Chip, Gap, Row, Screen, Segmented, SectionTitle, T } from '@/components/ui';
import { useSetAppearance } from '@/lib/appearance';
import { haptic } from '@/lib/haptics';
import {
  accents,
  colorsFor,
  looks,
  space,
  useTheme,
  type ColorName,
  type LookName,
  type ModeName,
  type MotionLevel,
  type TextSize,
} from '@/theme';

const LOOK_LINE: Record<LookName, string> = {
  soft: 'Rounded and calm. The original KiTA.',
  professional: 'Clean lines, plain type, no frills.',
  playful: 'Bold outlines and cartoon fun.',
};

const MOTION_LINE: Record<MotionLevel, string> = {
  off: 'Everything stays still.',
  gentle: 'Small, soft movements.',
  lively: 'Bouncier buttons, more confetti, moving weather.',
};

function Swatch({ name, selected, onPress }: { name: ColorName; selected: boolean; onPress: () => void }) {
  const { c, dark } = useTheme();
  const sw = colorsFor(name, dark);
  return (
    <Pressable
      testID={`color-${name}`}
      accessibilityRole="radio"
      accessibilityLabel={`${accents[name].label} colours`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ alignItems: 'center', gap: space.xs, width: '33.33%', paddingVertical: space.xs }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: sw.primarySoft,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? c.text : c.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: sw.primary, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <Check color={sw.onPrimary} size={18} strokeWidth={3} /> : null}
        </View>
      </View>
      <T variant="small" muted={!selected}>
        {accents[name].label}
      </T>
    </Pressable>
  );
}

/** A tiny card drawn in a given style, so each option shows what it looks like. */
function LookOption({ name, selected, onPress }: { name: LookName; selected: boolean; onPress: () => void }) {
  const { c, dark } = useTheme();
  const l = looks[name];
  const card = {
    backgroundColor: c.surface,
    borderRadius: l.cardRadius * 0.6,
    borderWidth: l.outlined ? 2 : l.softShadow && !dark ? 0 : 1,
    borderColor: l.outlined ? c.text : c.border,
    boxShadow: l.outlined ? `3px 3px 0px ${c.primary}` : l.softShadow && !dark ? '0px 3px 10px rgba(90, 70, 120, 0.12)' : undefined,
    padding: space.md,
    gap: 6,
  } as const;
  return (
    <Pressable
      testID={`look-${name}`}
      accessibilityRole="radio"
      accessibilityLabel={`${l.label} style. ${LOOK_LINE[name]}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderRadius: 18,
        borderWidth: 2,
        borderColor: selected ? c.primary : 'transparent',
        backgroundColor: selected ? c.primarySoft : c.surfaceAlt,
        padding: space.md,
        marginBottom: space.sm,
      }}>
      <Row gap={space.md}>
        <View style={[card, { width: 104 }]}>
          <T style={{ fontFamily: l.headingFont, fontSize: 13, lineHeight: 16 }}>Hi {l.emoji ? '🌙' : ''}</T>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, width: '80%' }} />
          <View
            style={{
              height: 16,
              borderRadius: l.controlRadius > 100 ? 8 : 4,
              backgroundColor: c.primary,
              width: '60%',
              borderWidth: l.outlined ? 1.5 : 0,
              borderColor: c.text,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{l.label}</T>
          <T variant="small" muted>
            {LOOK_LINE[name]}
          </T>
        </View>
        {selected ? <Check color={c.primary} size={22} /> : null}
      </Row>
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const { c, appearance, motion } = useTheme();
  const set = useSetAppearance();
  const choose = (next: Parameters<typeof set>[0]) => {
    haptic.tap();
    set(next);
  };

  return (
    <Screen edges={['bottom']}>
      <T muted>Make KiTA feel like yours. Only you see your choice; your partner picks their own.</T>
      <Gap />

      {/* Live preview: this is what the app looks like right now. */}
      <Card tone="lavender">
        <T variant="title">Good evening{appearance.look === 'playful' ? ' 🌙' : ''}</T>
        <Gap h={space.sm} />
        <Card>
          <Row gap={space.sm}>
            <Heart color={c.heart} fill={c.heart} size={18} />
            <T variant="bodyStrong" style={{ flex: 1 }}>
              A little preview
            </T>
          </Row>
          <Gap h={space.sm} />
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            <Chip label="Selected" selected />
            <Chip label="Chip" />
          </Row>
          <Gap h={space.md} />
          <Button small icon={Sparkles} label="A button" />
        </Card>
      </Card>
      <Gap />

      <SectionTitle>Colours</SectionTitle>
      <Row accessibilityRole="radiogroup" gap={0} style={{ flexWrap: 'wrap' }}>
        {(Object.keys(accents) as ColorName[]).map((n) => (
          <Swatch key={n} name={n} selected={appearance.color === n} onPress={() => choose({ color: n })} />
        ))}
      </Row>
      <Gap />

      <SectionTitle>Style</SectionTitle>
      <View accessibilityRole="radiogroup">
        {(Object.keys(looks) as LookName[]).map((n) => (
          <LookOption key={n} name={n} selected={appearance.look === n} onPress={() => choose({ look: n })} />
        ))}
      </View>
      <Gap h={space.sm} />

      <SectionTitle>Animations</SectionTitle>
      <Segmented<MotionLevel>
        value={appearance.motion}
        onChange={(v) => choose({ motion: v })}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'gentle', label: 'Gentle' },
          { value: 'lively', label: 'Lively' },
        ]}
      />
      <Gap h={space.sm} />
      <T variant="small" muted>
        {motion === 'off' && appearance.motion !== 'off'
          ? 'Your phone’s “Reduce motion” setting is on, so animations stay off.'
          : MOTION_LINE[appearance.motion]}
      </T>
      <Gap />

      <SectionTitle>Text size</SectionTitle>
      <Segmented<TextSize>
        value={appearance.text}
        onChange={(v) => choose({ text: v })}
        options={[
          { value: 'small', label: 'A-' },
          { value: 'default', label: 'A' },
          { value: 'large', label: 'A+' },
          { value: 'xlarge', label: 'A++' },
        ]}
      />
      <Gap h={space.sm} />
      <T variant="small" muted>
        {{ small: 'Smaller text, more on screen.', default: 'The standard size.', large: 'Larger, easier to read.', xlarge: 'Largest, for easy reading.' }[appearance.text]}
        {' '}Your phone&apos;s own text size still applies on top.
      </T>
      <Gap />

      <SectionTitle>Light or dark</SectionTitle>
      <Segmented<ModeName>
        value={appearance.mode}
        onChange={(v) => choose({ mode: v })}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <Gap h={space.sm} />
      <T variant="small" muted>
        {appearance.mode === 'auto' ? 'Follows your phone: light by day, dark at night if your phone does.' : ' '}
      </T>
    </Screen>
  );
}
