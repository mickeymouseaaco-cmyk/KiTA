/**
 * Live check of YOUR Firebase project, using the settings in .env.
 *
 *   npm run verify:live
 *
 * Run it after deploying (firebase deploy --only firestore,storage,functions).
 * It creates three temporary accounts (together-check-…@example.com), pairs
 * two of them through the real acceptInvite function in Singapore, checks the
 * rules from the outside, then deletes all three with the real deleteAccount
 * function. Nothing of yours is touched. If App Check enforcement is on, turn
 * it off for the run, or this script will be refused (that's App Check working).
 */
import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { Timestamp, collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getBytes, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import { DEFAULT_SHARE } from '../src/lib/types';

const REQUIRED = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;
const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-southeast1';
const PASSWORD = `Check-${Math.random().toString(36).slice(2)}-9`;
const RUN = Date.now().toString(36);

type Person = { name: string; email: string; uid: string; app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage; call: (fn: string, data?: object) => Promise<Record<string, unknown>> };

const results: { n: string; ok: boolean; note: string }[] = [];
async function check(n: string, what: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ n, ok: true, note: what });
    console.log(`  ✓ ${n}. ${what}`);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    results.push({ n, ok: false, note: `${what}: ${msg}` });
    console.log(`  ✗ ${n}. ${what}\n      ${msg}`);
  }
}
function ensure(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function refused(p: Promise<unknown>, what: string) {
  try {
    await p;
  } catch {
    return;
  }
  throw new Error(`${what} was allowed, but should have been refused`);
}

const config: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

function connect(name: string) {
  const app = initializeApp(config, `${name}-${RUN}`);
  const fns = getFunctions(app, REGION);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    call: async (fn: string, data: object = {}) => (await httpsCallable(fns, fn)(data)).data as Record<string, unknown>,
  };
}

const people: Person[] = [];
async function register(name: string): Promise<Person> {
  const c = connect(name);
  const email = `together-check-${RUN}-${name.toLowerCase()}@example.com`;
  const cred = await createUserWithEmailAndPassword(c.auth, email, PASSWORD);
  const p: Person = { name, email, uid: cred.user.uid, ...c };
  people.push(p);
  await setDoc(doc(p.db, 'users', p.uid), { displayName: name, coupleId: null, notificationsPaused: false, pushTokens: [], stepGoal: 8000, createdAt: serverTimestamp() });
  await setDoc(doc(p.db, 'users', p.uid, 'settings', 'share'), { ...DEFAULT_SHARE, updatedAt: serverTimestamp() });
  return p;
}
async function invite(p: Person) {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  await setDoc(doc(p.db, 'invites', code), { fromUid: p.uid, fromName: p.name, status: 'open', createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 3600_000) });
  return code;
}

async function main() {
  console.log(`\nChecking Firebase project "${config.projectId ?? '(not set)'}" · functions in ${REGION}\n`);
  let a: Person | undefined, b: Person | undefined, c: Person | undefined;
  let cid = '';

  await check('9', 'Environment variables are set', async () => {
    const missing = REQUIRED.filter((k) => !process.env[k]);
    ensure(!missing.length, `missing in .env: ${missing.join(', ')}`);
    const bucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!;
    ensure(/\.(firebasestorage\.app|appspot\.com)$/.test(bucket), `storage bucket "${bucket}" should end in .firebasestorage.app or .appspot.com`);
  });
  if (results.some((r) => !r.ok)) return;

  try {
    await check('1', 'Firebase initialises with your web app settings', async () => {
      const probe = connect('probe');
      ensure(probe.app.options.projectId === config.projectId, 'project id mismatch');
      await deleteApp(probe.app);
    });

    await check('2', 'Registration and sign-in work (Email/Password)', async () => {
      a = await register('Afiq');
      b = await register('Aina');
      c = await register('Casey');
      const again = connect('again');
      await signInWithEmailAndPassword(again.auth, a.email, PASSWORD);
      ensure(again.auth.currentUser?.uid === a.uid, 'signed in as the wrong user');
      await deleteApp(again.app);
      ensure((await getDoc(doc(a.db, 'users', a.uid))).data()?.displayName === 'Afiq', 'profile was not saved');
    });
    if (!a || !b || !c) return;

    await check('3', 'Invitation and linking work through acceptInvite', async () => {
      const code = await invite(a!);
      const res = await b!.call('acceptInvite', { code });
      cid = String(res.coupleId ?? '');
      ensure(cid, 'no couple id returned');
      ensure((await getDoc(doc(a!.db, 'users', a!.uid))).data()?.coupleId === cid, "inviter's couple link not set");
      ensure((await getDoc(doc(b!.db, 'memberships', b!.uid))).data()?.coupleId === cid, 'membership not created');
      await refused(c!.call('acceptInvite', { code }), 'reusing an accepted code');
    });

    await check('4', 'Database structure matches the app', async () => {
      const couple = (await getDoc(doc(a!.db, 'couples', cid))).data();
      ensure(couple, 'couple not readable by its member');
      ensure(JSON.stringify(couple.members) === JSON.stringify([a!.uid, b!.uid]), 'members are wrong');
      ensure(couple.status === 'active', 'couple is not active');
      for (const k of ['names', 'createdAt', 'createdBy', 'inviteCode']) ensure(k in couple, `couple.${k} missing`);
    });

    await check('5', 'Firestore rules protect private and shared data', async () => {
      await refused(getDoc(doc(b!.db, 'users', a!.uid)), 'reading a partner’s private profile');
      await refused(getDoc(doc(c!.db, 'couples', cid)), 'another person reading this couple');
      await refused(getDocs(collection(c!.db, `couples/${cid}/shared`)), 'another person reading shared days');
      await refused(setDoc(doc(b!.db, 'memberships', b!.uid), { coupleId: 'x' }), 'writing a membership');
      const day = `${a!.uid}_2026-11-10`;
      await setDoc(doc(a!.db, `couples/${cid}/shared/${day}`), { ownerId: a!.uid, date: '2026-11-10', steps: 1234 });
      await refused(setDoc(doc(a!.db, `couples/${cid}/shared/${day}`), { ownerId: a!.uid, date: '2026-11-10', mood: { emoji: '😌', label: 'Calm', stress: 2 } }), 'sharing mood while it is switched off');
      ensure((await getDoc(doc(b!.db, `couples/${cid}/shared/${day}`))).data()?.steps === 1234, 'partner cannot read shared steps');
    });

    await check('6', 'Storage rules protect photos', async () => {
      const path = `users/${a!.uid}/avatar/check.jpg`;
      await uploadBytes(ref(a!.storage, path), new Uint8Array([255, 216, 255, 217]), { contentType: 'image/jpeg' });
      await updateDoc(doc(a!.db, 'users', a!.uid), { avatarId: 'check' });
      await getBytes(ref(b!.storage, path));
      await refused(getBytes(ref(c!.storage, path)), 'a stranger opening a profile photo');
      await refused(uploadBytes(ref(b!.storage, `users/${a!.uid}/avatar/x.jpg`), new Uint8Array([1]), { contentType: 'image/jpeg' }), 'uploading into someone else’s folder');
    });

    await check('7', `Cloud Functions run in ${REGION}`, async () => {
      // A call to the same function in another region must not find it.
      const elsewhere = getFunctions(a!.app, 'us-central1');
      await refused(httpsCallable(elsewhere, 'unlinkCouple')({}), 'the function in us-central1');
    });

    await check('8', 'Account deletion cleans up', async () => {
      await signInWithEmailAndPassword(a!.auth, a!.email, PASSWORD);
      await a!.call('deleteAccount');
      people.splice(people.indexOf(a!), 1);
      ensure(!(await getDoc(doc(b!.db, 'memberships', b!.uid))).exists(), 'partner membership still there');
      ensure((await getDoc(doc(b!.db, 'users', b!.uid))).data()?.coupleId === null, 'partner still linked');
      await refused(getDoc(doc(b!.db, 'couples', cid)), 'reading the deleted couple');
      const again = connect('gone');
      await refused(signInWithEmailAndPassword(again.auth, a!.email, PASSWORD), 'signing in to a deleted account');
      await deleteApp(again.app);
    });
  } finally {
    // Remove every temporary account, whatever happened above.
    for (const p of [...people]) {
      try {
        await signInWithEmailAndPassword(p.auth, p.email, PASSWORD);
        await p.call('deleteAccount');
      } catch (e) {
        console.log(`  ! Couldn't remove test account ${p.email}: ${(e as Error).message}. Delete it in Firebase Authentication.`);
      }
    }
    await Promise.all([a, b, c].filter(Boolean).map((p) => deleteApp(p!.app).catch(() => {})));
  }
}

main()
  .then(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(failed.length ? `\n${failed.length} check(s) need attention.\n` : '\nAll checks passed. Your Firebase project is ready.\n');
    process.exit(failed.length ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
