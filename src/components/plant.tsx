/**
 * The shared plant. It grows when either of you looks after yourself or each
 * other. It never wilts: missed days simply pause it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { coupleStreak, plantStage, useCareDays, usePlant } from '@/lib/together-data';
import { radius, space, useTheme } from '@/theme';

import { useCelebrate } from './celebrate';
import { Card, Row, T } from './ui';

const STREAK_MILESTONES = [3, 7, 14, 30, 60];

export function PlantDrawing({ stage, size = 120 }: { stage: number; size?: number }) {
  const { c } = useTheme();
  const leaf = '#7FBF8E';
  const leafDark = '#5FA172';
  const stemTop = [92, 80, 64, 50, 40, 32][stage];
  const leaves = [0, 1, 2, 4, 6, 8][stage];
  const flowers = [0, 0, 0, 0, 2, 4][stage];
  const leafSpots = [
    [60, 78, -1],
    [60, 70, 1],
    [60, 62, -1],
    [60, 54, 1],
    [60, 48, -1],
    [60, 42, 1],
    [60, 38, -1],
    [60, 36, 1],
  ];
  const flowerSpots = [
    [60, stemTop - 4],
    [44, 50],
    [76, 46],
    [52, 38],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden>
      <Ellipse cx={60} cy={112} rx={34} ry={4} fill={c.ringTrack} />
      <Path d="M36 92 L84 92 L78 112 L42 112 Z" fill="#D9A68C" />
      <Rect x={33} y={88} width={54} height={8} rx={3} fill="#E7B8A0" />
      {stage === 0 ? <Ellipse cx={60} cy={88} rx={5} ry={3.5} fill="#A07A5F" /> : <Path d={`M60 90 Q 58 ${(90 + stemTop) / 2} 60 ${stemTop}`} stroke={leafDark} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {leafSpots.slice(0, leaves).map(([x, y, dir], i) => (
        <Path
          key={i}
          d={`M${x} ${y} q ${dir * 14} -10 ${dir * 22} -2 q ${dir * -10} 10 ${dir * -22} 2 z`}
          fill={i % 2 ? leafDark : leaf}
        />
      ))}
      {stage === 1 ? <Path d={`M60 ${stemTop} q -8 -8 -14 -4 q 6 6 14 4 z M60 ${stemTop} q 8 -8 14 -4 q -6 6 -14 4 z`} fill={leaf} /> : null}
      {flowerSpots.slice(0, flowers).map(([x, y], i) => (
        <G key={i}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle key={a} cx={x + 5 * Math.cos((a * Math.PI) / 180)} cy={y + 5 * Math.sin((a * Math.PI) / 180)} r={3.6} fill={i % 2 ? '#F4A6B8' : '#F6C97A'} />
          ))}
          <Circle cx={x} cy={y} r={2.6} fill="#FFF3D6" />
        </G>
      ))}
    </Svg>
  );
}

/** The plant card, with growth progress and the couple streak. Celebrates stage-ups and streak milestones once. */
export function PlantCard({ cid, members, uid }: { cid: string; members: string[]; uid: string }) {
  const { c } = useTheme();
  const celebrate = useCelebrate();
  const points = usePlant(cid);
  const { days, keys } = useCareDays(cid);
  const stage = plantStage(points ?? 0);
  const streak = coupleStreak(days, members, keys);
  const pct = stage.next ? ((points ?? 0) - stage.floor) / (stage.next - stage.floor) : 1;

  useEffect(() => {
    if (points === null) return;
    const key = `together.plantStage.${uid}.${cid}`;
    AsyncStorage.getItem(key)
      .then((prev) => {
        if (prev !== null && Number(prev) < stage.index) celebrate(`Your plant grew into a ${stage.name.toLowerCase()}!`);
        return AsyncStorage.setItem(key, String(stage.index));
      })
      .catch(() => {});
  }, [points, stage.index, stage.name, celebrate, uid, cid]);

  useEffect(() => {
    const hit = [...STREAK_MILESTONES].reverse().find((m) => streak >= m);
    if (!hit) return;
    const key = `together.streak.${uid}.${cid}.${hit}`;
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (!seen) {
          celebrate(`${hit} days in a row, both of you caring. Lovely.`);
          return AsyncStorage.setItem(key, '1');
        }
      })
      .catch(() => {});
  }, [streak, celebrate, uid, cid]);

  return (
    <Card tone="sage">
      <Row gap={space.lg}>
        <PlantDrawing stage={stage.index} />
        <View style={{ flex: 1, gap: space.xs }}>
          <T variant="label" color={c.onSage}>
            YOUR PLANT
          </T>
          <T testID="plant-stage" variant="title" color={c.onSage}>
            {stage.name}
          </T>
          <T color={c.onSage}>{stage.line}</T>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Growth"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
            style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.surface, overflow: 'hidden', marginTop: space.xs }}>
            <View style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', backgroundColor: c.ring }} />
          </View>
        </View>
      </Row>
      <T testID="couple-streak" variant="small" color={c.onSage} style={{ marginTop: space.md }}>
        {streak >= 2
          ? `You’ve both cared ${streak} days in a row.`
          : 'It grows whenever either of you logs, checks in, says thank you, or sends a hug.'}
      </T>
    </Card>
  );
}
