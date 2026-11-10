/**
 * The KiTA logo: two circles (the two of you) and the space you share, with the
 * KiTA wordmark set in Inter Display (outlined, so no font is needed).
 * Source and every exported icon: assets/brand/ (brand.py, export_overlap.py).
 */
import Svg, { Circle, G, Path } from 'react-native-svg';

export const BRAND = { navy: '#18213D', rose: '#E5899B', wine: '#8E3F64', roseOnNavy: '#C76A86' };

/** The two-circle symbol on its own. */
export function KitaSymbol({ size = 48, onDark }: { size?: number; onDark?: boolean }) {
  const a = onDark ? '#FFFFFF' : BRAND.navy;
  const lens = onDark ? BRAND.roseOnNavy : BRAND.wine;
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000" accessibilityLabel="KiTA">
      <Circle cx="365" cy="500" r="300" fill={a} />
      <Circle cx="635" cy="500" r="300" fill={BRAND.rose} />
      <Path d="M500 236 A300 300 0 0 1 500 764 A300 300 0 0 1 500 236 Z" fill={lens} />
    </Svg>
  );
}

/** Symbol + wordmark. `height` is the height of the symbol. */
export function KitaLogo({ height = 56, onDark, color }: { height?: number; onDark?: boolean; color?: string }) {
  const word = color ?? (onDark ? '#FFFFFF' : BRAND.navy);
  const a = onDark ? '#FFFFFF' : BRAND.navy;
  const lens = onDark ? BRAND.roseOnNavy : BRAND.wine;
  const W = 7096;
  const H = 2160;
  return (
    <Svg width={(height * W) / H} height={height} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="KiTA">
      <G transform="scale(2.16050)">
        <Circle cx="365" cy="500" r="300" fill={a} />
        <Circle cx="635" cy="500" r="300" fill={BRAND.rose} />
        <Path d="M500 236 A300 300 0 0 1 500 764 A300 300 0 0 1 500 236 Z" fill={lens} />
      </G>
        <Path transform="translate(2727 1825) scale(1 -1)" d="M124 0H388V436L592 667L1045 0H1353L770 845L1343 1490H1017L621 1041C543 951 466 861 388 771V1490H124Z" fill={word} />
        <Path transform="translate(4066 1825) scale(1 -1)" d="M112 0H364V1056H112Z" fill={word} />
        <Path transform="translate(4536 1825) scale(1 -1)" d="M46 1261H510V0H775V1261H1237V1490H46Z" fill={word} />
        <Path transform="translate(5688 1825) scale(1 -1)" d="M13 0H297L419 356H997L1116 0H1407L877 1490H545ZM493 573 565 783C610 920 655 1063 711 1251C767 1063 811 920 855 783L925 573Z" fill={word} />
      <Circle cx="4304" cy="491" r="156" fill={BRAND.rose} />
    </Svg>
  );
}
