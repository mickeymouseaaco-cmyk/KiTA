/**
 * Shah Alam City Council's live flood map (MBSA iLensa), right inside the
 * weather page: water levels, flood spots and road closures as the council
 * sees them. On the web it shows in the page; "Open full map" always opens the
 * council's own site in the in-app browser, for zooming around or if the
 * council's site won't show inside another app.
 */
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Map as MapIcon } from 'lucide-react-native';
import { createElement, useState, type ElementType } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button, Card, Row, T } from './ui';

export const MBSA_FLOOD_MAP = 'https://ilensa.mbsa.gov.my/maps';

function openMap() {
  if (Platform.OS === 'web') {
    window.open(MBSA_FLOOD_MAP, '_blank', 'noopener');
    return;
  }
  WebBrowser.openBrowserAsync(MBSA_FLOOD_MAP).catch(() => Linking.openURL(MBSA_FLOOD_MAP));
}

export function FloodMapCard() {
  const { c } = useTheme();
  const [loaded, setLoaded] = useState(false);
  return (
    <Card>
      <View testID="flood-map" />
      <Row gap={8}>
        <MapIcon color={c.primary} size={18} />
        <T variant="bodyStrong" style={{ flex: 1 }}>
          Live flood map · Shah Alam
        </T>
      </Row>
      <T variant="small" muted style={{ marginTop: 4 }}>
        MBSA iLensa: the council’s own map of water levels, flood spots and road closures.
      </T>
      {Platform.OS === 'web' ? (
        <View style={{ height: 420, borderRadius: 18, overflow: 'hidden', marginTop: 12, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }}>
          {createElement('iframe' as unknown as ElementType, {
            src: MBSA_FLOOD_MAP,
            title: 'MBSA iLensa live flood map',
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
            allow: 'geolocation; fullscreen',
            onLoad: () => setLoaded(true),
            style: { border: 0, width: '100%', height: '100%' },
          })}
          {!loaded ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
              <ActivityIndicator color={c.primary} />
              <T variant="small" muted>
                Loading the council’s map…
              </T>
            </View>
          ) : null}
        </View>
      ) : null}
      <Row gap={8} style={{ marginTop: 12, alignItems: 'center' }}>
        <Button testID="flood-map-open" small kind="soft" icon={ExternalLink} label="Open full map" onPress={openMap} />
        <T variant="small" muted style={{ flex: 1, fontSize: 12, lineHeight: 16 }}>
          {Platform.OS === 'web' ? 'Blank above? Open the full map instead.' : 'Opens the council’s live map.'}
        </T>
      </Row>
    </Card>
  );
}
