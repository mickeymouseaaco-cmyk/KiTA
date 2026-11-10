import { getRandomBytes } from 'expo-crypto';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from './firebase';
import type { Invite } from './types';

// No 0/O/1/I/L, so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_HOURS = 48;

export function newInviteCode(): string {
  const bytes = getRandomBytes(6);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function inviteLink(code: string): string {
  return `together://pair?code=${code}`;
}

export async function createInvite(uid: string, fromName: string): Promise<string> {
  const code = newInviteCode();
  await setDoc(doc(db, 'invites', code), {
    fromUid: uid,
    fromName,
    status: 'open',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_HOURS * 3600_000),
  });
  return code;
}

export async function cancelInvite(code: string): Promise<void> {
  await updateDoc(doc(db, 'invites', code), { status: 'cancelled' });
}

export type InviteLookup =
  | { ok: true; invite: Invite }
  | { ok: false; reason: 'missing' | 'expired' | 'used' | 'self' };

export async function lookupInvite(code: string, myUid: string): Promise<InviteLookup> {
  const snap = await getDoc(doc(db, 'invites', code));
  if (!snap.exists()) return { ok: false, reason: 'missing' };
  const invite = snap.data() as Invite;
  if (invite.fromUid === myUid) return { ok: false, reason: 'self' };
  if (invite.status !== 'open') return { ok: false, reason: 'used' };
  if (invite.expiresAt.toMillis() < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, invite };
}

/**
 * The invited partner accepts. Runs on the server (acceptInvite) in one
 * transaction: it checks the code and that neither of you is already in a
 * couple, then creates the couple and both memberships together.
 */
export async function acceptInvite(code: string): Promise<string> {
  const res = await httpsCallable<{ code: string }, { coupleId: string }>(functions, 'acceptInvite')({ code });
  return res.data.coupleId;
}

/**
 * Either partner can unlink, any time. Sharing stops for both at once; what you
 * shared is kept 30 days in case you both want to reconnect, then deleted.
 */
export async function unpair(): Promise<void> {
  await httpsCallable(functions, 'unlinkCouple')({});
}

/** Ask to reconnect. It happens only when both of you have asked, within 30 days. */
export async function requestReconnect(): Promise<'waiting' | 'reconnected'> {
  const res = await httpsCallable<Record<string, never>, { state: 'waiting' | 'reconnected' }>(functions, 'requestReconnect')({});
  return res.data.state;
}

/** The server's own gentle words when it says no, or our fallback for anything else. */
export function friendlyError(e: unknown, fallback: string): string {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const ours = code.startsWith('functions/') && !['functions/internal', 'functions/unavailable', 'functions/unknown'].includes(code);
  return ours && err?.message ? err.message : fallback;
}
