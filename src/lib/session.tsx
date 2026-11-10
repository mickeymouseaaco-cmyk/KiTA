/**
 * Session: who am I, who is my partner, and are we connected?
 * Everything else in the app reads from here.
 */
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth, db, isFirebaseConfigured } from './firebase';
import { DEFAULT_SHARE, type Couple, type UserProfile } from './types';

export type SessionStatus = 'loading' | 'unconfigured' | 'signedOut' | 'needsPair' | 'paired';

export type Session = {
  status: SessionStatus;
  user: User | null;
  uid: string | null;
  profile: UserProfile | null;
  cid: string | null;
  couple: Couple | null;
  partnerId: string | null;
  partnerName: string;
  myName: string;
  /** After an unlink, within 30 days: the couple you could reconnect with. */
  ended: EndedCouple | null;
};

export type EndedCouple = {
  cid: string;
  partnerName: string;
  /** When the shared space is deleted for good. */
  purgeAfterMs: number;
  iAsked: boolean;
  theyAsked: boolean;
};

const SessionContext = createContext<Session | null>(null);

export async function createProfile(uid: string, displayName: string) {
  await setDoc(doc(db, 'users', uid), {
    displayName,
    coupleId: null,
    notificationsPaused: false,
    pushTokens: [],
    stepGoal: 8000,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'users', uid, 'settings', 'share'), { ...DEFAULT_SHARE, updatedAt: serverTimestamp() });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // Async results are stored with the key they belong to, so a stale value is
  // simply ignored instead of being reset inside an effect.
  const [profileState, setProfileState] = useState<{ uid: string; value: UserProfile | null } | null>(null);
  const [coupleState, setCoupleState] = useState<{ cid: string; value: Couple | null } | null>(null);
  const profile: UserProfile | null | undefined =
    user === null ? null : user && profileState?.uid === user.uid ? profileState.value : undefined;

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // My profile
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => setProfileState({ uid, value: snap.exists() ? (snap.data() as UserProfile) : null }),
      () => setProfileState({ uid, value: null }),
    );
  }, [user]);

  // Our couple. If it ends or disappears (either of us unlinked), we're simply
  // no longer paired; the server has already cleared both pointers.
  const coupleId = profile?.coupleId ?? null;
  const couple: Couple | null | undefined = !coupleId
    ? null
    : coupleState?.cid === coupleId
      ? coupleState.value
      : undefined;
  useEffect(() => {
    if (!user || !coupleId) return;
    const gone = () => setCoupleState({ cid: coupleId, value: null });
    return onSnapshot(
      doc(db, 'couples', coupleId),
      (snap) => {
        const c = snap.exists() ? (snap.data() as Couple) : null;
        if (c && (c.status ?? 'active') === 'active') setCoupleState({ cid: coupleId, value: c });
        else gone();
      },
      gone,
    );
  }, [user, coupleId]);

  // After an unlink: the couple we could still reconnect with (30 days).
  const lastCoupleId = !coupleId ? (profile?.lastCoupleId ?? null) : null;
  const [endedState, setEndedState] = useState<{ cid: string; value: Couple | null } | null>(null);
  useEffect(() => {
    if (!user || !lastCoupleId) return;
    return onSnapshot(
      doc(db, 'couples', lastCoupleId),
      (snap) => setEndedState({ cid: lastCoupleId, value: snap.exists() ? (snap.data() as Couple) : null }),
      () => setEndedState({ cid: lastCoupleId, value: null }),
    );
  }, [user, lastCoupleId]);
  const endedCouple = lastCoupleId && endedState?.cid === lastCoupleId ? endedState.value : null;

  const value = useMemo<Session>(() => {
    const uid = user?.uid ?? null;
    const partnerId = couple && uid ? (couple.members.find((m) => m !== uid) ?? null) : null;
    let status: SessionStatus;
    if (!isFirebaseConfigured) status = 'unconfigured';
    else if (user === undefined) status = 'loading';
    else if (user === null) status = 'signedOut';
    else if (profile === undefined) status = 'loading';
    else if (profile === null) status = 'signedOut'; // signed in but profile not created yet
    else if (profile.coupleId && couple === undefined) status = 'loading';
    else if (couple && partnerId) status = 'paired';
    else status = 'needsPair';

    return {
      status,
      user: user ?? null,
      uid,
      profile: profile ?? null,
      cid: status === 'paired' ? coupleId : null,
      couple: couple ?? null,
      partnerId,
      partnerName: (partnerId && couple?.names[partnerId]) || 'your partner',
      myName: profile?.displayName ?? '',
      ended: endedFor(endedCouple, lastCoupleId, uid),
    };
  }, [user, profile, couple, coupleId, endedCouple, lastCoupleId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}

/** For screens that only render when paired (inside the tabs). */
export function usePaired() {
  const s = useSession();
  return {
    ...s,
    uid: s.uid as string,
    cid: s.cid as string,
    partnerId: s.partnerId as string,
  };
}

/** The reconnect offer, while it still stands. */
function endedFor(c: Couple | null, cid: string | null, uid: string | null): EndedCouple | null {
  if (!c || !cid || !uid || c.status !== 'ended' || !c.purgeAfter) return null;
  const purgeAfterMs = c.purgeAfter.toMillis();
  if (purgeAfterMs < Date.now()) return null;
  const partner = c.members.find((m) => m !== uid);
  const asked = c.reconnect ?? [];
  return {
    cid,
    partnerName: (partner && c.names[partner]) || 'your partner',
    purgeAfterMs,
    iAsked: asked.includes(uid),
    theyAsked: !!partner && asked.includes(partner),
  };
}
