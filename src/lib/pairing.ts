import { getRandomBytes } from 'expo-crypto';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase';
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
 * The invited partner accepts. The couple doc and the invite update are written
 * in one batch, and the security rules verify the pair (see firestore.rules).
 */
export async function acceptInvite(code: string, invite: Invite, myUid: string, myName: string): Promise<string> {
  const coupleRef = doc(collection(db, 'couples'));
  const batch = writeBatch(db);
  batch.set(coupleRef, {
    members: [invite.fromUid, myUid],
    names: { [invite.fromUid]: invite.fromName, [myUid]: myName },
    createdAt: serverTimestamp(),
    createdBy: myUid,
    inviteCode: code,
  });
  batch.update(doc(db, 'invites', code), { status: 'accepted', acceptedBy: myUid, coupleId: coupleRef.id });
  await batch.commit();
  await updateDoc(doc(db, 'users', myUid), { coupleId: coupleRef.id });
  return coupleRef.id;
}

/** Either partner can unpair. All shared data becomes unreadable immediately. */
export async function unpair(cid: string, myUid: string): Promise<void> {
  await deleteDoc(doc(db, 'couples', cid));
  await updateDoc(doc(db, 'users', myUid), { coupleId: null });
}
