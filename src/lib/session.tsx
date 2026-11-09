/**
 * Session: who am I, who is my partner, and are we connected?
 * Everything else in the app reads from here.
 */
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth, db, isFirebaseConfigured } from './firebase';
import { DEFAULT_SHARE, type Couple, type Invite, type UserProfile } from './types';

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

  // Our couple. If it disappears (my partner unpaired), clear my pointer gently.
  const coupleId = profile?.coupleId ?? null;
  const couple: Couple | null | undefined = !coupleId
    ? null
    : coupleState?.cid === coupleId
      ? coupleState.value
      : undefined;
  useEffect(() => {
    if (!user || !coupleId) return;
    const gone = () => {
      setCoupleState({ cid: coupleId, value: null });
      updateDoc(doc(db, 'users', user.uid), { coupleId: null }).catch(() => {});
    };
    return onSnapshot(
      doc(db, 'couples', coupleId),
      (snap) => (snap.exists() ? setCoupleState({ cid: coupleId, value: snap.data() as Couple }) : gone()),
      gone,
    );
  }, [user, coupleId]);

  // While unpaired: if an invite I sent was accepted, link my profile to the new couple.
  useEffect(() => {
    if (!user || !profile || profile.coupleId) return;
    const q = query(collection(db, 'invites'), where('fromUid', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const accepted = snap.docs
          .map((d) => d.data() as Invite)
          .filter((i) => i.status === 'accepted' && i.coupleId)
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
        if (accepted?.coupleId) {
          updateDoc(doc(db, 'users', user.uid), { coupleId: accepted.coupleId }).catch(() => {});
        }
      },
      () => {},
    );
  }, [user, profile]);

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
    };
  }, [user, profile, couple, coupleId]);

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
