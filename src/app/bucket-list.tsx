/**
 * Our bucket list: things to do together, big and small: things to do, places
 * to go, food to try, things to learn and things to see. Places can land on
 * the little world map; tick anything off once you've done it together.
 */
import { BookOpen, Check, MapPin, Plus, Sparkles, Ticket, Trash, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Card, Chip, EmptyState, Gap, IconButton, Row, Screen, SectionTitle, T, useInputStyle } from '@/components/ui';
import { WorldMap } from '@/components/world-map';
import { BUCKET_KINDS, bucketSummary, freshIdeas, kindOf, type BucketKind } from '@/lib/bucket-pure';
import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { addPin, removePin, togglePin, useBucket, type BucketPin } from '@/lib/trips';
import { findPlace } from '@/lib/weather';
import { space, useTheme, vivid } from '@/theme';

const KIND_ICON: Record<BucketKind, LucideIcon> = { do: Sparkles, go: MapPin, eat: UtensilsCrossed, learn: BookOpen, watch: Ticket };
const KIND_COLOR: Record<BucketKind, string> = { do: vivid.pink[1], go: vivid.teal[1], eat: vivid.orange[1], learn: vivid.violet[1], watch: vivid.blue[1] };

export default function BucketList() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerName } = usePaired();
  const { toast } = useFeedback();
  const { data: pins, ready } = useBucket(cid);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BucketKind>('do');
  const [filter, setFilter] = useState<BucketKind | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<string | undefined>();

  async function add(text = name, k: BucketKind = kind) {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    try {
      // Only places go on the map.
      const place = k === 'go' ? await findPlace(q).catch(() => null) : null;
      await addPin(cid, uid, { ...(place ?? { name: q }), name: place?.name ?? q, kind: k });
      haptic.success();
      if (k === 'go' && !place) toast('Added. We couldn’t find it on the map, but it’s on your list.');
      if (text === name) setName('');
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  const shown = pins.filter((p) => filter === 'all' || kindOf(p) === filter);
  const todo = shown.filter((p) => !p.visited);
  const done = shown.filter((p) => p.visited);
  const mapped = pins.filter((p) => kindOf(p) === 'go' && typeof p.lat === 'number' && typeof p.lon === 'number');
  const ideas = freshIdeas(pins, filter, 4);
  const hint = BUCKET_KINDS.find((k) => k.id === kind)?.hint ?? '';

  const row = (p: BucketPin) => {
    const k = kindOf(p);
    const Icon = KIND_ICON[k];
    return (
      <Card key={p.id} style={{ paddingVertical: space.md }}>
        <Row gap={space.md}>
          <Pressable
            testID={`pin-${p.name}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: p.visited }}
            accessibilityLabel={`${p.name}${p.visited ? ', done together' : ''}`}
            onPress={() => {
              haptic.tap();
              togglePin(cid, p).catch(() => toast(gentleError.save));
            }}
            style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: p.visited ? '#34C759' : c.border, backgroundColor: p.visited ? '#34C759' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {p.visited ? <Check color="#FFFFFF" size={16} strokeWidth={3} /> : null}
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => (typeof p.lat === 'number' ? setHighlight(p.id) : undefined)} accessibilityRole="text">
            <T variant="bodyStrong" muted={p.visited} style={p.visited ? { textDecorationLine: 'line-through' } : undefined}>
              {p.name}
            </T>
            <Row gap={5} style={{ marginTop: 2 }}>
              <Icon color={KIND_COLOR[k]} size={13} strokeWidth={2.4} />
              <T variant="small" muted style={{ fontSize: 13, lineHeight: 17 }}>
                {BUCKET_KINDS.find((b) => b.id === k)?.label}
                {p.country ? ` · ${p.country}` : ''}
                {p.addedBy === uid ? ' · you' : ` · ${partnerName}`}
              </T>
            </Row>
          </Pressable>
          {p.addedBy === uid ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={8} onPress={() => removePin(cid, p.id)} style={{ padding: 6 }}>
              <Trash color={c.textMuted} size={16} />
            </Pressable>
          ) : null}
        </Row>
      </Card>
    );
  };

  return (
    <Screen edges={['bottom']}>
      <T variant="small" muted>
        {bucketSummary(pins)}
      </T>
      <Gap h={space.sm} />

      {/* Add: pick what kind of thing, then type it. */}
      <Card>
        <T variant="bodyStrong" style={{ marginBottom: space.sm }}>
          Something to do together
        </T>
        <Row gap={space.xs} style={{ flexWrap: 'wrap', marginBottom: space.sm }}>
          {BUCKET_KINDS.map((k) => (
            <Chip key={k.id} testID={`bucket-kind-${k.id}`} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </Row>
        <Row gap={space.sm}>
          <TextInput
            testID="pin-input"
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => add()}
            placeholder={hint}
            placeholderTextColor={c.textMuted}
            style={[input, { flex: 1 }]}
          />
          <IconButton testID="pin-add" icon={Plus} label="Add to the bucket list" tone="primary" onPress={() => add()} disabled={busy || !name.trim()} />
        </Row>
        {ideas.length ? (
          <>
            <T variant="small" muted style={{ marginTop: space.md, marginBottom: space.xs }}>
              Ideas
            </T>
            <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
              {ideas.map((i) => (
                <Chip key={i.text} label={`+ ${i.text}`} onPress={() => add(i.text, i.kind)} />
              ))}
            </Row>
          </>
        ) : null}
      </Card>
      <Gap />

      {/* Filter by kind. */}
      <Row gap={space.xs} style={{ flexWrap: 'wrap', marginBottom: space.sm }}>
        <Chip testID="bucket-filter-all" label={`All ${pins.length ? pins.length : ''}`.trim()} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {BUCKET_KINDS.map((k) => {
          const n = pins.filter((p) => kindOf(p) === k.id).length;
          return n ? <Chip key={k.id} testID={`bucket-filter-${k.id}`} label={`${k.label} ${n}`} selected={filter === k.id} onPress={() => setFilter(k.id)} /> : null;
        })}
      </Row>

      {ready && pins.length === 0 ? <EmptyState icon={Sparkles} line={`What would you and ${partnerName} love to do together one day?`} /> : null}
      <View style={{ gap: space.sm }}>{todo.map(row)}</View>

      {done.length ? (
        <>
          <Gap />
          <SectionTitle>Done together</SectionTitle>
          <View style={{ gap: space.sm }}>{done.map(row)}</View>
        </>
      ) : null}

      {mapped.length ? (
        <>
          <Gap />
          <SectionTitle>Places on our map</SectionTitle>
          <WorldMap pins={mapped.map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon!, visited: p.visited, label: p.name }))} highlight={highlight} />
        </>
      ) : null}
    </Screen>
  );
}
