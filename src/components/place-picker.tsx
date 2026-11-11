/**
 * Choose where the weather is for: your location, any city in the world, or a
 * Malaysian flood-watch area (with official warnings and rivers). Plus °C/°F.
 */
import { Check, LocateFixed, MapPin, Search, Waves } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { AREAS } from '@/lib/flood';
import { haptic } from '@/lib/haptics';
import { cleanPlace, locateMe, searchCities, useUnits, useWeatherPlace, type CitySuggestion, type WeatherPlace } from '@/lib/places';
import { radius, space, useTheme } from '@/theme';

import { Sheet, useFeedback } from './feedback';
import { Row, Segmented, T, useInputStyle } from './ui';

function Option({ icon: Icon, title, detail, selected, onPress, testID, busy }: { icon: typeof MapPin; title: string; detail?: string; selected?: boolean; onPress: () => void; testID?: string; busy?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, busy: !!busy }}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center', backgroundColor: pressed ? c.surfaceAlt : 'transparent' })}>
      <Row gap={space.md}>
        <Icon color={c.text} size={20} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" numberOfLines={1}>
            {title}
          </T>
          {detail ? (
            <T variant="small" muted numberOfLines={1}>
              {detail}
            </T>
          ) : null}
        </View>
        {busy ? <ActivityIndicator color={c.textMuted} /> : selected ? <Check color={c.text} size={18} /> : null}
      </Row>
    </Pressable>
  );
}

export function PlacePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <Sheet visible={visible} onClose={onClose}>{visible ? <PickerBody onClose={onClose} /> : null}</Sheet>;
}

function PickerBody({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { toast } = useFeedback();
  const [place, setPlace] = useWeatherPlace();
  const [units, setUnits] = useUnits();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; list: CitySuggestion[]; failed: boolean } | null>(null);
  const [locating, setLocating] = useState(false);

  // Search as you type, after a short pause.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      searchCities(query)
        .then((list) => alive && setFound({ q: query, list, failed: false }))
        .catch(() => alive && setFound({ q: query, list: [], failed: true }));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const choose = (p: WeatherPlace) => {
    haptic.success();
    setPlace(p);
    onClose();
  };

  async function nearMe() {
    setLocating(true);
    try {
      choose(await locateMe());
    } catch (e) {
      toast((e as Error).message === 'denied' ? 'Location is off for KiTA. Turn it on in your browser or phone settings, or search a city.' : gentleError.load);
    } finally {
      setLocating(false);
    }
  }

  const results = found && found.q === q.trim() ? found : null;

  return (
    <View style={{ gap: space.sm }}>
      <T variant="title" center>
        Weather for…
      </T>
      <Option testID="place-near-me" icon={LocateFixed} title="My location" detail={place?.kind === 'here' ? place.name : 'Uses your location once, when you tap'} selected={place?.kind === 'here'} busy={locating} onPress={nearMe} />
      <View style={{ position: 'relative' }}>
        <TextInput
          testID="place-search"
          value={q}
          onChangeText={setQ}
          placeholder="Search any city"
          placeholderTextColor={c.textMuted}
          autoCorrect={false}
          accessibilityLabel="Search any city"
          style={[input, { paddingLeft: 44 }]}
        />
        <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' }}>
          <Search color={c.textMuted} size={18} />
        </View>
      </View>
      {results?.list.map((r) => (
        <Option
          key={`${r.lat},${r.lon}`}
          testID={`place-result-${r.name}`}
          icon={MapPin}
          title={r.name}
          detail={[r.region, r.country].filter(Boolean).join(', ')}
          onPress={() => choose(cleanPlace({ kind: 'city', name: r.name, country: r.country, lat: r.lat, lon: r.lon })!)}
        />
      ))}
      {results && !results.list.length ? (
        <T variant="small" muted center>
          {results.failed ? 'Search isn’t answering right now. Try again in a moment.' : `No places called “${results.q}”. Try another spelling.`}
        </T>
      ) : null}
      {place?.kind === 'city' && !q ? <Option icon={MapPin} title={place.name} detail={place.country} selected onPress={onClose} /> : null}

      <T variant="label" muted style={{ marginTop: space.sm, marginLeft: space.md }}>
        MALAYSIA FLOOD WATCH
      </T>
      {AREAS.map((a) => (
        <Option
          key={a.id}
          testID={`place-area-${a.id}`}
          icon={Waves}
          title={a.name}
          detail="Weather, MET warnings and river levels"
          selected={place?.kind === 'area' && place.id === a.id}
          onPress={() => choose({ kind: 'area', id: a.id })}
        />
      ))}

      <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
        <T variant="bodyStrong">Units</T>
        <View style={{ width: 160 }}>
          <Segmented
            value={units}
            onChange={setUnits}
            options={[
              { value: 'C', label: '°C' },
              { value: 'F', label: '°F' },
            ]}
          />
        </View>
      </Row>
    </View>
  );
}
