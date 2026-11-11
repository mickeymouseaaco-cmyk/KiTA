/**
 * Together design tokens.
 * Soft UI Evolution: soft pastels, rounded cards, gentle depth.
 * Contrast: text and muted text are at or above 4.5:1 on their backgrounds in
 * both themes. There is deliberately no "danger red": tone rules forbid red warnings.
 */

export const palette = {
  light: {
    bg: '#FBF7F4', // warm cream
    surface: '#FFFFFF',
    surfaceAlt: '#F4EFFB', // lavender mist
    text: '#2E2A36',
    textMuted: '#625C6E',
    border: '#ECE5F0',
    primary: '#6A4C9C', // plum (6.9:1 on white)
    onPrimary: '#FFFFFF',
    primarySoft: '#EDE5FA',
    heart: '#C9576E', // used for hearts/love only, never for warnings
    heartSoft: '#FBE4EA',
    peach: '#FCEBE1',
    onPeach: '#6E3F25',
    sage: '#E4F1E8',
    onSage: '#2F5B3D',
    sky: '#E3EDF8',
    onSky: '#28496B',
    butter: '#FBF1D6',
    onButter: '#6B5114',
    ring: '#8FC3A0',
    ringTrack: '#E9E3EE',
    shadow: 'rgba(90, 70, 120, 0.10)',
    overlay: 'rgba(30, 24, 40, 0.35)',
  },
  dark: {
    bg: '#16141B',
    surface: '#211E28',
    surfaceAlt: '#2A2533',
    text: '#F3EFF7',
    textMuted: '#B6AEC2',
    border: '#353040',
    primary: '#C8B6F2',
    onPrimary: '#20182F',
    primarySoft: '#332A45',
    heart: '#F29AAE',
    heartSoft: '#3D2631',
    peach: '#3A2B27',
    onPeach: '#F6C9B0',
    sage: '#22322A',
    onSage: '#B5DEC2',
    sky: '#1F2B39',
    onSky: '#B9D3EF',
    butter: '#352E1D',
    onButter: '#F0D99B',
    ring: '#8FC9A2',
    ringTrack: '#463F55',
    shadow: 'rgba(0, 0, 0, 0.0)',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },
} as const;

export type Colors = { [K in keyof (typeof palette)['light']]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 } as const;

export const fonts = {
  heading: 'Lora_600SemiBold',
  headingRegular: 'Lora_500Medium',
  body: 'Raleway_500Medium',
  bodyBold: 'Raleway_700Bold',
  bodySemi: 'Raleway_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
} as const;

/** Touch targets: never smaller than 48pt. */
export const touch = { min: 48, comfy: 56 } as const;

export const motion = { quick: 180, base: 260, gentle: 420 } as const;

// ---------------------------------------------------------- look & feel
// Everything below is chosen by each person in Settings → Look & feel.

/** Colour themes. Each changes the accent family; mood tones stay the same so meaning never changes. */
export type ColorName = 'mono' | 'lavender' | 'kita' | 'ocean' | 'blossom' | 'forest' | 'sunset';
type Accent = Colors;

/** Accent text colours keep at least 4.5:1 contrast on white (light) and on the dark surface (dark). */
export const accents: Record<ColorName, { label: string; light: Partial<Accent>; dark: Partial<Accent> }> = {
  // Ink on soft neutrals, white layered cards, and rose as the single accent (hearts, progress).
  // Mood tints stay, but as whispers, so meaning never depends on colour alone.
  mono: {
    label: 'Mono',
    light: {
      bg: '#F5F5F7', surface: '#FFFFFF', surfaceAlt: '#ECECF0', border: '#E3E3E8', text: '#0B0B0F', textMuted: '#686873',
      primary: '#0B0B0F', onPrimary: '#FFFFFF', primarySoft: '#ECECF0', heart: '#C4405F', heartSoft: '#FBEDF0',
      peach: '#FBF2EC', onPeach: '#0B0B0F', sage: '#EEF6F1', onSage: '#0B0B0F', sky: '#EEF3FB', onSky: '#0B0B0F', butter: '#FAF5E6', onButter: '#0B0B0F',
      ring: '#D9607C', ringTrack: '#E6E6EB', shadow: 'rgba(16, 18, 30, 0.08)', overlay: 'rgba(10, 10, 16, 0.38)',
    },
    dark: {
      bg: '#08080A', surface: '#141417', surfaceAlt: '#1F1F24', border: '#2A2A30', text: '#F5F5F7', textMuted: '#9A9AA5',
      primary: '#F5F5F7', onPrimary: '#0B0B0F', primarySoft: '#1F1F24', heart: '#F08BA3', heartSoft: '#2B1A20',
      peach: '#1B1716', onPeach: '#F5F5F7', sage: '#141A17', onSage: '#F5F5F7', sky: '#14181F', onSky: '#F5F5F7', butter: '#1B1913', onButter: '#F5F5F7',
      ring: '#F08BA3', ringTrack: '#2A2A30', overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
  lavender: { label: 'Lavender', light: {}, dark: {} },
  kita: {
    label: 'KiTA',
    light: { bg: '#F7F7FA', surfaceAlt: '#EEF0F6', border: '#E2E5EE', primary: '#18213D', primarySoft: '#F8E4E8', ring: '#E5899B', ringTrack: '#E8EAF1' },
    dark: { bg: '#10152A', surface: '#18213D', surfaceAlt: '#212B4C', border: '#2C3760', primary: '#F0A9B6', onPrimary: '#2A1220', primarySoft: '#3A2740', ring: '#E5899B', ringTrack: '#2C3760' },
  },
  ocean: {
    label: 'Ocean',
    light: { bg: '#F5F9FC', surfaceAlt: '#E8F2F9', border: '#DCE8F1', primary: '#1F5F8B', primarySoft: '#E1EEF8', ring: '#5FA8D3', ringTrack: '#E1E9F0' },
    dark: { bg: '#11171D', surface: '#18212A', surfaceAlt: '#1F2B36', border: '#2A3946', primary: '#8EC5EC', onPrimary: '#0F2233', primarySoft: '#1C2E3D', ring: '#7CB9E0', ringTrack: '#33465A' },
  },
  blossom: {
    label: 'Blossom',
    light: { bg: '#FDF6F8', surfaceAlt: '#FAEDF2', border: '#F2DDE5', primary: '#A23D63', primarySoft: '#FBE6EE', ring: '#E58FAE', ringTrack: '#F1E1E7' },
    dark: { bg: '#1A1316', surface: '#241A1F', surfaceAlt: '#2E2128', border: '#3E2C35', primary: '#F2A7C3', onPrimary: '#33121F', primarySoft: '#3B2230', ring: '#E99AB8', ringTrack: '#4A3540' },
  },
  forest: {
    label: 'Forest',
    light: { bg: '#F6FAF7', surfaceAlt: '#E9F3EC', border: '#DCEAE0', primary: '#2F6B4F', primarySoft: '#E2F0E7', ring: '#79B892', ringTrack: '#E1EBE4' },
    dark: { bg: '#111814', surface: '#18211B', surfaceAlt: '#1F2B23', border: '#2B3A30', primary: '#96D3AE', onPrimary: '#10261A', primarySoft: '#1E3127', ring: '#8FC9A2', ringTrack: '#34463A' },
  },
  sunset: {
    label: 'Sunset',
    light: { bg: '#FFF8F3', surfaceAlt: '#FBEEE4', border: '#F2E0D3', primary: '#A84A1F', primarySoft: '#FCE9DD', ring: '#E89A6B', ringTrack: '#F0E3DA' },
    dark: { bg: '#1A1410', surface: '#241C16', surfaceAlt: '#2E231B', border: '#3D2F25', primary: '#F5B48A', onPrimary: '#33190B', primarySoft: '#3A2519', ring: '#EBA57A', ringTrack: '#4A3A2E' },
  },
};

export function colorsFor(name: ColorName, dark: boolean): Colors {
  const base = dark ? palette.dark : palette.light;
  const accent = accents[name] ?? accents.lavender;
  return { ...base, ...(dark ? accent.dark : accent.light) };
}

/** Styles: how shapes, type and depth feel. */
export type LookName = 'minimal' | 'soft' | 'professional' | 'playful';
export type Look = {
  name: LookName;
  label: string;
  /** Font for display, title and heading text. */
  headingFont: string;
  cardRadius: number;
  controlRadius: number;
  cardBorder: number;
  /** Comic-style outline and offset shadow. */
  outlined: boolean;
  /** Soft drop shadow on cards in light mode. */
  softShadow: boolean;
  /** A little emoji next to the greeting. */
  emoji: boolean;
  /** The phone's own typeface (San Francisco on iPhone) instead of Lora and Raleway. */
  systemFont: boolean;
  /** The modern surface language: ambient light instead of a colour wash, layered hairline cards, bare icon buttons, glass sheets. */
  flat: boolean;
};

export const looks: Record<LookName, Look> = {
  // The shape rule: actions and inputs 14, cards 20, chips are pills.
  minimal: {
    name: 'minimal',
    label: 'Modern',
    headingFont: 'System',
    cardRadius: 20,
    controlRadius: 14,
    cardBorder: 0,
    outlined: false,
    softShadow: false,
    emoji: false,
    systemFont: true,
    flat: true,
  },
  soft: {
    name: 'soft',
    label: 'Soft',
    headingFont: fonts.heading,
    cardRadius: radius.lg,
    controlRadius: radius.pill,
    cardBorder: 0,
    outlined: false,
    softShadow: true,
    emoji: false,
    systemFont: false,
    flat: false,
  },
  professional: {
    name: 'professional',
    label: 'Professional',
    headingFont: fonts.bodyBold,
    cardRadius: 10,
    controlRadius: 10,
    cardBorder: 1,
    outlined: false,
    softShadow: false,
    emoji: false,
    systemFont: false,
    flat: false,
  },
  playful: {
    name: 'playful',
    label: 'Playful',
    headingFont: fonts.bodyBold,
    cardRadius: 28,
    controlRadius: radius.pill,
    cardBorder: 2,
    outlined: true,
    softShadow: false,
    emoji: true,
    systemFont: false,
    flat: false,
  },
};

export type MotionLevel = 'off' | 'gentle' | 'lively';
export type ModeName = 'auto' | 'light' | 'dark';
export type TextSize = 'small' | 'default' | 'large' | 'xlarge';

/** How much bigger (or smaller) all text is, on top of the phone's own text size. */
export const TEXT_SCALE: Record<TextSize, number> = { small: 0.9, default: 1, large: 1.15, xlarge: 1.3 };

/** Bumped when the default look changes, so everyone meets the new design once (and can switch back). */
export const APPEARANCE_VERSION = 2;
export type Appearance = { color: ColorName; look: LookName; motion: MotionLevel; mode: ModeName; text: TextSize; v: number };
export const DEFAULT_APPEARANCE: Appearance = { color: 'mono', look: 'minimal', motion: 'gentle', mode: 'auto', text: 'default', v: APPEARANCE_VERSION };

/** Raleway/Lora names → the matching weight of the phone's own font. */
export function systemFont(family: string | undefined): { fontFamily: string; fontWeight: '400' | '600' | '700' } | null {
  if (!family) return null;
  if (family === 'System') return { fontFamily: 'System', fontWeight: '700' };
  if (!/^(Raleway|Lora)_/.test(family)) return null;
  const weight = /_700/.test(family) || family === 'Lora_600SemiBold' ? '700' : /_600|Lora_500/.test(family) ? '600' : '400';
  return { fontFamily: 'System', fontWeight: weight };
}

/** Anything unknown (an older or newer app version wrote it) falls back to the default. */
export function cleanAppearance(raw: unknown): Appearance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <K extends string>(v: unknown, allowed: readonly K[], fallback: K): K => (allowed.includes(v as K) ? (v as K) : fallback);
  // A choice saved before the redesign: start from the new look, keep everything else.
  const current = r.v === APPEARANCE_VERSION;
  return {
    v: APPEARANCE_VERSION,
    color: current ? pick(r.color, Object.keys(accents) as ColorName[], DEFAULT_APPEARANCE.color) : DEFAULT_APPEARANCE.color,
    look: current ? pick(r.look, Object.keys(looks) as LookName[], DEFAULT_APPEARANCE.look) : DEFAULT_APPEARANCE.look,
    motion: pick(r.motion, ['off', 'gentle', 'lively'] as const, DEFAULT_APPEARANCE.motion),
    mode: pick(r.mode, ['auto', 'light', 'dark'] as const, DEFAULT_APPEARANCE.mode),
    text: pick(r.text, ['small', 'default', 'large', 'xlarge'] as const, DEFAULT_APPEARANCE.text),
  };
}

// ---------------------------------------------------------- vivid colours
/**
 * Bright, friendly colours for the things you tap every day (Home shortcuts,
 * meals, the forecast). Each pair is a top-to-bottom gradient; white icons
 * sit on them with good contrast in light and dark mode.
 */
export const vivid = {
  green: ['#43D98F', '#13B37D'],
  amber: ['#FFCE52', '#FFA41B'],
  orange: ['#FF9A57', '#FF6136'],
  blue: ['#62A2FF', '#4A6CFF'],
  pink: ['#FF7EAB', '#EC4B82'],
  violet: ['#B091FF', '#7C5CFA'],
  teal: ['#4FD6E0', '#1FA7C9'],
} as const;
export type VividName = keyof typeof vivid;
