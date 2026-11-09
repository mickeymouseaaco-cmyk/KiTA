/**
 * Outbox: a persistent, retrying upload queue for photos and voice notes.
 *
 * Media is never uploaded until the user sends it (a love note) or adds it to a
 * shared space (Memory Jar). When they do, a job is queued here:
 *   1. On native, each file is copied into the app's document folder so it
 *      survives restarts. On web, the queue is in memory only.
 *   2. Each file is uploaded to Cloud Storage (with progress).
 *   3. One batch writes the media docs and the note/memory that uses them, so
 *      the partner never sees a half-sent item.
 * Failures retry with backoff, and the queue resumes when the connection returns.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import { Timestamp, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { Platform } from 'react-native';

import { db, storage } from './firebase';
import { reprojectDay } from './logs';
import { care } from './together-data';
import type { MediaType, MessageKind } from './types';

export type OutboxFile = {
  mediaId: string;
  localUri: string;
  type: MediaType;
  contentType: string;
  ext: string;
  width?: number;
  height?: number;
  durationMs?: number;
  bytes?: number;
  uploaded?: boolean;
  /** Video poster frame, uploaded next to the video as {mediaId}_thumb.jpg. */
  thumbUri?: string;
  thumbUploaded?: boolean;
  /** 'private' files go to users/{uid}/private/ and never get a shared record. */
  scope?: 'private' | 'couple';
};

export type OutboxTarget =
  | { kind: 'message'; messageId: string; toUid: string; msgKind: MessageKind; text?: string; voiceHug?: boolean }
  | { kind: 'memory'; memoryId: string; caption: string; date: string }
  | { kind: 'gratitude'; toUid: string; date: string; text?: string }
  /** Private: uploaded to users/{uid}/private/, never to the couple space. */
  | { kind: 'checkIn'; date: string; text?: string; memoryId?: string }
  /** A mood selfie/voice: always a private copy; a shared copy only if sharing allowed it. */
  | { kind: 'mood'; date: string }
  /** The private media vault. Never shared. */
  | { kind: 'vault'; caption?: string }
  /** A travel journal entry (photo, video, or voice diary) in a shared trip. */
  | { kind: 'tripEntry'; tripId: string; entryId: string; caption?: string; mood?: string; date: string }
  /** A scheduled send or surprise note. */
  | { kind: 'scheduled'; noteId: string; toUid: string; msgKind: MessageKind; text?: string; surprise: 'none' | 'date' | 'open'; deliverAtMs: number };

export type OutboxJob = {
  id: string;
  uid: string;
  cid: string;
  createdAt: number;
  attempts: number;
  state: 'waiting' | 'uploading' | 'retrying' | 'offline';
  progress: number; // 0..1 across all files
  files: OutboxFile[];
  target: OutboxTarget;
  allowSave: boolean;
  /** View-once media is deleted by the recipient right after opening. */
  visibility?: 'couple' | 'viewOnce';
  /** Disappearing notes: epoch ms after which the note fades. */
  expiresAtMs?: number;
};

const STORAGE_KEY = 'together.outbox.v1';
const persistent = Platform.OS !== 'web';

let jobs: OutboxJob[] = [];
let loaded = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let online = true;
const listeners = new Set<() => void>();

function emit() {
  jobs = [...jobs];
  listeners.forEach((l) => l());
}

async function save() {
  if (!persistent) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.map((j) => ({ ...j, state: 'waiting', progress: 0 }))));
}

function outboxDir(): Directory {
  const dir = new Directory(Paths.document, 'outbox');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function keepLocalCopy(file: OutboxFile): Promise<OutboxFile> {
  if (!persistent) return file;
  try {
    const dest = new File(outboxDir(), `${file.mediaId}.${file.ext}`);
    await new File(file.localUri).copy(dest);
    let thumbUri = file.thumbUri;
    if (thumbUri) {
      const t = new File(outboxDir(), `${file.mediaId}_thumb.jpg`);
      await new File(thumbUri).copy(t);
      thumbUri = t.uri;
    }
    return { ...file, localUri: dest.uri, thumbUri };
  } catch {
    return file; // fall back to the original location
  }
}

function removeLocalCopy(file: OutboxFile) {
  if (!persistent || !file.localUri.includes('/outbox/')) return;
  for (const uri of [file.localUri, file.thumbUri]) {
    try {
      if (uri) new File(uri).delete();
    } catch {
      // already gone
    }
  }
}

export const outbox = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): OutboxJob[] {
    return jobs;
  },

  async load() {
    if (loaded) return;
    loaded = true;
    if (persistent) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) jobs = JSON.parse(raw) as OutboxJob[];
      } catch {
        jobs = [];
      }
    }
    NetInfo.addEventListener((s) => {
      const nowOnline = s.isConnected !== false && s.isInternetReachable !== false;
      const cameBack = nowOnline && !online;
      online = nowOnline;
      if (!online) {
        jobs.forEach((j) => j.state !== 'uploading' && (j.state = 'offline'));
        emit();
      }
      if (cameBack) outbox.kick();
    });
    emit();
  },

  async enqueue(job: Omit<OutboxJob, 'createdAt' | 'attempts' | 'state' | 'progress'>) {
    const files = await Promise.all(job.files.map(keepLocalCopy));
    jobs.push({ ...job, files, createdAt: Date.now(), attempts: 0, state: 'waiting', progress: 0 });
    emit();
    await save();
    outbox.kick();
  },

  /** Give up on a job (user tapped "Don't send"). */
  async discard(id: string) {
    const job = jobs.find((j) => j.id === id);
    job?.files.forEach(removeLocalCopy);
    jobs = jobs.filter((j) => j.id !== id);
    emit();
    await save();
  },

  /** Try now, e.g. user tapped "Try again". */
  kick(uid?: string) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void run(uid);
  },
};

let activeUid: string | undefined;

async function run(uid?: string) {
  if (uid) activeUid = uid;
  if (running || !activeUid) return;
  running = true;
  try {
    for (const job of jobs.filter((j) => j.uid === activeUid)) {
      if (!online) {
        job.state = 'offline';
        emit();
        continue;
      }
      try {
        await processJob(job);
        if (job.cid && job.target.kind !== 'vault') void care({ uid: job.uid, cid: job.cid });
        job.files.forEach(removeLocalCopy);
        jobs = jobs.filter((j) => j.id !== job.id);
        emit();
        await save();
      } catch {
        job.attempts += 1;
        job.state = online ? 'retrying' : 'offline';
        emit();
        await save();
      }
    }
  } finally {
    running = false;
  }
  const pending = jobs.filter((j) => j.uid === activeUid);
  if (pending.length) {
    const attempts = Math.min(...pending.map((j) => j.attempts));
    const delay = Math.min(60_000, 2000 * 2 ** Math.max(0, attempts - 1));
    timer = setTimeout(() => void run(), delay);
  }
}

async function upload(path: string, uri: string, contentType: string, onProgress: (p: number) => void): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: contentType || blob.type });
    task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
  });
  return blob.size;
}

function isPrivate(job: OutboxJob, f: OutboxFile) {
  return job.target.kind === 'checkIn' || job.target.kind === 'vault' || f.scope === 'private';
}

function pathFor(job: OutboxJob, f: OutboxFile) {
  return isPrivate(job, f) ? privatePath(job.uid, f.mediaId, f.ext) : storagePath(job.cid, job.uid, f.mediaId, f.ext);
}

async function processJob(job: OutboxJob) {
  job.state = 'uploading';
  emit();

  const total = job.files.length;
  for (let i = 0; i < total; i++) {
    const f = job.files[i];
    if (!f.uploaded) {
      f.bytes = await upload(pathFor(job, f), f.localUri, f.contentType, (p) => {
        job.progress = (i + p * 0.9) / total;
        emit();
      });
      f.uploaded = true;
      await save();
    }
    if (f.thumbUri && !f.thumbUploaded) {
      await upload(storagePath(job.cid, job.uid, `${f.mediaId}_thumb`, 'jpg'), f.thumbUri, 'image/jpeg', () => {});
      f.thumbUploaded = true;
      await save();
    }
  }

  const t = job.target;

  // Private check-in: no shared records at all.
  if (t.kind === 'checkIn') {
    const f = job.files[0];
    const checkIn: Record<string, unknown> = { at: serverTimestamp() };
    if (t.text?.trim()) checkIn.text = t.text.trim();
    if (f) {
      checkIn.voicePath = privatePath(job.uid, f.mediaId, f.ext);
      if (f.durationMs) checkIn.voiceMs = Math.round(f.durationMs);
    }
    if (t.memoryId) checkIn.memoryId = t.memoryId;
    await setDoc(doc(db, 'users', job.uid, 'days', t.date), { date: t.date, checkIn }, { merge: true });
    return;
  }

  if (t.kind === 'vault') {
    const batch = writeBatch(db);
    for (const f of job.files) {
      const item: Record<string, unknown> = {
        type: f.type,
        path: privatePath(job.uid, f.mediaId, f.ext),
        contentType: f.contentType,
        bytes: f.bytes ?? 0,
        createdAt: serverTimestamp(),
      };
      if (f.width) item.width = f.width;
      if (f.height) item.height = f.height;
      if (f.durationMs) item.durationMs = Math.round(f.durationMs);
      if (t.caption?.trim()) item.caption = t.caption.trim();
      batch.set(doc(db, 'users', job.uid, 'vault', f.mediaId), item);
    }
    await batch.commit();
    return;
  }

  if (t.kind === 'mood') {
    const priv = job.files.find((f) => isPrivate(job, f));
    const shared = job.files.find((f) => !isPrivate(job, f));
    const batch = writeBatch(db);
    const mood: Record<string, unknown> = {};
    if (priv) {
      mood.media = { type: priv.type, path: privatePath(job.uid, priv.mediaId, priv.ext), ...(priv.durationMs ? { durationMs: Math.round(priv.durationMs) } : {}) };
    }
    if (shared && job.cid) {
      const media: Record<string, unknown> = {
        ownerId: job.uid,
        type: shared.type,
        storagePath: storagePath(job.cid, job.uid, shared.mediaId, shared.ext),
        contentType: shared.contentType,
        bytes: shared.bytes ?? 0,
        visibility: 'couple',
        allowSave: false,
        parent: { kind: 'mood', id: t.date },
        createdAt: serverTimestamp(),
      };
      if (shared.width) media.width = shared.width;
      if (shared.height) media.height = shared.height;
      if (shared.durationMs) media.durationMs = Math.round(shared.durationMs);
      batch.set(doc(db, 'couples', job.cid, 'media', shared.mediaId), media);
      mood.sharedMediaId = shared.mediaId;
    }
    batch.set(doc(db, 'users', job.uid, 'days', t.date), { date: t.date, mood }, { merge: true });
    await batch.commit();
    await reprojectDay({ uid: job.uid, cid: job.cid || null }, t.date);
    return;
  }

  const batch = writeBatch(db);
  const gratitudeId = t.kind === 'gratitude' ? `${job.uid}_${t.date}` : '';
  const parent =
    t.kind === 'message'
      ? { kind: 'message' as const, id: t.messageId }
      : t.kind === 'memory'
        ? { kind: 'memory' as const, id: t.memoryId }
        : t.kind === 'scheduled'
          ? { kind: 'scheduled' as const, id: t.noteId }
          : t.kind === 'tripEntry'
            ? { kind: 'trip' as const, id: t.tripId }
          : { kind: 'gratitude' as const, id: gratitudeId };
  const expiresAt = job.expiresAtMs ? Timestamp.fromMillis(job.expiresAtMs) : null;
  // Surprise media stays hidden from the partner until it unlocks.
  const hiddenUntil = t.kind === 'scheduled' ? Timestamp.fromMillis(t.deliverAtMs) : null;

  for (const f of job.files) {
    const media: Record<string, unknown> = {
      ownerId: job.uid,
      type: f.type,
      storagePath: storagePath(job.cid, job.uid, f.mediaId, f.ext),
      contentType: f.contentType,
      bytes: f.bytes ?? 0,
      visibility: job.visibility ?? 'couple',
      allowSave: job.visibility === 'viewOnce' ? false : job.allowSave,
      parent,
      createdAt: serverTimestamp(),
    };
    if (f.width) media.width = f.width;
    if (f.height) media.height = f.height;
    if (f.durationMs) media.durationMs = Math.round(f.durationMs);
    if (f.thumbUploaded) media.thumbPath = storagePath(job.cid, job.uid, `${f.mediaId}_thumb`, 'jpg');
    if (expiresAt) media.expiresAt = expiresAt;
    if (hiddenUntil) media.hiddenUntil = hiddenUntil;
    batch.set(doc(db, 'couples', job.cid, 'media', f.mediaId), media);
  }

  if (t.kind === 'message') {
    const msg: Record<string, unknown> = {
      fromUid: job.uid,
      toUid: t.toUid,
      kind: t.msgKind,
      mediaId: job.files[0]?.mediaId,
      favoriteBy: [],
      createdAt: serverTimestamp(),
    };
    if (t.text?.trim()) msg.text = t.text.trim();
    if (t.voiceHug) msg.voiceHug = true;
    if (job.visibility === 'viewOnce') msg.viewOnce = true;
    if (expiresAt) msg.expiresAt = expiresAt;
    batch.set(doc(db, 'couples', job.cid, 'messages', t.messageId), msg);
  } else if (t.kind === 'scheduled') {
    const note: Record<string, unknown> = {
      fromUid: job.uid,
      toUid: t.toUid,
      kind: t.msgKind,
      surprise: t.surprise,
      deliverAt: Timestamp.fromMillis(t.deliverAtMs),
      favoriteBy: [],
      createdAt: serverTimestamp(),
    };
    if (t.text?.trim()) note.text = t.text.trim();
    if (job.files[0]) note.mediaId = job.files[0].mediaId;
    batch.set(doc(db, 'couples', job.cid, 'scheduled', t.noteId), note);
  } else if (t.kind === 'tripEntry') {
    const f = job.files[0];
    const entry: Record<string, unknown> = { ownerId: job.uid, type: f?.type ?? 'note', date: t.date, createdAt: serverTimestamp() };
    if (f) entry.mediaId = f.mediaId;
    if (t.caption?.trim()) entry.caption = t.caption.trim();
    if (t.mood) entry.mood = t.mood;
    batch.set(doc(db, 'couples', job.cid, 'trips', t.tripId, 'entries', t.entryId), entry);
  } else if (t.kind === 'memory') {
    batch.set(doc(db, 'couples', job.cid, 'memories', t.memoryId), {
      ownerId: job.uid,
      caption: t.caption.trim(),
      date: t.date,
      mediaIds: job.files.map((f) => f.mediaId),
      createdAt: serverTimestamp(),
    });
  } else {
    const g: Record<string, unknown> = {
      ownerId: job.uid,
      toUid: t.toUid,
      date: t.date,
      createdAt: serverTimestamp(),
    };
    if (t.text?.trim()) g.text = t.text.trim();
    if (job.files[0]) g.mediaId = job.files[0].mediaId;
    batch.set(doc(db, 'couples', job.cid, 'gratitude', gratitudeId), g);
  }
  await batch.commit();
}

export function privatePath(uid: string, mediaId: string, ext: string) {
  return `users/${uid}/private/${mediaId}.${ext}`;
}

export function storagePath(cid: string, uid: string, mediaId: string, ext: string) {
  return `couples/${cid}/media/${uid}/${mediaId}.${ext}`;
}
