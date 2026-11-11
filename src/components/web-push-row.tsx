/** Settings → Notifications: turn notifications on or off for this browser / home-screen app. */
import { Bell, BellOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { turnOffWebPush, turnOnWebPush, webPushState, type WebPushState } from '@/lib/web-push';
import { space } from '@/theme';

const LINE: Record<WebPushState, string> = {
  'not-web': '',
  'not-ready': 'Notifications for the web app are being set up. They’ll appear here soon.',
  unsupported: 'This browser can’t show notifications. Chrome, Edge, Firefox and Safari can.',
  'needs-install': 'On iPhone, add KiTA to your Home Screen first (Share → Add to Home Screen), then open it from there.',
  off: 'Surat cinta, hugs and today’s question can reach this device even when KiTA is closed.',
  on: 'On for this device. Surat cinta, hugs and today’s question will reach you here.',
  blocked: 'Notifications are blocked for KiTA in this browser. Allow them in the browser’s site settings, then come back.',
};

export function WebPushRow() {
  const { uid } = useSession();
  const { toast } = useFeedback();
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    webPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (!state || state === 'not-web') return null;

  async function toggle() {
    if (!uid) return;
    setBusy(true);
    try {
      if (state === 'on') {
        await turnOffWebPush(uid);
        setState('off');
        toast('Notifications are off on this device.');
      } else {
        const s = await turnOnWebPush(uid);
        setState(s);
        if (s === 'on') toast('Notifications are on for this device.');
      }
    } catch {
      toast('That didn’t work just now. Let’s try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      <T variant="bodyStrong">Notifications on this device</T>
      <T variant="small" muted>
        {LINE[state]}
      </T>
      {state === 'on' || state === 'off' ? (
        <Button
          testID="web-push-toggle"
          small
          kind={state === 'on' ? 'quiet' : 'soft'}
          icon={state === 'on' ? BellOff : Bell}
          label={state === 'on' ? 'Turn off on this device' : 'Turn on notifications'}
          loading={busy}
          onPress={toggle}
        />
      ) : null}
    </View>
  );
}

/** Keeps this device's notification address fresh. Rendered once, inside the session. */
export function WebPushSync() {
  const { uid } = useSession();
  useEffect(() => {
    if (!uid) return;
    import('@/lib/web-push').then((m) => m.refreshWebPush(uid)).catch(() => {});
  }, [uid]);
  return null;
}
