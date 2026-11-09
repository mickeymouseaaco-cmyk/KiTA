import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { WORLD_LAND_PATH, WORLD_VIEWBOX } from '@/lib/world-path';
import { radius, useTheme } from '@/theme';

export type MapPin = { id: string; lat: number; lon: number; visited?: boolean; label: string };

/** A soft, offline world map (equirectangular). No API keys, works everywhere. */
export function WorldMap({ pins, highlight }: { pins: MapPin[]; highlight?: string }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={pins.length ? `Map with ${pins.length} places: ${pins.map((p) => p.label).join(', ')}` : 'World map'}
      style={{ width: '100%', aspectRatio: 2, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.sky }}>
      <Svg width="100%" height="100%" viewBox={WORLD_VIEWBOX} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={360} height={180} fill={c.sky} />
        <Path d={WORLD_LAND_PATH} fill={c.surface} stroke={c.border} strokeWidth={0.3} />
        {pins.map((p) => {
          const x = p.lon + 180;
          const y = 90 - p.lat;
          const on = p.id === highlight;
          return (
            <Circle
              key={p.id}
              cx={x}
              cy={y}
              r={on ? 4.2 : 3}
              fill={p.visited ? c.ring : c.heart}
              stroke={c.surface}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
    </View>
  );
}
