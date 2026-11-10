/**
 * On the web: a friendly nudge to install KiTA on the home screen, then to
 * turn on notifications. Shows at most one card, and "Not now" is remembered
 * on this device for two weeks.
 */
import { Bell, Download, Plus, Share, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { isIos, isStandalone, turnOnWebPush, webPushState, type WebPushState } from '@/lib/web-push';
import { space, useTheme } from '@/theme';

const SNOOZE_KEY = 'kita.nudgeSnoozedUntil';
const TWO_WEEKS = 14 * 86_400_000;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
declare global {
  interface Window {
    __kitaInstallPrompt?: InstallEvent;
  }
}

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + TWO_WEEKS));
  } catch {
    // Private mode: it just shows again next time.
  }
}

type Nudge = 'install-android' | 'install-ios' | 'notifications' | null;

export function InstallBanner() {
  const { c } = useTheme();
  const { uid } = useSession();
  const { toast } = useFeedback();
  const [nudge, setNudge] = useState<Nudge>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || snoozed()) return;
    let alive = true;
    const decide = async () => {
      if (!isStandalone()) {
        if (window.__kitaInstallPrompt) return alive && setNudge('install-android');
        if (isIos()) return alive && setNudge('install-ios');
      }
      const state: WebPushState = await webPushState();
      if (alive) setNudge(state === 'off' ? 'notifications' : null);
    };
    decide();
    window.addEventListener('kita-installable', decide);
    return () => {
      alive = false;
      window.removeEventListener('kita-installable', decide);
    };
  }, []);

  if (!nudge) return null;

  const close = () => {
    snooze();
    setNudge(null);
  };

  async function install() {
    const e = window.__kitaInstallPrompt;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__kitaInstallPrompt = undefined;
    if (outcome === 'accepted') toast('KiTA is on your home screen. Open it from there.');
    setNudge(null);
  }

  async function notify() {
    if (!uid) return;
    setBusy(true);
    try {
      const s = await turnOnWebPush(uid);
      toast(s === 'on' ? 'Notifications are on. Hugs and notes will reach you.' : s === 'blocked' ? 'Notifications are blocked in your browser settings.' : 'Notifications stay off for now.');
      setNudge(null);
    } catch {
      toast('That didn’t work just now. You can try again in Settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card tone="lavender">
        <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            {nudge === 'notifications' ? <Bell color={c.primary} size={22} /> : <Download color={c.primary} size={22} />}
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="bodyStrong">{nudge === 'notifications' ? 'Never miss a hug' : 'Put KiTA on your home screen'}</T>
            {nudge === 'install-ios' ? (
              <View style={{ gap: space.xs }}>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <T variant="small">1. Tap</T>
                  <Share color={c.primary} size={16} />
                  <T variant="small">Share at the bottom of Safari</T>
                </Row>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <T variant="small">2. Choose</T>
                  <Plus color={c.primary} size={16} />
                  <T variant="small" style={{ fontFamily: 'Raleway_600SemiBold' }}>
                    Add to Home Screen
                  </T>
                </Row>
                <T variant="small" muted>
                  Then open KiTA from its icon. It opens full screen, like an app, and can show notifications.
                </T>
              </View>
            ) : (
              <T variant="small" muted>
                {nudge === 'notifications'
                  ? 'Turn on notifications so love notes, hugs and today’s question reach you, even when KiTA is closed.'
                  : 'It opens full screen like an app, starts faster, and can show notifications.'}
              </T>
            )}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={close} hitSlop={10} style={{ padding: 4 }}>
            <X color={c.textMuted} size={20} />
          </Pressable>
        </Row>
        {nudge !== 'install-ios' ? (
          <>
            <Gap h={space.md} />
            <Button
              testID={nudge === 'notifications' ? 'nudge-notifications' : 'nudge-install'}
              small
              icon={nudge === 'notifications' ? Bell : Download}
              label={nudge === 'notifications' ? 'Turn on notifications' : 'Install KiTA'}
              loading={busy}
              onPress={nudge === 'notifications' ? notify : install}
            />
          </>
        ) : null}
      </Card>
      <Gap />
    </>
  );
}
