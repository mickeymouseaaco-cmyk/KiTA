/**
 * End-to-end check of the Firebase integration, against the local emulators
 * with the real rules and the real Cloud Functions (built from functions/).
 *
 *   npm run verify          (from the project root; runs this last)
 *
 * It does what the app does: people register, invite, pair through the
 * acceptInvite function, share, upload a photo, unlink, reconnect and delete
 * their account. A second couple tries to reach the first at every step.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import {
  Timestamp,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import { DEFAULT_SHARE } from '../../src/lib/types';

const PROJECT = 'demo-together';
const REGION = 'asia-southeast1';
const HOST = '127.0.0.1';
const PASSWORD = 'gentle-test-password-1';

type Person = {
  name: string;
  email: string;
  uid: string;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  call: <T = Record<string, unknown>>(fn: string, data?: Record<string, unknown>) => Promise<T>;
};

let env: RulesTestEnvironment;
const people: Person[] = [];

function connect(name: string) {
  const app = initializeApp(
    { apiKey: 'demo-key', projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com`, appId: 'demo-app' },
    `${name}-${Date.now()}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, HOST, 9199);
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, HOST, 5001);
  const call = async <T,>(fn: string, data: Record<string, unknown> = {}) => (await httpsCallable(fns, fn)(data)).data as T;
  return { app, auth, db, storage, call };
}

/** Sign up exactly as the app does (src/lib/session.tsx, createProfile). */
async function register(name: string): Promise<Person> {
  const email = `${name.toLowerCase()}@example.com`;
  const c = connect(name);
  const cred = await createUserWithEmailAndPassword(c.auth, email, PASSWORD);
  const uid = cred.user.uid;
  await setDoc(doc(c.db, 'users', uid), {
    displayName: name,
    coupleId: null,
    notificationsPaused: false,
    pushTokens: [],
    stepGoal: 8000,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(c.db, 'users', uid, 'settings', 'share'), { ...DEFAULT_SHARE, updatedAt: serverTimestamp() });
  const p = { name, email, uid, ...c };
  people.push(p);
  return p;
}

/** Create an invite exactly as the app does (src/lib/pairing.ts, createInvite). */
async function invite(p: Person, code: string) {
  await setDoc(doc(p.db, 'invites', code), {
    fromUid: p.uid,
    fromName: p.name,
    status: 'open',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 48 * 3600_000),
  });
  return code;
}

/** Read with rules switched off, to check what the server did. */
async function adminGet(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), path));
    data = s.exists() ? s.data() : undefined;
  });
  return data;
}
async function adminFileExists(path: string) {
  let ok = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    ok = await getBytes(ref(ctx.storage(), path)).then(() => true, () => false);
  });
  return ok;
}

/** Background functions (triggers) finish a moment later. */
async function eventually(check: () => Promise<boolean>, what: string, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.fail(`Timed out waiting for: ${what}`);
}

const denied = (p: Promise<unknown>) => assert.rejects(p, /permission|PERMISSION_DENIED|unauthorized|storage\/unauthorized/i);

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: HOST, port: 8080 }, storage: { host: HOST, port: 9199 } });
  await env.clearFirestore();
  await env.clearStorage();
  await fetch(`http://${HOST}:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
});

after(async () => {
  await Promise.all(people.map((p) => deleteApp(p.app)));
  await env.cleanup();
});

describe('Together on Firebase, end to end', () => {
  let afiq: Person, aina: Person, casey: Person, drew: Person;
  let cid = '';
  let cid2 = '';

  test('1–2. Firebase initialises, and people can register and sign in', async () => {
    afiq = await register('Afiq');
    aina = await register('Aina');
    casey = await register('Casey');
    drew = await register('Drew');
    assert.ok(afiq.uid && aina.uid && afiq.uid !== aina.uid);
    const me = await getDoc(doc(afiq.db, 'users', afiq.uid));
    assert.equal(me.data()?.displayName, 'Afiq');
    assert.equal(me.data()?.coupleId, null);
    // Profiles are private, even to a future partner.
    await denied(getDoc(doc(aina.db, 'users', afiq.uid)));
    // Signing in again works.
    const again = connect('Afiq-again');
    await signInWithEmailAndPassword(again.auth, afiq.email, PASSWORD);
    assert.equal(again.auth.currentUser?.uid, afiq.uid);
    await deleteApp(again.app);
  });

  test('3. Invitation and linking run on the server, one couple per person', async () => {
    const code = await invite(afiq, 'AFQ234');
    // Nobody can pair by writing documents directly.
    await denied(setDoc(doc(aina.db, 'couples', 'sneaky'), { members: [afiq.uid, aina.uid], names: {}, status: 'active' }));
    await denied(setDoc(doc(aina.db, 'memberships', aina.uid), { coupleId: 'sneaky' }));

    const res = await aina.call<{ coupleId: string }>('acceptInvite', { code });
    cid = res.coupleId;
    assert.ok(cid);

    const couple = (await getDoc(doc(aina.db, 'couples', cid))).data()!;
    assert.deepEqual(couple.members, [afiq.uid, aina.uid]);
    assert.equal(couple.status, 'active');
    assert.equal((await getDoc(doc(afiq.db, 'memberships', afiq.uid))).data()?.coupleId, cid);
    assert.equal((await getDoc(doc(afiq.db, 'users', afiq.uid))).data()?.coupleId, cid);
    assert.equal((await getDoc(doc(aina.db, 'users', aina.uid))).data()?.coupleId, cid);
    assert.equal((await getDoc(doc(afiq.db, 'invites', code))).data()?.status, 'accepted');

    // The same code can't be used twice; a paired person can't invite or be invited.
    await assert.rejects(casey.call('acceptInvite', { code }), /already been used/);
    await denied(invite(afiq, 'AFQ235'));
    const code2 = await invite(casey, 'CSY234');
    await assert.rejects(aina.call('acceptInvite', { code: code2 }), /already linked/);

    // A second couple, to try the walls between couples.
    cid2 = (await drew.call<{ coupleId: string }>('acceptInvite', { code: code2 })).coupleId;
    assert.notEqual(cid2, cid);
  });

  test('4. The database structure matches what the app reads', async () => {
    const couple = (await adminGet(`couples/${cid}`))!;
    for (const k of ['members', 'names', 'status', 'createdAt', 'createdBy', 'inviteCode']) assert.ok(k in couple, `couple.${k}`);
    const allowed = new Set(['members', 'names', 'avatars', 'loveLanguages', 'status', 'createdAt', 'createdBy', 'inviteCode']);
    for (const k of Object.keys(couple)) assert.ok(allowed.has(k), `unexpected couple field ${k}`);
    assert.deepEqual(Object.keys(couple.names as object).sort(), [afiq.uid, aina.uid].sort());
    const membership = (await adminGet(`memberships/${aina.uid}`))!;
    assert.deepEqual(Object.keys(membership).sort(), ['coupleId', 'joinedAt']);
    const user = (await adminGet(`users/${afiq.uid}`))!;
    for (const k of ['displayName', 'coupleId', 'notificationsPaused', 'pushTokens', 'stepGoal', 'createdAt']) assert.ok(k in user, `user.${k}`);
  });

  test('5. Rules keep private data private, shared data shared, and couples apart', async () => {
    const day = `${afiq.uid}_2026-11-10`;
    // Steps are shared by default; mood isn't until Afiq switches it on.
    await setDoc(doc(afiq.db, `couples/${cid}/shared/${day}`), { ownerId: afiq.uid, date: '2026-11-10', steps: 6240 });
    await denied(setDoc(doc(afiq.db, `couples/${cid}/shared/${day}`), { ownerId: afiq.uid, date: '2026-11-10', mood: { emoji: '😌', label: 'Calm', stress: 2 } }));
    await updateDoc(doc(afiq.db, 'users', afiq.uid, 'settings', 'share'), { mood: true });
    await setDoc(doc(afiq.db, `couples/${cid}/shared/${day}`), { ownerId: afiq.uid, date: '2026-11-10', steps: 6240, mood: { emoji: '😌', label: 'Calm', stress: 2 } });
    assert.equal((await getDoc(doc(aina.db, `couples/${cid}/shared/${day}`))).data()?.steps, 6240);

    // Private logs stay private from the partner.
    await setDoc(doc(afiq.db, 'users', afiq.uid, 'days', '2026-11-10'), { date: '2026-11-10', steps: 6240 });
    await denied(getDoc(doc(aina.db, 'users', afiq.uid, 'days', '2026-11-10')));

    // A love note reaches the partner and nobody else.
    await setDoc(doc(afiq.db, `couples/${cid}/messages/n1`), {
      fromUid: afiq.uid, toUid: aina.uid, kind: 'text', text: 'Proud of you', favoriteBy: [], createdAt: serverTimestamp(),
    });
    assert.equal((await getDoc(doc(aina.db, `couples/${cid}/messages/n1`))).data()?.text, 'Proud of you');

    // The other couple sees nothing of this one, and can't write into it.
    await denied(getDoc(doc(casey.db, 'couples', cid)));
    await denied(getDoc(doc(casey.db, `couples/${cid}/messages/n1`)));
    await denied(getDocs(collection(casey.db, `couples/${cid}/shared`)));
    await denied(setDoc(doc(casey.db, `couples/${cid}/messages/x`), { fromUid: casey.uid, toUid: afiq.uid, kind: 'text', text: 'hi', favoriteBy: [], createdAt: serverTimestamp() }));
    await denied(getDocs(collection(casey.db, 'couples')));
  });

  test('6. Storage rules protect photos', async () => {
    const avatar = `users/${afiq.uid}/avatar/p1.jpg`;
    await uploadBytes(ref(afiq.storage, avatar), new Uint8Array([255, 216, 255]), { contentType: 'image/jpeg' });
    await updateDoc(doc(afiq.db, 'users', afiq.uid), { avatarId: 'p1' });
    await updateDoc(doc(afiq.db, 'couples', cid), { [`avatars.${afiq.uid}`]: 'p1' });
    await getBytes(ref(aina.storage, avatar)); // the partner can see it
    await denied(getBytes(ref(casey.storage, avatar))); // another couple can't
    await denied(uploadBytes(ref(aina.storage, `users/${afiq.uid}/avatar/p2.jpg`), new Uint8Array([1]), { contentType: 'image/jpeg' }));

    const vault = `users/${afiq.uid}/private/v1.jpg`;
    await uploadBytes(ref(afiq.storage, vault), new Uint8Array([255, 216, 255]), { contentType: 'image/jpeg' });
    await denied(getBytes(ref(aina.storage, vault))); // private files are private, even from the partner
  });

  test('7. Cloud Functions answer in Singapore (asia-southeast1) only', async () => {
    const other = getFunctions(afiq.app, 'us-central1');
    connectFunctionsEmulator(other, HOST, 5001);
    await assert.rejects(httpsCallable(other, 'unlinkCouple')({}));
  });

  test('Steps from iPhone: a private link sets only its owner’s steps', async () => {
    const { url } = await afiq.call<{ url: string }>('startStepsSync');
    assert.match(url, /\/syncSteps\?t=[A-Za-z0-9_-]{32}$/);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    const ok = await fetch(`${url}&steps=${encodeURIComponent('8,412')}`);
    assert.equal(ok.status, 200, await ok.text());
    assert.equal((await adminGet(`users/${afiq.uid}/days/${today}`))?.steps, 8412);
    assert.equal((await getDoc(doc(aina.db, `couples/${cid}/shared/${afiq.uid}_${today}`))).data()?.steps, 8412, 'partner sees shared steps');
    assert.equal((await getDoc(doc(afiq.db, 'users', afiq.uid, 'settings', 'stepsSync'))).data()?.lastSteps, 8412);

    // Bad input and bad links change nothing.
    assert.equal((await fetch(`${url}&steps=lots`)).status, 400);
    assert.equal((await fetch(url.replace(/t=.*/, 't=wrongwrongwrongwrongwrongwrong12') + '&steps=5')).status, 401);
    await denied(getDoc(doc(aina.db, 'stepTokens', 'anything')));

    // A new link retires the old one; turning sync off retires the new one.
    const { url: url2 } = await afiq.call<{ url: string }>('startStepsSync');
    assert.equal((await fetch(`${url}&steps=1`)).status, 401);
    assert.equal((await fetch(`${url2}&steps=9000`)).status, 200);
    assert.equal((await adminGet(`users/${afiq.uid}/days/${today}`))?.steps, 9000);
    await afiq.call('stopStepsSync');
    assert.equal((await fetch(`${url2}&steps=2`)).status, 401);
    assert.equal(await adminGet(`users/${afiq.uid}/settings/stepsSync`), undefined);

    // Afiq keeps a link for the account-deletion check below.
    await afiq.call('startStepsSync');
  });

  test('Question of the day: answer, then see each other’s', async () => {
    const date = '2026-11-10';
    const mine = doc(afiq.db, `couples/${cid}/questions/${date}/answers/${afiq.uid}`);
    await setDoc(mine, { text: 'Your laugh at dinner', qid: 7, at: serverTimestamp() });
    await eventually(async () => ((await adminGet(`couples/${cid}/questions/${date}`))?.answered as string[] | undefined)?.includes(afiq.uid) ?? false, 'day records Afiq answered');
    await denied(getDoc(doc(aina.db, `couples/${cid}/questions/${date}/answers/${afiq.uid}`)));
    assert.deepEqual((await getDoc(doc(aina.db, `couples/${cid}/questions/${date}`))).data()?.answered, [afiq.uid], 'Aina can see that Afiq answered');
    await setDoc(doc(aina.db, `couples/${cid}/questions/${date}/answers/${aina.uid}`), { text: 'Morning coffee together', qid: 7, at: serverTimestamp() });
    assert.equal((await getDoc(doc(aina.db, `couples/${cid}/questions/${date}/answers/${afiq.uid}`))).data()?.text, 'Your laugh at dinner');
    await eventually(async () => !!(await adminGet(`couples/${cid}/questions/${date}`))?.revealedAt, 'both answered is recorded');
    await denied(getDoc(doc(casey.db, `couples/${cid}/questions/${date}`)));
  });

  test('Track a flight: only real flight numbers are looked up', async () => {
    // (A real lookup needs the internet, so here we only check what is turned away.)
    await assert.rejects(afiq.call('trackFlight', { flight: 'hello there' }), /flight number/);
    await assert.rejects(afiq.call('trackFlight', {}), /flight number/);
  });

  test('Find my partner: share, see, iPhone Shortcut, stop', async () => {
    // Off by default: the Shortcut is refused until Aina turns sharing on.
    const { url } = await aina.call<{ url: string }>('startStepsSync');
    const loc = url.replace('/syncSteps?', '/syncLocation?');
    assert.equal((await fetch(`${loc}&lat=3.0657&lng=101.4846`)).status, 403);
    await setDoc(doc(aina.db, 'users', aina.uid, 'settings', 'location'), { sharing: true, updatedAt: serverTimestamp() });
    const ok = await fetch(`${loc}&lat=${encodeURIComponent('3,0657')}&lng=101.4846`);
    assert.equal(ok.status, 200, await ok.text());
    const seen = (await getDoc(doc(afiq.db, `couples/${cid}/locations/${aina.uid}`))).data();
    assert.equal(seen?.lat, 3.0657);
    assert.equal(seen?.source, 'shortcut');
    assert.equal((await fetch(`${loc}&lat=200&lng=1`)).status, 400);
    await denied(getDoc(doc(casey.db, `couples/${cid}/locations/${aina.uid}`)));
    // Stop sharing: the location is deleted.
    await deleteDoc(doc(aina.db, `couples/${cid}/locations/${aina.uid}`));
    assert.equal(await adminGet(`couples/${cid}/locations/${aina.uid}`), undefined);
    // Afiq shares from the app, then the couple unlinks: locations go at once.
    await setDoc(doc(afiq.db, `couples/${cid}/locations/${afiq.uid}`), { lat: 3.04, lng: 101.44, accuracy: 30, at: serverTimestamp(), source: 'app' });
  });

  test('Unlink stops access at once; reconnect needs both people', async () => {
    await afiq.call('unlinkCouple');
    assert.equal((await getDoc(doc(afiq.db, 'couples', cid))).data()?.status, 'ended');
    assert.equal(await adminGet(`couples/${cid}/locations/${afiq.uid}`), undefined, 'locations are deleted on unlink, not kept for 30 days');
    await denied(getDoc(doc(aina.db, `couples/${cid}/messages/n1`)));
    await denied(getBytes(ref(aina.storage, `users/${afiq.uid}/avatar/p1.jpg`)));
    assert.equal((await getDoc(doc(aina.db, 'memberships', aina.uid))).exists(), false);
    const ainaUser = (await getDoc(doc(aina.db, 'users', aina.uid))).data()!;
    assert.equal(ainaUser.coupleId, null);
    assert.equal(ainaUser.lastCoupleId, cid);
    const purgeAfter = ((await adminGet(`couples/${cid}`))!.purgeAfter as Timestamp).toMillis();
    assert.ok(Math.abs(purgeAfter - (Date.now() + 30 * 86_400_000)) < 3600_000, 'kept for 30 days');

    assert.equal((await afiq.call<{ state: string }>('requestReconnect')).state, 'waiting');
    await denied(getDoc(doc(aina.db, `couples/${cid}/messages/n1`))); // not until both ask
    assert.equal((await aina.call<{ state: string }>('requestReconnect')).state, 'reconnected');
    assert.equal((await getDoc(doc(aina.db, `couples/${cid}/messages/n1`))).data()?.text, 'Proud of you');
  });

  test('8. Account deletion removes everything that belonged to that person', async () => {
    // The app re-checks the password first; a fresh sign-in does the same.
    await signInWithEmailAndPassword(afiq.auth, afiq.email, PASSWORD);
    await afiq.call('deleteAccount');

    assert.equal(await adminGet(`users/${afiq.uid}`), undefined, 'profile gone');
    assert.equal(await adminGet(`users/${afiq.uid}/days/2026-11-10`), undefined, 'private logs gone');
    assert.equal(await adminGet(`users/${afiq.uid}/settings/share`), undefined, 'settings gone');
    assert.equal(await adminGet(`memberships/${afiq.uid}`), undefined, 'membership gone');
    let tokensLeft = -1;
    await env.withSecurityRulesDisabled(async (ctx) => {
      tokensLeft = (await getDocs(query(collection(ctx.firestore(), 'stepTokens'), where('uid', '==', afiq.uid)))).size;
    });
    assert.equal(tokensLeft, 0, 'steps sync link removed');
    assert.equal(await adminGet(`memberships/${aina.uid}`), undefined, 'partner is free to pair again');
    assert.equal(await adminGet(`couples/${cid}`), undefined, 'couple gone');
    await eventually(async () => (await adminGet(`couples/${cid}/messages/n1`)) === undefined, 'shared notes removed');
    await eventually(async () => (await adminGet(`couples/${cid}/shared/${afiq.uid}_2026-11-10`)) === undefined, 'shared days removed');
    assert.equal(await adminFileExists(`users/${afiq.uid}/avatar/p1.jpg`), false, 'photo removed');
    assert.equal(await adminFileExists(`users/${afiq.uid}/private/v1.jpg`), false, 'private files removed');
    await assert.rejects(signInWithEmailAndPassword(afiq.auth, afiq.email, PASSWORD), /user-not-found|invalid-credential/);
    await eventually(async () => (await adminGet(`users/${aina.uid}`))?.lastCoupleId === undefined, 'partner pointer cleared');

    // Aina keeps her own account and can pair again; the other couple is untouched.
    assert.equal((await getDoc(doc(aina.db, 'users', aina.uid))).data()?.coupleId, null);
    await invite(aina, 'ANA234');
    assert.equal((await getDoc(doc(casey.db, 'couples', cid2))).data()?.status, 'active');
  });
});
