/** Shared bucket list: places you dream of, pinned on a soft offline map. */
import { Check, MapPin, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Card, EmptyState, Gap, IconButton, Row, Screen, T, useInputStyle } from '@/components/ui';
import { WorldMap } from '@/components/world-map';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { addPin, removePin, togglePin, useBucket } from '@/lib/trips';
import { findPlace } from '@/lib/weather';
import { space, useTheme } from '@/theme';

export default function BucketList() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const { data: pins, ready } = useBucket(cid);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<string | undefined>();

  async function add() {
    const q = name.trim();
    if (!q) return;
    setBusy(true);
    try {
      const place = await findPlace(q).catch(() => null);
      await addPin(cid, uid, place ?? { name: q });
      haptic.success();
      if (!place) toast('Added. We couldn’t find it on the map, but it’s on your list.');
      setName('');
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  const mapped = pins.filter((p) => typeof p.lat === 'number' && typeof p.lon === 'number');

  return (
    <Screen edges={['bottom']}>
      <WorldMap pins={mapped.map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, visited: p.visited, label: p.name }))} highlight={highlight} />
      <Row gap={space.lg} style={{ justifyContent: 'center', marginTop: space.sm }}>
        <Row gap={6}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.heart }} />
          <T variant="small" muted>
            Dreaming of
          </T>
        </Row>
        <Row gap={6}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.ring }} />
          <T variant="small" muted>
            Been there together
          </T>
        </Row>
      </Row>
      <Gap />
      <Row gap={space.sm}>
        <TextInput
          testID="pin-input"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          placeholder="Kyoto, the Northern Lights…"
          placeholderTextColor={c.textMuted}
          style={[input, { flex: 1 }]}
        />
        <IconButton testID="pin-add" icon={Plus} label="Add place" tone="primary" onPress={add} disabled={busy} />
      </Row>
      <Gap />
      {ready && pins.length === 0 ? <EmptyState icon={MapPin} line={`Where would you and ${partnerName} love to go one day?`} /> : null}
      <View style={{ gap: space.sm }}>
        {pins.map((p) => (
          <Card key={p.id} style={{ paddingVertical: space.md }}>
            <Row gap={space.md}>
              <Pressable
                testID={`pin-${p.name}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: p.visited }}
                accessibilityLabel={`${p.name}${p.visited ? ', visited' : ''}`}
                onPress={() => {
                  haptic.tap();
                  togglePin(cid, p).catch(() => toast(gentleError.save));
                }}
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: p.visited ? c.ring : c.heart, backgroundColor: p.visited ? c.ring : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {p.visited ? <Check color={c.surface} size={16} strokeWidth={3} /> : null}
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => setHighlight(p.id)} accessibilityRole="button" accessibilityHint="Highlight on the map">
                <T variant="bodyStrong">{p.name}</T>
                <T variant="small" muted>
                  {p.country ?? (typeof p.lat === 'number' ? '' : 'Not on the map')}
                  {p.addedBy === uid ? ' · added by you' : ` · added by ${partnerName}`}
                </T>
              </Pressable>
              {p.addedBy === uid ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={8} onPress={() => removePin(cid, p.id)} style={{ padding: 6 }}>
                  <Trash color={c.textMuted} size={16} />
                </Pressable>
              ) : null}
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
