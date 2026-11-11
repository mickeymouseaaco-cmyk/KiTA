/**
 * Meals: a quick, judgement-free log of what you ate. No calories, no targets,
 * no streak pressure. Four bright slots (breakfast, lunch, dinner, snack);
 * tap one to add what you had.
 *
 * (Older days may still hold a count of water glasses; it's simply not shown
 * any more.)
 */
import { Check, Cookie, Croissant, Sandwich, UtensilsCrossed, X, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { addMeal, removeMeal, type LogCtx } from '@/lib/logs';
import type { FoodLog, MealKind, SharedDay } from '@/lib/types';
import { space, useTheme, vivid, type VividName } from '@/theme';

import { Sheet, useFeedback } from './feedback';
import { Button, Row, T, useInputStyle } from './ui';
import { VividAction, VividSquare, type BurstHandle } from './vivid';

export const MEAL_LABEL: Record<MealKind, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
export const MEAL_LOOK: Record<MealKind, { icon: LucideIcon; color: VividName; hint: string }> = {
  breakfast: { icon: Croissant, color: 'amber', hint: 'Nasi lemak, toast, a coffee…' },
  lunch: { icon: Sandwich, color: 'green', hint: 'Chicken rice, a salad, leftovers…' },
  dinner: { icon: UtensilsCrossed, color: 'orange', hint: 'Home-cooked, takeaway, a date night…' },
  snack: { icon: Cookie, color: 'pink', hint: 'Fruit, kuih, something sweet…' },
};
const KINDS = Object.keys(MEAL_LABEL) as MealKind[];

export function mealNow(): MealKind {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

/** The "add a meal" sheet: pick which meal, write what you had. */
export function MealSheet({ ctx, visible, start, onClose, onSaved }: { ctx: LogCtx; visible: boolean; start: MealKind; onClose: () => void; onSaved?: (kind: MealKind) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <MealForm key={start} ctx={ctx} start={start} onClose={onClose} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function MealForm({ ctx, start, onClose, onSaved }: { ctx: LogCtx; start: MealKind; onClose: () => void; onSaved?: (kind: MealKind) => void }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<MealKind>(start);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addMeal(ctx, kind, text);
      haptic.success();
      onSaved?.(kind);
      onClose();
    } catch {
      toast(gentleError.save);
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <T variant="title" center>
        What did you have?
      </T>
      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {KINDS.map((k) => {
          const { icon: Icon, color } = MEAL_LOOK[k];
          const on = k === kind;
          return (
            <Pressable
              key={k}
              testID={`meal-kind-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={MEAL_LABEL[k]}
              onPress={() => {
                haptic.tap();
                setKind(k);
              }}
              style={{ alignItems: 'center', gap: 6, flex: 1, maxWidth: 84, opacity: on ? 1 : 0.55 }}>
              <View style={{ borderRadius: 18, padding: 3, borderWidth: 2, borderColor: on ? vivid[color][1] : 'transparent' }}>
                <VividSquare color={color} size={48} radius={14}>
                  <Icon color="#FFFFFF" size={22} strokeWidth={2.3} />
                </VividSquare>
              </View>
              <T variant="small" style={{ fontFamily: on ? 'Raleway_700Bold' : 'Raleway_600SemiBold', fontSize: 13 }}>
                {MEAL_LABEL[k]}
              </T>
            </Pressable>
          );
        })}
      </Row>
      <TextInput
        testID="meal-text"
        value={text}
        onChangeText={setText}
        placeholder={MEAL_LOOK[kind].hint}
        placeholderTextColor={c.textMuted}
        maxLength={200}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel={`What did you have for ${MEAL_LABEL[kind].toLowerCase()}?`}
        style={input}
      />
      <Button testID="save-meal" label={`Add ${MEAL_LABEL[kind].toLowerCase()}`} onPress={save} loading={busy} disabled={!text.trim()} hint="Write what you had first" />
    </View>
  );
}

export function FoodCardBody({ ctx, food }: { ctx: LogCtx; food?: FoodLog }) {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const [sheet, setSheet] = useState<MealKind | null>(null);
  const tiles = useRef<Partial<Record<MealKind, BurstHandle | null>>>({});
  const meals = food?.meals ?? [];
  const has = (k: MealKind) => meals.filter((m) => m.kind === k).length;

  return (
    <View style={{ gap: space.md }}>
      <Row gap={space.xs} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {KINDS.map((k) => (
          <View key={k} style={{ flex: 1, alignItems: 'center' }}>
            <VividAction
              ref={(r) => {
                tiles.current[k] = r;
              }}
              testID={k === mealNow() ? 'add-meal' : `meal-slot-${k}`}
              icon={MEAL_LOOK[k].icon}
              label={MEAL_LABEL[k]}
              color={MEAL_LOOK[k].color}
              size={52}
              detail={has(k) ? `${has(k)} logged. Add another` : 'Add what you had'}
              onPress={() => setSheet(k)}
            />
            {has(k) ? (
              <View style={{ position: 'absolute', top: -4, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(0,0,0,0.18)', pointerEvents: 'none' }}>
                <Check color={vivid[MEAL_LOOK[k].color][1]} size={13} strokeWidth={3.2} />
              </View>
            ) : null}
          </View>
        ))}
      </Row>

      {meals.length ? (
        <View style={{ gap: 2 }}>
          {meals.map((m) => {
            const { icon: Icon, color } = MEAL_LOOK[m.kind];
            return (
              <Row key={m.id} gap={space.sm} style={{ minHeight: 40 }}>
                <Icon color={vivid[color][1]} size={18} strokeWidth={2.2} accessibilityLabel={MEAL_LABEL[m.kind]} />
                <T style={{ flex: 1 }} numberOfLines={2}>
                  {m.text}
                </T>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.text}`}
                  hitSlop={10}
                  onPress={() => removeMeal(ctx, meals, m.id).catch(() => toast(gentleError.save))}
                  style={{ padding: 6 }}>
                  <X color={c.textMuted} size={16} />
                </Pressable>
              </Row>
            );
          })}
        </View>
      ) : (
        <T variant="small" muted center>
          Tap a meal to add it. No calories, no counting.
        </T>
      )}

      <MealSheet ctx={ctx} visible={!!sheet} start={sheet ?? mealNow()} onClose={() => setSheet(null)} onSaved={(k) => tiles.current[k]?.burst()} />
    </View>
  );
}

/** Partner's view of shared meals. */
export function SharedFood({ food }: { food: NonNullable<SharedDay['food']> }) {
  return (
    <View style={{ gap: space.sm }}>
      {food.meals.length ? (
        food.meals.map((m, i) => {
          const { icon: Icon, color } = MEAL_LOOK[m.kind];
          return (
            <Row key={i} gap={space.sm}>
              <VividSquare color={color} size={30} radius={9}>
                <Icon color="#FFFFFF" size={15} strokeWidth={2.3} />
              </VividSquare>
              <T variant="label" muted style={{ width: 84 }}>
                {MEAL_LABEL[m.kind].toUpperCase()}
              </T>
              <T style={{ flex: 1 }}>{m.text}</T>
            </Row>
          );
        })
      ) : (
        <T muted>No meals shared yet today.</T>
      )}
    </View>
  );
}
