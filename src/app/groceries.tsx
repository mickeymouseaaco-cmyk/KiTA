/**
 * Groceries: one shared shopping list. Type "2kg beras" and it lands in the
 * pantry with its amount; tick things off as they go in the trolley (your
 * partner sees it live), then clear the trolley when you're done.
 */
import { Check, Plus, ShoppingBasket, Trash, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Card, Chip, EmptyState, Gap, IconButton, Row, Screen, SectionTitle, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { QUICK_GROCERIES, addGrocery, clearTicked, groupForShop, removeGrocery, toggleGrocery, useGroceries, type GroceryItem } from '@/lib/groceries';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { space, useTheme } from '@/theme';

function ItemRow({ item, onToggle, onRemove, who }: { item: GroceryItem; onToggle: () => void; onRemove: () => void; who: string }) {
  const { c } = useTheme();
  return (
    <Row gap={space.md} style={{ minHeight: 52, paddingVertical: 6 }}>
      <Pressable
        testID={`grocery-${item.name}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={`${item.name}${item.qty ? `, ${item.qty}` : ''}${item.done ? ', in the trolley' : ''}`}
        onPress={onToggle}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: item.done ? '#34C759' : c.border,
            backgroundColor: item.done ? '#34C759' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {item.done ? <Check color="#FFFFFF" size={15} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" muted={item.done} style={item.done ? { textDecorationLine: 'line-through' } : undefined} numberOfLines={2}>
            {item.name}
          </T>
          {item.qty || who ? (
            <T variant="small" muted style={{ fontSize: 13, lineHeight: 17 }}>
              {[item.qty, who].filter(Boolean).join(' · ')}
            </T>
          ) : null}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} hitSlop={8} onPress={onRemove} style={{ padding: 6 }}>
        <X color={c.textMuted} size={18} />
      </Pressable>
    </Row>
  );
}

export default function Groceries() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const { items, ready } = useGroceries(cid);
  const [text, setText] = useState('');
  const { toBuy, inTrolley } = groupForShop(items);
  const left = items.filter((i) => !i.done).length;
  const have = new Set(items.filter((i) => !i.done).map((i) => i.name.toLowerCase()));

  async function add(typed = text) {
    if (!typed.trim()) return;
    try {
      await addGrocery(cid, uid, typed);
      haptic.tap();
      if (typed === text) setText('');
    } catch {
      toast(gentleError.save);
    }
  }

  const toggle = (i: GroceryItem) => {
    haptic.tap();
    toggleGrocery(cid, uid, i).catch(() => toast(gentleError.save));
  };
  const remove = (i: GroceryItem) => removeGrocery(cid, i.id).catch(() => toast(gentleError.save));
  const by = (i: GroceryItem) => (i.done ? (i.doneBy === uid ? 'got it' : i.doneBy ? `${partnerName} got it` : '') : i.addedBy === uid ? '' : `from ${partnerName}`);

  return (
    <Screen edges={['bottom']}>
      <T variant="small" muted style={{ marginBottom: space.sm }}>
        {left ? `${left} to buy · ${partnerName} sees changes live` : `Shared with ${partnerName}. Tick things off as they go in the trolley.`}
      </T>
      <Row gap={space.sm}>
        <TextInput
          testID="grocery-input"
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => add()}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder="Add an item, e.g. 2kg beras"
          placeholderTextColor={c.textMuted}
          style={[input, { flex: 1 }]}
        />
        <IconButton testID="grocery-add" icon={Plus} label="Add item" tone="primary" onPress={() => add()} disabled={!text.trim()} />
      </Row>
      <Row gap={space.xs} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
        {QUICK_GROCERIES.filter((q) => !have.has(q.toLowerCase()))
          .slice(0, 8)
          .map((q) => (
            <Chip key={q} label={`+ ${q}`} onPress={() => add(q)} />
          ))}
      </Row>
      <Gap />

      {ready && items.length === 0 ? (
        <Card>
          <EmptyState icon={ShoppingBasket} line={`Nothing on the list yet. Add what you need, and ${partnerName} can grab it too.`} />
        </Card>
      ) : null}

      {toBuy.map((g) => (
        <View key={g.aisle} style={{ marginBottom: space.md }}>
          <SectionTitle>{g.label}</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {g.items.map((i) => (
              <ItemRow key={i.id} item={i} who={by(i)} onToggle={() => toggle(i)} onRemove={() => remove(i)} />
            ))}
          </Card>
        </View>
      ))}

      {inTrolley.length ? (
        <View style={{ marginBottom: space.md }}>
          <SectionTitle
            right={
              <Pressable testID="grocery-clear" accessibilityRole="button" onPress={() => clearTicked(cid, items).catch(() => toast(gentleError.save))} hitSlop={8}>
                <Row gap={4}>
                  <Trash color={c.textMuted} size={14} />
                  <T variant="small" muted>
                    Clear
                  </T>
                </Row>
              </Pressable>
            }>
            In the trolley
          </SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {inTrolley.map((i) => (
              <ItemRow key={i.id} item={i} who={by(i)} onToggle={() => toggle(i)} onRemove={() => remove(i)} />
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
