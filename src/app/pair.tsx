import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Copy, HeartHandshake, Link2, Share2, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Field, Gap, Row, Screen, Segmented, T, useInputStyle } from '@/components/ui';
import { gentleError } from '@/lib/copy';
import { auth, db } from '@/lib/firebase';
import { acceptInvite, cancelInvite, createInvite, inviteLink, lookupInvite, normalizeCode } from '@/lib/pairing';
import { useSession } from '@/lib/session';
import type { Invite } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

export default function Pair() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [mode, setMode] = useState<'invite' | 'join'>(params.code ? 'join' : 'invite');

  return (
    <Screen edges={['top', 'bottom']}>
      <Gap h={space.xl} />
      <T variant="display" accessibilityRole="header">
        Connect with your partner
      </T>
      <Gap h={space.sm} />
      <T muted>Nothing is shared until your partner accepts. You can unpair any time.</T>
      <Gap h={space.xl} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'invite', label: 'Invite them' },
          { value: 'join', label: 'I have a code' },
        ]}
      />
      <Gap h={space.xl} />
      {mode === 'invite' ? <InvitePanel /> : <JoinPanel initialCode={params.code} />}
      <Gap h={space.xxl} />
      <Button label="Sign out" kind="ghost" small onPress={() => signOut(auth)} />
    </Screen>
  );
}

function InvitePanel() {
  const { c } = useTheme();
  const { uid, myName } = useSession();
  const { toast } = useFeedback();
  const [open, setOpen] = useState<{ code: string; invite: Invite } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'invites'), where('fromUid', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const live = snap.docs
          .map((d) => ({ code: d.id, invite: d.data() as Invite }))
          .filter((x) => x.invite.status === 'open' && x.invite.expiresAt.toMillis() > Date.now())
          .sort((a, b) => b.invite.createdAt.toMillis() - a.invite.createdAt.toMillis());
        setOpen(live[0] ?? null);
      },
      () => {},
    );
  }, [uid]);

  async function make() {
    if (!uid) return;
    setBusy(true);
    try {
      await createInvite(uid, myName || 'Your partner');
    } catch {
      toast(gentleError.send);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Card tone="lavender">
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <HeartHandshake color={c.primary} size={28} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="heading">Make an invite</T>
            <T muted>You&apos;ll get a short code and a link to send your partner. It works for 48 hours.</T>
          </View>
        </Row>
        <Gap h={space.lg} />
        <Button testID="create-invite" label="Create invite" icon={Link2} onPress={make} loading={busy} />
      </Card>
    );
  }

  const link = inviteLink(open.code);
  return (
    <Card>
      <T variant="label" muted center>
        YOUR INVITE CODE
      </T>
      <Gap h={space.sm} />
      <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, paddingVertical: space.lg }}>
        <T
          testID="invite-code"
          center
          selectable
          accessibilityLabel={`Invite code ${open.code.split('').join(' ')}`}
          style={{ fontFamily: 'Lora_600SemiBold', fontSize: 38, lineHeight: 46, letterSpacing: 8, color: c.primary }}>
          {open.code}
        </T>
      </View>
      <Gap h={space.lg} />
      <Row gap={space.sm}>
        <Button
          small
          kind="soft"
          label="Copy"
          icon={Copy}
          style={{ flex: 1 }}
          onPress={async () => {
            await Clipboard.setStringAsync(open.code);
            toast('Copied. Send it however feels easiest.');
          }}
        />
        <Button
          small
          label="Share link"
          icon={Share2}
          style={{ flex: 1 }}
          onPress={() =>
            Share.share({ message: `Join me on Together ♥ Open ${link} or enter the code ${open.code}` }).catch(() => {})
          }
        />
      </Row>
      <Gap h={space.lg} />
      <T muted center accessibilityLiveRegion="polite">
        Waiting for your partner to accept. We&apos;ll bring you in as soon as they do.
      </T>
      <Gap h={space.md} />
      <Button label="Cancel this invite" kind="ghost" small onPress={() => cancelInvite(open.code).catch(() => toast(gentleError.save))} />
    </Card>
  );
}

function JoinPanel({ initialCode }: { initialCode?: string }) {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, myName } = useSession();
  const { toast } = useFeedback();
  const [code, setCode] = useState(normalizeCode(initialCode ?? ''));
  const [found, setFound] = useState<Invite | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function look() {
    if (!uid) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await lookupInvite(code, uid);
      if (res.ok) setFound(res.invite);
      else
        setMessage(
          res.reason === 'self'
            ? 'That’s your own invite. Send it to your partner instead.'
            : res.reason === 'expired'
              ? 'That invite has expired. Ask your partner for a fresh one.'
              : res.reason === 'used'
                ? 'That invite has already been used.'
                : gentleError.code,
        );
    } catch {
      setMessage(gentleError.load);
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!uid || !found) return;
    setBusy(true);
    try {
      await acceptInvite(code, found, uid, myName || 'Your partner');
    } catch {
      toast(gentleError.send);
      setBusy(false);
    }
  }

  if (found) {
    return (
      <Card tone="lavender">
        <T variant="title" center>
          {found.fromName} would like to connect
        </T>
        <Gap h={space.lg} />
        <View style={{ gap: space.md }}>
          {[
            'You’ll each see only what the other chooses to share.',
            'Mood and cycle stay private unless you turn them on.',
            'Vent notes and your private journal are never shared.',
            'Either of you can unpair at any time.',
          ].map((line) => (
            <Row key={line} gap={space.sm} style={{ alignItems: 'flex-start' }}>
              <ShieldCheck color={c.primary} size={20} style={{ marginTop: 2 }} />
              <T style={{ flex: 1 }}>{line}</T>
            </Row>
          ))}
        </View>
        <Gap h={space.xl} />
        <Button testID="accept-invite" label={`Accept and connect`} onPress={accept} loading={busy} />
        <Gap h={space.sm} />
        <Button label="Not now" kind="ghost" onPress={() => setFound(null)} />
      </Card>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <Field label="Invite code" helper="Six letters and numbers, from your partner.">
        <TextInput
          testID="join-code"
          value={code}
          onChangeText={(t) => setCode(normalizeCode(t))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC234"
          placeholderTextColor={c.textMuted}
          style={[input, { fontSize: 24, letterSpacing: 6, textAlign: 'center' }]}
        />
      </Field>
      {message ? (
        <T accessibilityLiveRegion="polite" color={c.onButter} style={{ backgroundColor: c.butter, padding: space.md, borderRadius: 12 }}>
          {message}
        </T>
      ) : null}
      <Button testID="find-invite" label="Find invite" onPress={look} loading={busy} disabled={code.length !== 6} />
    </View>
  );
}
