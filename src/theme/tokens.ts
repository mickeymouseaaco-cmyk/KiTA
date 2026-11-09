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
