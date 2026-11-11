/** A plain, readable legal page: title, date, sections, and how to get in touch. */
import { Mail } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { CONTACT_EMAIL, LEGAL_UPDATED, type LegalSection } from '@/lib/legal';
import { space, useTheme } from '@/theme';

import { Button, Gap, Screen, T } from './ui';

export function LegalPage({ title, sections, testID }: { title: string; sections: LegalSection[]; testID?: string }) {
  const { c } = useTheme();
  return (
    <Screen edges={['bottom']}>
      <View testID={testID} style={{ gap: space.xs }}>
        <T variant="display" accessibilityRole="header">
          {title}
        </T>
        <T variant="small" muted>
          Last updated {LEGAL_UPDATED}
        </T>
      </View>
      <Gap />
      {sections.map((s) => (
        <View key={s.title} style={{ marginBottom: space.lg, gap: space.sm }}>
          <T variant="heading" accessibilityRole="header">
            {s.title}
          </T>
          {s.body.map((p) => (
            <T key={p} selectable style={{ color: c.text }}>
              {p}
            </T>
          ))}
        </View>
      ))}
      <Button kind="soft" small icon={Mail} label={`Email ${CONTACT_EMAIL}`} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=KiTA`).catch(() => {})} />
    </Screen>
  );
}
