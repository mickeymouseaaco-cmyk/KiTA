/**
 * Food & water: a quick, judgement-free log. No calories, no targets, no streak
 * pressure. Water is just a counter of glasses.
 */
import { GlassWater, Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { addMeal, changeWater, removeMeal, type LogCtx } from '@/lib/logs';
import type { FoodLog, MealKind, SharedDay } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

import { useFeedback } from './feedback';
import { Button, Chip, IconButton, Row, T, useInputStyle } from './ui';

export const MEAL_LABEL: Record<MealKind, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function defaultKind(): MealKind {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

export function Glasses({ count }: { count: number }) {
  const { c } = useTheme();
  const shown = Math.min(count, 10);
  return (
    <Row gap={4} style={{ flexWrap: 'wrap' }} accessible accessibilityLabel={`${count} ${count === 1 ? 'glass' : 'glasses'} of water`}>
      {Array.from({ length: shown }, (_, i) => (
        <GlassWater key={i} color={c.onSky} size={20} />
      ))}
      {count > 10 ? (
        <T variant="small" color={c.onSky}>
          +{count - 10}
        </T>
      ) : null}
    </Row>
  );
}

export function FoodCardBody({ ctx, food }: { ctx: LogCtx; food?: FoodLog }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<MealKind>(defaultKind);
  const [text, setText] = useState('');
  const meals = food?.meals ?? [];
  const water = food?.water ?? 0;

  async function save() {
    if (!text.trim()) return;
    try {
      await addMeal(ctx, kind, text);
      haptic.success();
      setText('');
      setAdding(false);
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ backgroundColor: c.sky, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="bodyStrong" color={c.onSky}>
            Water
          </T>
          <Row gap={space.sm}>
            <IconButton
              icon={Minus}
              label="One glass less"
              size={44}
              onPress={() => changeWater(ctx, water, -1).catch(() => toast(gentleError.save))}
            />
            <T testID="water-count" variant="heading" color={c.onSky} style={{ minWidth: 28, textAlign: 'center' }}>
              {water}
            </T>
            <IconButton
              testID="water-plus"
              icon={Plus}
              label="Add a glass of water"
              tone="primary"
              size={44}
              onPress={() => {
                haptic.tap();
                changeWater(ctx, water, 1).catch(() => toast(gentleError.save));
              }}
            />
          </Row>
        </Row>
        {water > 0 ? <Glasses count={water} /> : <T variant="small" color={c.onSky}>A glass whenever you think of it.</T>}
      </View>

      {meals.length ? (
        <View style={{ gap: space.xs }}>
          {meals.map((m) => (
            <Row key={m.id} gap={space.sm} style={{ minHeight: 40 }}>
              <T variant="label" muted style={{ width: 84 }}>
                {MEAL_LABEL[m.kind].toUpperCase()}
              </T>
              <T style={{ flex: 1 }}>{m.text}</T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${m.text}`}
                hitSlop={10}
                onPress={() => removeMeal(ctx, meals, m.id).catch(() => toast(gentleError.save))}
                style={{ padding: 6 }}>
                <X color={c.textMuted} size={16} />
              </Pressable>
            </Row>
          ))}
        </View>
      ) : null}

      {adding ? (
        <View style={{ gap: space.sm }}>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {(Object.keys(MEAL_LABEL) as MealKind[]).map((k) => (
              <Chip key={k} label={MEAL_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </Row>
          <TextInput
            testID="meal-text"
            value={text}
            onChangeText={setText}
            placeholder="What did you have?"
            placeholderTextColor={c.textMuted}
            maxLength={200}
            onSubmitEditing={save}
            style={input}
          />
          <Row gap={space.sm}>
            <Button small kind="ghost" label="Cancel" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            <Button testID="save-meal" small label="Add" style={{ flex: 1 }} onPress={save} disabled={!text.trim()} />
          </Row>
        </View>
      ) : (
        <Button testID="add-meal" small kind="soft" label={meals.length ? 'Add something else' : 'Add a meal or snack'} onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

/** Partner's view of shared food. */
export function SharedFood({ food }: { food: NonNullable<SharedDay['food']> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {food.meals.length ? (
        food.meals.map((m, i) => (
          <Row key={i} gap={space.sm}>
            <T variant="label" muted style={{ width: 84 }}>
              {MEAL_LABEL[m.kind].toUpperCase()}
            </T>
            <T style={{ flex: 1 }}>{m.text}</T>
          </Row>
        ))
      ) : (
        <T muted>No meals shared yet today.</T>
      )}
      {food.water > 0 ? (
        <View style={{ backgroundColor: c.sky, borderRadius: radius.md, padding: space.md }}>
          <Glasses count={food.water} />
        </View>
      ) : null}
    </View>
  );
}
