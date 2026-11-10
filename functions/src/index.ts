/**
 * Together: Cloud Functions.
 *
 * - onMessageCreated: gentle push to the recipient (respects their one-tap pause).
 * - onCoupleDeleted: when either partner unpairs, remove every shared doc and file.
 * - fadeDisappearingNotes: hourly, deletes disappearing notes (and their media) past their time.
 * - transcribeVoiceNote: if the sender opted in, adds a transcript to their voice note.
 * - onAccountDeleted: safety net if a sign-in account is removed another way.
 * - acceptInvite, unlinkCouple, requestReconnect, deleteAccount: the couple's
 *   lifecycle, run only on the server (see docs/ARCHITECTURE.md §2).
 * - purgeEndedCouples, cleanupInvites, onShareSettingsChanged: daily and
 *   background clean-up.
 * - startStepsSync, stopStepsSync, syncSteps: steps from Apple Health, sent by
 *   an iPhone Shortcut with a personal link (docs/STEPS-SYNC.md).
 */
import { initializeApp } from 'firebase-admin/app';
import { v2 as speech } from '@google-cloud/speech';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { defineBoolean, defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
// Auth deletion triggers only exist in the 1st-gen API.
import * as functionsV1 from 'firebase-functions/v1';

import { hashStepsToken, newStepsToken, parseSteps, syncDay } from './steps-pure';

/**
 * Every function runs in Singapore, next to the Firestore database and Storage
 * bucket (asia-southeast1). Firestore triggers must be in the database's region.
 * The app calls the callable functions in this same region (src/lib/firebase.ts).
 */
const REGION = 'asia-southeast1';
setGlobalOptions({ region: REGION, maxInstances: 10 });

initializeApp();
const db = getFirestore();

type Message = {
  fromUid: string;
  toUid: string;
  kind: 'text' | 'photo' | 'voice' | 'video' | 'hug' | 'quick';
  viewOnce?: boolean;
  text?: string;
  voiceHug?: boolean;
};

/** Notification copy. Warm, short, and never reveals content for sensitive kinds. */
export function notificationFor(msg: Message, fromName: string): { title: string; body: string } {
  // View-once notes never preview their content, not even the caption.
  if (msg.viewOnce) return { title: `${fromName} sent you something to view once`, body: 'Open it when you\u2019re ready.' };
  switch (msg.kind) {
    case 'hug':
      return { title: `${fromName} sent you a hug`, body: 'Hold your phone close for a moment.' };
    case 'photo':
      return { title: `${fromName} sent you a photo`, body: 'A little moment, just for you.' };
    case 'video':
      return { title: `${fromName} sent you a video`, body: 'Watch it when you have a quiet minute.' };
    case 'voice':
      return msg.voiceHug
        ? { title: `${fromName} sent you a voice hug`, body: 'Ten warm seconds are waiting.' }
        : { title: `${fromName} sent you a voice note`, body: 'Have a listen when you have a quiet minute.' };
    case 'quick':
    case 'text':
    default:
      return { title: `A love note from ${fromName}`, body: (msg.text ?? '').slice(0, 120) || 'Open to read it.' };
  }
}

export const onMessageCreated = onDocumentCreated('couples/{cid}/messages/{messageId}', async (event) => {
  const msg = event.data?.data() as Message | undefined;
  if (!msg) return;

  const [recipientSnap, coupleSnap] = await Promise.all([
    db.doc(`users/${msg.toUid}`).get(),
    db.doc(`couples/${event.params.cid}`).get(),
  ]);
  const recipient = recipientSnap.data();
  if (!recipient || recipient.notificationsPaused) return; // one-tap pause wins, always

  const fromName: string = coupleSnap.data()?.names?.[msg.fromUid] ?? 'Your partner';
  const { title, body } = notificationFor(msg, fromName);
  await sendPush(msg.toUid, recipient, {
    title,
    body,
    url: msg.kind === 'hug' ? '/' : '/notes',
    channelId: msg.kind === 'hug' ? 'hugs' : 'love-notes',
    tag: msg.kind === 'hug' ? 'hug' : `note-${event.params.messageId}`,
  });
});

export const onCoupleDeleted = onDocumentDeleted('couples/{cid}', async (event) => {
  const { cid } = event.params;
  const ref = db.doc(`couples/${cid}`);
  await db.recursiveDelete(ref);
  await getStorage().bucket().deleteFiles({ prefix: `couples/${cid}/` });

  // Clear the pointer on both profiles so neither app keeps a stale link.
  const members: string[] = event.data?.data()?.members ?? [];
  await Promise.all(
    members.map(async (uid) => {
      const userRef = db.doc(`users/${uid}`);
      const snap = await userRef.get();
      const patch: Record<string, unknown> = {};
      if (snap.data()?.coupleId === cid) patch.coupleId = null;
      if (snap.data()?.lastCoupleId === cid) patch.lastCoupleId = FieldValue.delete();
      if (snap.exists && Object.keys(patch).length) await userRef.update(patch);
      const mem = db.doc(`memberships/${uid}`);
      if ((await mem.get()).data()?.coupleId === cid) await mem.delete();
    }),
  );
});

/**
 * Safety net: if a sign-in account is removed some other way (for example in
 * the Firebase console), remove everything that belonged to it. Same steps as
 * deleteAccount, and safe to run twice.
 */
export const onAccountDeleted = functionsV1.region(REGION).auth.user().onDelete(async (user) => {
  await removeAllDataFor(user.uid);
  logger.info('Account data removed', { uid: user.uid });
});

async function deleteMediaDoc(cid: string, mediaId: string) {
  const ref = db.doc(`couples/${cid}/media/${mediaId}`);
  const snap = await ref.get();
  const data = snap.data();
  if (!data) return;
  const bucket = getStorage().bucket();
  for (const path of [data.storagePath, data.thumbPath].filter(Boolean) as string[]) {
    await bucket.file(path).delete({ ignoreNotFound: true });
  }
  await ref.delete();
}

/**
 * Disappearing notes: clients already hide them after `expiresAt`; this makes
 * sure they are really gone. (A Firestore TTL policy on messages.expiresAt is a
 * good extra safety net; see README.)
 */
export const fadeDisappearingNotes = onSchedule('every 60 minutes', async () => {
  const due = await db.collectionGroup('messages').where('expiresAt', '<=', Timestamp.now()).limit(500).get();
  for (const doc of due.docs) {
    const cid = doc.ref.parent.parent?.id;
    const mediaId = doc.get('mediaId') as string | undefined;
    if (cid && mediaId) await deleteMediaDoc(cid, mediaId);
    await doc.ref.delete();
  }
  if (due.size) logger.info(`Faded ${due.size} disappearing notes`);
});

const TRANSCRIBE_LANGUAGE = defineString('TRANSCRIBE_LANGUAGE', { default: 'en-US' });

/**
 * Opt-in transcription for voice notes (Settings, "Transcribe my voice notes").
 * Never for view-once notes, vent recordings (never uploaded), or check-ins
 * (private storage). Requires the Speech-to-Text API on the project.
 */
export const transcribeVoiceNote = onDocumentCreated(
  { document: 'couples/{cid}/media/{mediaId}', timeoutSeconds: 300, memory: '512MiB' },
  async (event) => {
    const media = event.data?.data();
    if (!media || media.type !== 'voice' || media.visibility === 'viewOnce') return;
    const owner = (await db.doc(`users/${media.ownerId}`).get()).data();
    if (!owner?.transcribeVoice) return;

    const bucket = getStorage().bucket();
    const project = process.env.GCLOUD_PROJECT;
    const client = new speech.SpeechClient();
    try {
      const [operation] = await client.batchRecognize({
        recognizer: `projects/${project}/locations/global/recognizers/_`,
        config: {
          autoDecodingConfig: {},
          languageCodes: [TRANSCRIBE_LANGUAGE.value()],
          model: 'long',
          features: { enableAutomaticPunctuation: true },
        },
        files: [{ uri: `gs://${bucket.name}/${media.storagePath}` }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      });
      const [response] = await operation.promise();
      const results = Object.values(response.results ?? {})[0]?.transcript?.results ?? [];
      const transcript = results
        .map((r) => r.alternatives?.[0]?.transcript?.trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 5000);
      // The note may have been taken back while we were listening.
      if (transcript && (await event.data!.ref.get()).exists) await event.data!.ref.update({ transcript });
    } catch (e) {
      logger.warn('Transcription skipped', { mediaId: event.params.mediaId, error: String(e) });
    }
  },
);

// ------------------------------------------------------------ Phase 3

/** Send a gentle push to one person, unless they've paused notifications. */
async function pushTo(uid: string, title: string, body: string, url: string, channelId = 'love-notes') {
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user || user.notificationsPaused) return;
  await sendPush(uid, user, { title, body, url, channelId });
}

type PushMessage = { title: string; body: string; url: string; channelId?: string; tag?: string };

/**
 * One notification to every device this person has turned notifications on for:
 * the phone apps (Expo push tokens) and the web app (FCM web push tokens).
 * Web tokens that no longer work (app removed, permission revoked) are tidied away.
 */
async function sendPush(uid: string, user: Record<string, unknown>, m: PushMessage) {
  const expo: string[] = Array.isArray(user.pushTokens) ? (user.pushTokens as string[]) : [];
  const web: string[] = Array.isArray(user.webPushTokens) ? (user.webPushTokens as string[]) : [];
  const jobs: Promise<unknown>[] = [];
  if (expo.length) {
    jobs.push(
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expo.map((to) => ({ to, title: m.title, body: m.body, sound: 'default', channelId: m.channelId ?? 'love-notes', data: { url: m.url } }))),
      }).then((res) => {
        if (!res.ok) logger.warn('Expo push failed', { status: res.status });
      }),
    );
  }
  if (web.length) {
    jobs.push(
      getMessaging()
        .sendEachForMulticast({
          tokens: web,
          // Data only: the app's service worker (public/sw.js) shows it, the same way on every browser.
          webpush: {
            headers: { Urgency: 'high', TTL: String(24 * 3600) },
            data: { title: m.title, body: m.body, url: m.url, tag: m.tag ?? '' },
            fcmOptions: { link: m.url },
          },
        })
        .then(async (r) => {
          const dead = r.responses
            .map((x, i) => (!x.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(x.error?.code ?? '') ? web[i] : null))
            .filter((x): x is string => !!x);
          if (dead.length) await db.doc(`users/${uid}`).update({ webPushTokens: FieldValue.arrayRemove(...dead) });
        }),
    );
  }
  await Promise.all(jobs.map((j) => j.catch((e) => logger.warn('Push failed', { error: String(e) }))));
}

/** A gentle reset was started: invite the other partner, softly. */
export const onResetStarted = onDocumentCreated('couples/{cid}/resets/{date}', async (event) => {
  const reset = event.data?.data();
  if (!reset) return;
  const couple = (await db.doc(`couples/${event.params.cid}`).get()).data();
  if (!couple) return;
  const other = (couple.members as string[]).find((m) => m !== reset.startedBy);
  if (!other) return;
  const name = couple.names?.[reset.startedBy] ?? 'Your partner';
  await pushTo(other, `${name} would like a gentle reset`, 'Pause, have some water, then share one thing you appreciate.', '/reset');
});

/**
 * Scheduled notes and date surprises: let the recipient know when one arrives.
 * ("Next open" surprises don't notify; they're found when the app opens.)
 */
export const deliverScheduledNotes = onSchedule('every 10 minutes', async () => {
  const due = await db
    .collectionGroup('scheduled')
    .where('deliverAt', '<=', Timestamp.now())
    .where('notified', '==', false)
    .limit(200)
    .get();
  for (const d of due.docs) {
    const n = d.data();
    await d.ref.update({ notified: true });
    if (n.surprise === 'open') continue;
    const cid = d.ref.parent.parent?.id;
    const couple = cid ? (await db.doc(`couples/${cid}`).get()).data() : null;
    if (couple?.status === 'ended') continue;
    const name = couple?.names?.[n.fromUid] ?? 'Your partner';
    if (n.surprise === 'date') await pushTo(n.toUid, `${name} left you a surprise`, 'It just unlocked. Open it when you’re ready.', '/notes');
    else await pushTo(n.toUid, `A love note from ${name}`, (n.text ?? '').slice(0, 120) || 'Open to read it.', '/notes');
  }
});

/** Tag new scheduled notes so the delivery job can find them. */
export const onScheduledCreated = onDocumentCreated('couples/{cid}/scheduled/{id}', async (event) => {
  await event.data?.ref.update({ notified: false });
});

function nextOccurrence(date: string, yearly: boolean, today: string): string | null {
  if (!yearly) return date >= today ? date : null;
  const [, m, d] = date.split('-');
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${year + 1}-${m}-${d}`;
}

/** Milestone reminders for both partners: a week before, the day before, and on the day. */
export const milestoneReminders = onSchedule({ schedule: 'every day 09:00', timeZone: 'UTC' }, async () => {
  const today = new Date().toISOString().slice(0, 10);
  const all = await db.collectionGroup('milestones').get();
  for (const d of all.docs) {
    const m = d.data();
    const next = nextOccurrence(m.date, m.yearly !== false, today);
    if (!next) continue;
    const days = Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000);
    if (![7, 1, 0].includes(days)) continue;
    const cid = d.ref.parent.parent?.id;
    const couple = cid ? (await db.doc(`couples/${cid}`).get()).data() : null;
    if (!couple || couple.status === 'ended') continue;
    const when = days === 0 ? 'is today' : days === 1 ? 'is tomorrow' : 'is in a week';
    const body = days === 7 ? 'Plenty of time for a little plan.' : days === 1 ? 'A card tonight would be lovely.' : 'Enjoy it together.';
    for (const uid of couple.members as string[]) {
      // Don't spoil a birthday surprise for the birthday person.
      if (m.kind === 'birthday' && m.personUid === uid && days > 0) continue;
      await pushTo(uid, `${m.title} ${when}`, body, '/milestones');
    }
  }
});

// =====================================================================
// The couple's lifecycle. Only these functions create a couple, change who
// is in it, end it or delete it; the security rules refuse all of that from
// the app. See docs/ARCHITECTURE.md §2.
// =====================================================================

/** Shared data is kept this long after an unlink, so the two of you can reconnect. */
const GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

/** Turn on once App Check is set up for every platform (docs/DEPLOY.md). */
const requireAppCheck = defineBoolean('REQUIRE_APP_CHECK', {
  default: false,
  description: 'Refuse pairing, unlinking and deletion calls that do not carry a valid App Check token.',
});

function caller(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
  if (requireAppCheck.value() && !req.app) throw new HttpsError('failed-precondition', 'Please update the app and try again.');
  return req.auth.uid;
}

export function normalizeInviteCode(input: unknown): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/**
 * The invited person accepts. One transaction: either all of this happens or none of it.
 * Checks: the invite is open and in date, it isn't your own, and neither of you is
 * already in a couple (memberships/{uid} is the one-couple lock).
 */
export const acceptInvite = onCall(async (req) => {
  const uid = caller(req);
  const code = normalizeInviteCode((req.data as { code?: unknown } | undefined)?.code);
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new HttpsError('invalid-argument', 'That code doesn’t look quite right. It has 6 letters and numbers.');

  return db.runTransaction(async (tx) => {
    const inviteRef = db.doc(`invites/${code}`);
    const inviteSnap = await tx.get(inviteRef);
    const invite = inviteSnap.data();
    if (!invite) throw new HttpsError('not-found', 'We couldn’t find that code. Could you check it with your partner?');
    const fromUid = invite.fromUid as string;
    if (fromUid === uid) throw new HttpsError('failed-precondition', 'That’s your own code. Send it to your partner instead.');
    if (invite.status !== 'open') throw new HttpsError('failed-precondition', 'That code has already been used. Ask for a new one.');
    if ((invite.expiresAt as Timestamp).toMillis() < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'That code has expired. Ask your partner for a new one.');
    }

    const [mine, theirs, me, inviter] = await Promise.all([
      tx.get(db.doc(`memberships/${uid}`)),
      tx.get(db.doc(`memberships/${fromUid}`)),
      tx.get(db.doc(`users/${uid}`)),
      tx.get(db.doc(`users/${fromUid}`)),
    ]);
    if (mine.exists) throw new HttpsError('failed-precondition', 'You’re already linked with someone. Unlink first to pair again.');
    if (theirs.exists) throw new HttpsError('failed-precondition', 'They’re already linked with someone.');
    const otherInvites = await tx.get(db.collection('invites').where('fromUid', 'in', [uid, fromUid]).where('status', '==', 'open'));

    const coupleRef = db.collection('couples').doc();
    const now = FieldValue.serverTimestamp();
    const myName = String(me.data()?.displayName ?? 'Your partner').slice(0, 60);
    tx.create(coupleRef, {
      members: [fromUid, uid],
      names: { [fromUid]: String(invite.fromName ?? 'Your partner').slice(0, 60), [uid]: myName },
      avatars: avatarsOf({ [fromUid]: inviter.data(), [uid]: me.data() }),
      status: 'active',
      createdAt: now,
      createdBy: uid,
      inviteCode: code,
    });
    for (const member of [fromUid, uid]) {
      tx.create(db.doc(`memberships/${member}`), { coupleId: coupleRef.id, joinedAt: now });
      tx.set(db.doc(`users/${member}`), { coupleId: coupleRef.id, lastCoupleId: FieldValue.delete() }, { merge: true });
    }
    tx.update(inviteRef, { status: 'accepted', acceptedBy: uid, coupleId: coupleRef.id });
    otherInvites.docs.filter((d) => d.id !== code).forEach((d) => tx.update(d.ref, { status: 'cancelled' }));
    return { coupleId: coupleRef.id };
  });
});

/** Each person's current profile picture id, for the couple doc. */
function avatarsOf(users: Record<string, Record<string, unknown> | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [uid, u] of Object.entries(users)) if (typeof u?.avatarId === 'string' && u.avatarId) out[uid] = u.avatarId;
  return out;
}

/**
 * End a couple: access stops for both at once (every rule requires status
 * 'active'); both memberships go so each person can pair again; shared data
 * is kept GRACE_DAYS for a possible reconnect, then purged.
 */
async function endCouple(cid: string, byUid: string): Promise<string | null> {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`couples/${cid}`);
    const snap = await tx.get(ref);
    const c = snap.data();
    if (!c) return null;
    const members = c.members as string[];
    if (!members.includes(byUid)) throw new HttpsError('permission-denied', 'You’re not part of that couple.');
    const mems = await Promise.all(members.map((u) => tx.get(db.doc(`memberships/${u}`))));
    if (c.status !== 'ended') {
      tx.update(ref, {
        status: 'ended',
        endedBy: byUid,
        endedAt: FieldValue.serverTimestamp(),
        purgeAfter: Timestamp.fromMillis(Date.now() + GRACE_DAYS * DAY_MS),
        reconnect: [],
      });
    }
    members.forEach((u, i) => {
      if (mems[i].data()?.coupleId === cid) tx.delete(mems[i].ref);
      tx.set(db.doc(`users/${u}`), { coupleId: null, lastCoupleId: cid }, { merge: true });
    });
    return members.find((u) => u !== byUid) ?? null;
  });
}

/** Either person, any time, no permission needed from the other. */
export const unlinkCouple = onCall(async (req) => {
  const uid = caller(req);
  const cid = (await db.doc(`memberships/${uid}`).get()).data()?.coupleId as string | undefined;
  if (!cid) return { ok: true };
  const partner = await endCouple(cid, uid);
  if (partner) {
    const name = (await db.doc(`couples/${cid}`).get()).data()?.names?.[uid] ?? 'Your partner';
    await pushTo(partner, `${name} has unlinked`, 'Your private things are untouched. Be gentle with yourself today.', '/', 'love-notes').catch(() => {});
  }
  return { ok: true, graceDays: GRACE_DAYS };
});

/**
 * Within the grace window, either person can ask to reconnect. It happens only
 * when BOTH have asked and neither has paired with someone else since.
 */
export const requestReconnect = onCall(async (req) => {
  const uid = caller(req);
  const cid = (await db.doc(`users/${uid}`).get()).data()?.lastCoupleId as string | undefined;
  if (!cid) throw new HttpsError('failed-precondition', 'There’s nothing to reconnect.');

  const result = await db.runTransaction(async (tx) => {
    const ref = db.doc(`couples/${cid}`);
    const c = (await tx.get(ref)).data();
    if (!c || c.status !== 'ended' || !(c.members as string[]).includes(uid)) {
      throw new HttpsError('failed-precondition', 'That link can’t be restored any more.');
    }
    if ((c.purgeAfter as Timestamp).toMillis() < Date.now()) throw new HttpsError('deadline-exceeded', 'The 30 days have passed, so this can’t be restored.');
    const members = c.members as string[];
    const mems = await Promise.all(members.map((u) => tx.get(db.doc(`memberships/${u}`))));
    if (mems.some((m) => m.exists)) throw new HttpsError('failed-precondition', 'One of you is linked with someone else now.');
    const profiles = await Promise.all(members.map((u) => tx.get(db.doc(`users/${u}`))));

    const asked = Array.from(new Set([...((c.reconnect as string[] | undefined) ?? []), uid]));
    if (!members.every((u) => asked.includes(u))) {
      tx.update(ref, { reconnect: asked });
      return { state: 'waiting' as const, partner: members.find((u) => u !== uid)! };
    }
    tx.update(ref, {
      status: 'active',
      avatars: avatarsOf(Object.fromEntries(members.map((u, i) => [u, profiles[i].data()]))),
      reconnect: FieldValue.delete(),
      endedAt: FieldValue.delete(),
      endedBy: FieldValue.delete(),
      purgeAfter: FieldValue.delete(),
    });
    const now = FieldValue.serverTimestamp();
    for (const u of members) {
      tx.create(db.doc(`memberships/${u}`), { coupleId: cid, joinedAt: now });
      tx.set(db.doc(`users/${u}`), { coupleId: cid, lastCoupleId: FieldValue.delete() }, { merge: true });
    }
    return { state: 'reconnected' as const, partner: members.find((u) => u !== uid)! };
  });

  const name = (await db.doc(`couples/${cid}`).get()).data()?.names?.[uid] ?? 'Your partner';
  if (result.state === 'waiting') {
    await pushTo(result.partner, `${name} would like to reconnect`, 'If you’d like that too, open KiTA and tap Reconnect.', '/pair').catch(() => {});
  } else {
    await pushTo(result.partner, `You and ${name} are together again`, 'Everything you shared is back.', '/').catch(() => {});
  }
  return { state: result.state };
});

/**
 * Remove everything that belongs to one person. Safe to run twice.
 * A couple they were in can never be reconnected once they are gone, so its
 * shared space is deleted now (onCoupleDeleted removes every doc and file).
 */
async function removeAllDataFor(uid: string) {
  const [mem, user] = await Promise.all([db.doc(`memberships/${uid}`).get(), db.doc(`users/${uid}`).get()]);
  const cids = new Set([mem.data()?.coupleId, user.data()?.coupleId, user.data()?.lastCoupleId].filter(Boolean) as string[]);
  for (const cid of cids) {
    const couple = await db.doc(`couples/${cid}`).get();
    if (!couple.exists || !((couple.data()?.members as string[]) ?? []).includes(uid)) continue;
    if (couple.data()?.status !== 'ended') await endCouple(cid, uid);
    await couple.ref.delete();
  }
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  await db.doc(`memberships/${uid}`).delete();
  const invites = await db.collection('invites').where('fromUid', '==', uid).where('status', '==', 'open').get();
  await Promise.all(invites.docs.map((d) => d.ref.update({ status: 'cancelled' })));
  const tokens = await db.collection('stepTokens').where('uid', '==', uid).get();
  await Promise.all(tokens.docs.map((d) => d.ref.delete()));
}

/** Settings → Delete my account. The app re-checks the password just before calling this. */
export const deleteAccount = onCall(async (req) => {
  const uid = caller(req);
  const authTime = Number(req.auth?.token.auth_time ?? 0);
  if (Date.now() / 1000 - authTime > 10 * 60) {
    throw new HttpsError('failed-precondition', 'Please confirm your password again, then try once more.');
  }
  await removeAllDataFor(uid);
  await getAuth().deleteUser(uid); // last, so anything that failed above can simply be retried
  return { ok: true };
});

/** Daily: couples ended more than GRACE_DAYS ago are deleted for good. */
export const purgeEndedCouples = onSchedule({ schedule: 'every day 03:00', timeZone: 'Asia/Kuala_Lumpur' }, async () => {
  const due = await db.collection('couples').where('status', '==', 'ended').where('purgeAfter', '<=', Timestamp.now()).get();
  for (const d of due.docs) await d.ref.delete(); // onCoupleDeleted removes the shared space and files
  logger.info('Purged ended couples', { count: due.size });
});

/** Daily: invites a week past their expiry are deleted. */
export const cleanupInvites = onSchedule({ schedule: 'every day 03:30', timeZone: 'Asia/Kuala_Lumpur' }, async () => {
  const old = await db.collection('invites').where('expiresAt', '<=', Timestamp.fromMillis(Date.now() - 7 * DAY_MS)).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
});

/** Which shared-day fields each privacy switch controls. */
const SHARE_FIELDS: Record<string, string[]> = {
  steps: ['steps', 'stepGoal'],
  food: ['food'],
  cycle: ['cycle'],
  mood: ['mood'],
  media: ['mood.mediaId'],
};
const SHARE_DEFAULTS: Record<string, boolean> = { steps: true, food: true, cycle: false, mood: false, media: false };

/** The switches that went from on to off in one settings change. */
export function switchedOff(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined): string[] {
  const on = (s: Record<string, unknown> | undefined, k: string) => (s && typeof s[k] === 'boolean' ? (s[k] as boolean) : SHARE_DEFAULTS[k]);
  return Object.keys(SHARE_FIELDS).filter((k) => on(before, k) && !on(after, k));
}

/**
 * Backup for the app: when a switch turns off, remove that field from every
 * shared day this person owns, even if the app closed before finishing.
 */
export const onShareSettingsChanged = onDocumentWritten('users/{uid}/settings/share', async (event) => {
  const off = switchedOff(event.data?.before.data(), event.data?.after.data());
  if (!off.length) return;
  const { uid } = event.params;
  const cid = (await db.doc(`memberships/${uid}`).get()).data()?.coupleId as string | undefined;
  if (!cid) return;
  const mine = await db.collection(`couples/${cid}/shared`).where('ownerId', '==', uid).get();
  const patch: Record<string, FieldValue> = {};
  off.flatMap((k) => SHARE_FIELDS[k]).forEach((f) => (patch[f] = FieldValue.delete()));
  for (let i = 0; i < mine.docs.length; i += 400) {
    const batch = db.batch();
    mine.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, patch));
    await batch.commit();
  }
});

// ------------------------------------------------------------ steps from iPhone
//
// Web apps can't read Apple Health, so an iPhone Shortcut reads today's steps
// and opens a personal link: syncSteps?t=<secret>&steps=<number>. The secret
// only lets someone set that one person's step count. Only its hash is used
// for the lookup (stepTokens/{hash}); the owner can see their own link in
// users/{uid}/settings/stepsSync. Making a new link or turning sync off
// retires the old one.

const STEPS_TIME_ZONE = 'Asia/Kuala_Lumpur';

function syncStepsUrl(token: string): string {
  const project = process.env.GCLOUD_PROJECT ?? JSON.parse(process.env.FIREBASE_CONFIG ?? '{}').projectId;
  const base =
    process.env.FUNCTIONS_EMULATOR === 'true'
      ? `http://127.0.0.1:5001/${project}/${REGION}`
      : `https://${REGION}-${project}.cloudfunctions.net`;
  return `${base}/syncSteps?t=${token}`;
}

async function retireStepsLink(uid: string) {
  const settings = db.doc(`users/${uid}/settings/stepsSync`);
  const old = (await settings.get()).data()?.tokenHash as string | undefined;
  if (old) await db.doc(`stepTokens/${old}`).delete();
  return settings;
}

/** Settings → Steps from iPhone → Make my link. Replaces any earlier link. */
export const startStepsSync = onCall(async (req) => {
  const uid = caller(req);
  const settings = await retireStepsLink(uid);
  const token = newStepsToken();
  const tokenHash = hashStepsToken(token);
  const url = syncStepsUrl(token);
  await db.doc(`stepTokens/${tokenHash}`).set({ uid, createdAt: FieldValue.serverTimestamp() });
  await settings.set({ url, tokenHash, createdAt: FieldValue.serverTimestamp(), lastSyncAt: null, lastSteps: null });
  return { url };
});

/** Settings → Steps from iPhone → Turn off. The old link stops working at once. */
export const stopStepsSync = onCall(async (req) => {
  const uid = caller(req);
  const settings = await retireStepsLink(uid);
  await settings.delete();
  return { ok: true };
});

/** Called by the iPhone Shortcut. Answers in plain words, which the Shortcut can show. */
export const syncSteps = onRequest({ cors: false }, async (req, res) => {
  const q = { ...(typeof req.body === 'object' && req.body ? req.body : {}), ...req.query } as Record<string, unknown>;
  const token = typeof q.t === 'string' ? q.t : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    res.status(401).send('This sync link isn’t right. Copy it again from KiTA → Settings → Steps from iPhone.');
    return;
  }
  const owner = await db.doc(`stepTokens/${hashStepsToken(token)}`).get();
  const uid = owner.data()?.uid as string | undefined;
  if (!uid) {
    res.status(401).send('This sync link was turned off or replaced. Copy the new one from KiTA → Settings → Steps from iPhone.');
    return;
  }
  const steps = parseSteps(q.steps);
  if (steps === null) {
    res.status(400).send('KiTA didn’t get a step count. Check the Shortcut sends “Statistics” (the sum of today’s steps).');
    return;
  }
  const date = syncDay(q.date, STEPS_TIME_ZONE);
  const user = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const day = db.doc(`users/${uid}/days/${date}`);
  const stepGoal = ((await day.get()).data()?.stepGoal as number | undefined) ?? (user.stepGoal as number | undefined) ?? 8000;
  await day.set({ date, steps, stepGoal, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  // Share with the partner exactly as the app would: only if steps sharing is on.
  const cid = user.coupleId as string | null | undefined;
  if (cid) {
    const [couple, share] = await Promise.all([db.doc(`couples/${cid}`).get(), db.doc(`users/${uid}/settings/share`).get()]);
    const shareSteps = typeof share.data()?.steps === 'boolean' ? (share.data()!.steps as boolean) : SHARE_DEFAULTS.steps;
    const active = couple.exists && couple.data()?.status !== 'ended' && ((couple.data()?.members as string[]) ?? []).includes(uid);
    if (active && shareSteps) {
      await db
        .doc(`couples/${cid}/shared/${uid}_${date}`)
        .set({ ownerId: uid, date, steps, stepGoal, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  await db.doc(`users/${uid}/settings/stepsSync`).set({ lastSyncAt: FieldValue.serverTimestamp(), lastSteps: steps, lastDate: date }, { merge: true });
  res.status(200).send(`Synced ${steps.toLocaleString('en-US')} steps to KiTA ♡`);
});

// ------------------------------------------------------------ question of the day
//
// couples/{cid}/questions/{date}/answers/{uid}: one answer each (rules hide the
// partner's answer until you've answered). This keeps the day document
// (who has answered, when both had) up to date, and tells the partner.

export const onQuestionAnswered = onDocumentWritten('couples/{cid}/questions/{date}/answers/{uid}', async (event) => {
  const { cid, date, uid } = event.params;
  const before = event.data?.before.exists ?? false;
  const after = event.data?.after.exists ?? false;
  if (before === after) return; // an edit: nothing to announce
  const dayRef = db.doc(`couples/${cid}/questions/${date}`);
  const couple = (await db.doc(`couples/${cid}`).get()).data();
  if (!couple || couple.status === 'ended') return;
  const members = (couple.members as string[]) ?? [];
  if (!members.includes(uid)) return;

  if (!after) {
    await dayRef.set({ answered: FieldValue.arrayRemove(uid), revealedAt: FieldValue.delete() }, { merge: true });
    return;
  }
  const qid = event.data?.after.data()?.qid ?? null;
  const answered = await db.runTransaction(async (tx) => {
    const day = await tx.get(dayRef);
    const list = new Set<string>((day.data()?.answered as string[]) ?? []);
    list.add(uid);
    const both = members.every((m) => list.has(m));
    tx.set(
      dayRef,
      { date, qid, answered: [...list], ...(both && !day.data()?.revealedAt ? { revealedAt: FieldValue.serverTimestamp() } : null) },
      { merge: true },
    );
    return list;
  });

  const partner = members.find((m) => m !== uid);
  if (!partner) return;
  const name: string = couple.names?.[uid] ?? 'Your partner';
  const both = answered.has(partner);
  await pushTo(
    partner,
    both ? `${name} answered too` : `${name} answered today’s question`,
    both ? 'Open KiTA to see both answers.' : 'Answer yours to see theirs.',
    '/question',
    'love-notes',
  ).catch(() => {});
});
