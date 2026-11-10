/** Steps from iPhone: Apple Health → an iPhone Shortcut → KiTA. */
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Footprints, Link2, RefreshCw, Smartphone, Timer, Unlink } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { useSession } from '@/lib/session';
import { startStepsSync, stopStepsSync, useStepsSync } from '@/lib/steps-sync';
import { radius, space, useTheme } from '@/theme';

function when(ts: { toDate(): Date } | null | undefined): string {
  if (!ts) return '';
  const d = ts.toDate();
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return today ? `today, ${time}` : `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

/** One numbered instruction. Bold words are wrapped in *stars*. */
function Step({ n, children }: { n: number; children: string }) {
  const { c } = useTheme();
  const parts = children.split('*');
  return (
    <Row gap={space.md} style={{ alignItems: 'flex-start', marginBottom: space.md }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="label" color={c.primary}>
          {n}
        </T>
      </View>
      <T style={{ flex: 1 }}>
        {parts.map((p, i) =>
          i % 2 ? (
            <T key={i} variant="bodyStrong">
              {p}
            </T>
          ) : (
            p
          ),
        )}
      </T>
    </Row>
  );
}

export default function StepsSyncScreen() {
  const { c } = useTheme();
  const { uid } = useSession();
  const { toast } = useFeedback();
  const sync = useStepsSync(uid);
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy('start');
    try {
      await startStepsSync();
      setCopied(false);
      toast('Your link is ready. Copy it into the Shortcut.');
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setBusy('stop');
    try {
      await stopStepsSync();
      toast('Steps sync is off. The old link no longer works.');
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      toast('Copied.');
    } catch {
      toast('Couldn’t copy. Press and hold the link to copy it instead.');
    }
  }

  return (
    <Screen edges={['bottom']}>
      <T muted>
        Your iPhone already counts your steps in the Health app. A small Shortcut sends today’s total to KiTA on its own, every
        evening, so you never type it in.
      </T>
      <Gap />

      <Card tone={sync ? 'sage' : 'lavender'}>
        <Row gap={space.md}>
          <Footprints color={sync ? c.onSage : c.primary} size={26} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" color={sync ? c.onSage : c.text}>
              {sync === undefined ? 'Checking…' : sync ? 'Steps sync is on' : 'Steps sync is off'}
            </T>
            <T variant="small" color={sync ? c.onSage : c.textMuted}>
              {sync?.lastSyncAt
                ? `Last sync ${when(sync.lastSyncAt)} · ${sync.lastSteps?.toLocaleString() ?? 0} steps`
                : sync
                  ? 'Waiting for the first sync from your Shortcut.'
                  : 'Make your link, then set up the Shortcut below. About 5 minutes, once.'}
            </T>
          </View>
        </Row>
      </Card>
      <Gap />

      <SectionTitle right={<Link2 color={c.textMuted} size={18} />}>1 · Your private link</SectionTitle>
      <Card>
        {sync?.url ? (
          <>
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.md }}>
              <T variant="small" selectable testID="steps-link">
                {sync.url}
              </T>
            </View>
            <Gap h={space.md} />
            <Button testID="copy-steps-link" small icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy link'} onPress={() => copy(sync.url)} />
            <Gap h={space.sm} />
            <T variant="small" muted>
              This link can only update your step count (and your location, if you share it in Find my partner). Keep it to yourself. If you think someone else has it, make a new one: the old one stops
              working straight away.
            </T>
            <Gap h={space.sm} />
            <Button small kind="ghost" icon={RefreshCw} label="Make a new link" loading={busy === 'start'} onPress={start} />
          </>
        ) : (
          <Button testID="start-steps-sync" icon={Link2} label="Make my link" loading={busy === 'start'} disabled={sync === undefined} onPress={start} />
        )}
      </Card>
      <Gap />

      <SectionTitle right={<Smartphone color={c.textMuted} size={18} />}>2 · Make the Shortcut</SectionTitle>
      <Card>
        <Step n={1}>Open the *Shortcuts* app on your iPhone and tap *+* to make a new shortcut. Name it *KiTA steps*.</Step>
        <Step n={2}>
          Add the action *Find Health Samples*. Set *Type* to *Steps*, tap *Add Filter* and choose *Start Date is Today*, then set *Group By* to
          *Day*.
        </Step>
        <Step n={3}>Add *Calculate Statistics* and choose *Sum*.</Step>
        <Step n={4}>
          Add *Get Contents of URL*. Paste your link, type *&steps=* at the very end, then tap the variable bar and insert *Statistics*.
        </Step>
        <Step n={5}>Optional: add *Show Notification* and insert *Contents of URL*, so you see “Synced … steps”.</Step>
        <Step n={6}>Tap ▶︎ to try it. Allow access to Health when asked. Your steps appear in KiTA within seconds.</Step>
      </Card>
      <Gap />

      <SectionTitle right={<Timer color={c.textMuted} size={18} />}>3 · Make it automatic</SectionTitle>
      <Card>
        <Step n={1}>In Shortcuts, open the *Automation* tab and tap *+*.</Step>
        <Step n={2}>Choose *Time of Day*, set *9:00 PM*, *Daily*, and pick *Run Immediately*.</Step>
        <Step n={3}>Choose *KiTA steps*. Done. Add a second one at *1:00 PM* if you’d like an update during the day.</Step>
        <T variant="small" muted>
          You can also run KiTA steps any time from the Shortcuts app, a home screen icon or Siri. Each run replaces today’s number with
          the latest total from Health.
        </T>
      </Card>

      {sync ? (
        <>
          <Gap />
          <Button testID="stop-steps-sync" kind="quiet" small icon={Unlink} label="Turn off steps sync" loading={busy === 'stop'} onPress={stop} />
        </>
      ) : null}
    </Screen>
  );
}
