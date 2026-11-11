import { Lock, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Card, Gap, Row, Screen, SectionTitle, T, ToggleRow } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { setShareCategory, useShareSettings } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import type { ShareCategory } from '@/lib/types';
import { space, useTheme } from '@/theme';

const ROWS: { key: ShareCategory; title: string; detail: string; soon?: boolean }[] = [
  { key: 'steps', title: 'Steps', detail: 'Your step count and weekly chart.' },
  { key: 'mood', title: 'Mood and stress', detail: 'Your emoji, stress level and note. Private by default.' },
  { key: 'food', title: 'Meals', detail: 'What you ate. Never amounts or calories.' },
  { key: 'cycle', title: 'Cycle', detail: 'Today\u2019s phase and symptoms, with gentle ideas for them. Never your dates. Private by default.' },
  { key: 'media', title: 'Photos and voice in logs', detail: 'A selfie or voice note on your mood. Shared only while mood sharing is on too. Turning this off deletes the shared copies.' },
];

export default function Privacy() {
  const { c } = useTheme();
  const { uid, cid, partnerName } = usePaired();
  const share = useShareSettings(uid);
  const { toast } = useFeedback();

  return (
    <Screen edges={['bottom']}>
      <T muted>
        You decide, one thing at a time, what {partnerName} can see. Turning something off removes it from their view straight
        away, including past days.
      </T>
      <Gap />
      <Card>
        {share
          ? ROWS.map((r) => (
              <ToggleRow
                key={r.key}
                testID={`share-${r.key}`}
                title={r.title}
                detail={r.detail}
                value={share[r.key]}
                onChange={async (v) => {
                  try {
                    await setShareCategory({ uid, cid }, r.key, v);
                    toast(v ? `${r.title} now shared with ${partnerName}.` : `${r.title} is just for you now.`);
                  } catch {
                    toast(gentleError.save);
                  }
                }}
              />
            ))
          : null}
      </Card>
      <Gap />
      <SectionTitle>Always private</SectionTitle>
      <Card tone="lavender">
        <View style={{ gap: space.md }}>
          {[
            'Vent notes and recordings never leave your phone.',
            'Evening check-ins stay private unless you add one to your Memory Jar.',
            'Your private journal and media vault are never shared.',
            'Photos and voice notes stay on your phone until you send them or add them to a shared space.',
            'You can take back anything you sent, and it disappears from their view too.',
          ].map((t) => (
            <Row key={t} gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <Lock color={c.primary} size={18} style={{ marginTop: 3 }} />
              <T style={{ flex: 1 }}>{t}</T>
            </Row>
          ))}
        </View>
      </Card>
      <Gap />
      <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
        <ShieldCheck color={c.textMuted} size={18} style={{ marginTop: 2 }} />
        <T variant="small" muted style={{ flex: 1 }}>
          Everything is encrypted in transit and at rest on our servers. Only the two of you can read what you share, and our
          security rules check that on every request.
        </T>
      </Row>
    </Screen>
  );
}
