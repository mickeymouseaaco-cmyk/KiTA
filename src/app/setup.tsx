import { Settings } from 'lucide-react-native';

import { Card, EmptyState, Screen, T } from '@/components/ui';

/** Shown only to developers when Firebase env vars are missing. */
export default function Setup() {
  return (
    <Screen>
      <EmptyState icon={Settings} line="Together needs a Firebase project before it can connect you two." />
      <Card tone="lavender">
        <T variant="bodyStrong">Developer setup</T>
        <T muted>
          Copy .env.example to .env and fill in your Firebase web config, or set EXPO_PUBLIC_USE_EMULATORS=1 and
          run the local emulators. See the README for details.
        </T>
      </Card>
    </Screen>
  );
}
