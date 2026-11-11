/** Shared helpers for picking media and queueing sends through the outbox. */
import * as ImagePicker from 'expo-image-picker';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { Platform } from 'react-native';

import { dayKey } from './dates';
import { LIMITS, newId, prepareImage, voiceFormat, type PreparedImage } from './media';
import { outbox, type OutboxFile } from './outbox';

export async function pickPhoto(source: 'camera' | 'library'): Promise<PreparedImage | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true, // lets people crop before sending
    quality: 1,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return prepareImage(a.uri, a.width, a.height);
}

export type PickedVideo = {
  uri: string;
  durationMs: number;
  width: number;
  height: number;
  contentType: string;
  ext: string;
  thumbUri?: string;
};

/**
 * Pick or record a video up to 60 seconds. On iOS the system editor lets people
 * trim before sending. Returns 'too-long' so the caller can say so kindly.
 */
export async function pickVideo(source: 'camera' | 'library'): Promise<PickedVideo | 'too-long' | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    allowsEditing: true,
    videoMaxDuration: LIMITS.videoMaxMs / 1000,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const durationMs = a.duration ?? 0;
  if (durationMs > LIMITS.videoMaxMs + 500) return 'too-long';
  const contentType = a.mimeType || (Platform.OS === 'web' ? 'video/webm' : 'video/mp4');
  const ext = contentType.includes('quicktime') ? 'mov' : contentType.includes('webm') ? 'webm' : 'mp4';
  let thumbUri: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      thumbUri = (await getThumbnailAsync(a.uri, { time: 500, quality: 0.7 })).uri;
    } catch {
      thumbUri = undefined; // a poster is nice to have, never required
    }
  }
  return { uri: a.uri, durationMs, width: a.width, height: a.height, contentType, ext, thumbUri };
}

type Who = { uid: string; cid: string; partnerId: string };

/** Privacy options for a love note. */
export type NoteOptions = {
  allowSave: boolean;
  viewOnce?: boolean;
  /** Fades after 24 hours. */
  disappearing?: boolean;
};

function noteJob(who: Who, file: OutboxFile, msgKind: 'photo' | 'voice' | 'video', opts: NoteOptions, extra: { text?: string; voiceHug?: boolean; status?: boolean } = {}) {
  return outbox.enqueue({
    id: newId(),
    uid: who.uid,
    cid: who.cid,
    allowSave: opts.viewOnce ? false : opts.allowSave,
    visibility: opts.viewOnce ? 'viewOnce' : 'couple',
    expiresAtMs: opts.disappearing ? Date.now() + 24 * 3600_000 : undefined,
    files: [file],
    target: { kind: 'message', messageId: newId(), toUid: who.partnerId, msgKind, ...extra },
  });
}

export async function queuePhotoNote(who: Who, photo: PreparedImage, caption: string, opts: NoteOptions) {
  await noteJob(
    who,
    { mediaId: newId(), localUri: photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: photo.width, height: photo.height },
    'photo',
    opts,
    { text: caption },
  );
}

export async function queueVoiceNote(who: Who, uri: string, durationMs: number, voiceHug: boolean, opts: NoteOptions) {
  const { ext, contentType } = voiceFormat(uri);
  await noteJob(
    who,
    { mediaId: newId(), localUri: uri, type: 'voice', contentType, ext, durationMs: Math.min(durationMs, LIMITS.voiceMaxMs) },
    'voice',
    opts,
    { voiceHug },
  );
}

export async function queueVideoNote(who: Who, v: PickedVideo, caption: string, opts: NoteOptions) {
  await noteJob(
    who,
    {
      mediaId: newId(),
      localUri: v.uri,
      type: 'video',
      contentType: v.contentType,
      ext: v.ext,
      width: v.width,
      height: v.height,
      durationMs: v.durationMs,
      // View-once videos skip the poster frame, so nothing lingers after opening.
      thumbUri: opts.viewOnce ? undefined : v.thumbUri,
    },
    'video',
    opts,
    { text: caption },
  );
}

export async function queueMemory(
  who: Omit<Who, 'partnerId'>,
  caption: string,
  date: string,
  photo: PreparedImage | null,
  voice: { uri: string; durationMs: number } | null,
  memoryId: string = newId(),
): Promise<string> {
  const files: OutboxFile[] = [];
  if (photo) {
    files.push({ mediaId: newId(), localUri: photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: photo.width, height: photo.height });
  }
  if (voice) {
    const { ext, contentType } = voiceFormat(voice.uri);
    files.push({ mediaId: newId(), localUri: voice.uri, type: 'voice', contentType, ext, durationMs: voice.durationMs });
  }
  await outbox.enqueue({
    id: newId(),
    uid: who.uid,
    cid: who.cid,
    allowSave: false,
    files,
    target: { kind: 'memory', memoryId, caption, date },
  });
  return memoryId;
}

/** A private voice answer for the evening check-in (never leaves my own storage). */
export async function queueCheckInVoice(uid: string, uri: string, durationMs: number, text: string, memoryId?: string, date = dayKey()) {
  const { ext, contentType } = voiceFormat(uri);
  await outbox.enqueue({
    id: newId(),
    uid,
    cid: '',
    allowSave: false,
    files: [{ mediaId: newId(), localUri: uri, type: 'voice', contentType, ext, durationMs }],
    target: { kind: 'checkIn', date, text, memoryId },
  });
}

/** Today's thank-you with a photo or voice note (text-only goes straight to Firestore). */
export async function queueGratitudeMedia(
  who: Who,
  media: { kind: 'photo'; photo: PreparedImage } | { kind: 'voice'; uri: string; durationMs: number },
  text: string,
  date = dayKey(),
) {
  const file: OutboxFile =
    media.kind === 'photo'
      ? { mediaId: newId(), localUri: media.photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: media.photo.width, height: media.photo.height }
      : { mediaId: newId(), localUri: media.uri, type: 'voice', ...voiceFormat(media.uri), durationMs: media.durationMs };
  await outbox.enqueue({
    id: newId(),
    uid: who.uid,
    cid: who.cid,
    allowSave: false,
    files: [file],
    target: { kind: 'gratitude', toUid: who.partnerId, date, text },
  });
}

/** A selfie for a mood check-in, front camera first. */
export async function pickSelfie(): Promise<PreparedImage | null> {
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: true,
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return prepareImage(a.uri, a.width, a.height);
}

export type MoodAttachment = { kind: 'photo'; photo: PreparedImage } | { kind: 'voice'; uri: string; durationMs: number };

function attachmentFile(a: MoodAttachment, scope: 'private' | 'couple'): OutboxFile {
  return a.kind === 'photo'
    ? { mediaId: newId(), scope, localUri: a.photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: a.photo.width, height: a.photo.height }
    : { mediaId: newId(), scope, localUri: a.uri, type: 'voice', ...voiceFormat(a.uri), durationMs: a.durationMs };
}

/**
 * Attach a selfie or voice note to today's mood. It always goes to private
 * storage; a shared copy is made only when both mood and photo/voice sharing are on.
 */
export async function queueMoodMedia(uid: string, cid: string | null, a: MoodAttachment, shareCopy: boolean, date = dayKey()) {
  const files = [attachmentFile(a, 'private')];
  if (shareCopy && cid) files.push(attachmentFile(a, 'couple'));
  await outbox.enqueue({ id: newId(), uid, cid: cid ?? '', allowSave: false, files, target: { kind: 'mood', date } });
}

/** Add something to the private vault. It never leaves my private storage. */
export async function queueVaultItem(
  uid: string,
  item: { kind: 'photo'; photo: PreparedImage } | { kind: 'voice'; uri: string; durationMs: number } | { kind: 'video'; video: PickedVideo },
  caption?: string,
) {
  const file: OutboxFile =
    item.kind === 'photo'
      ? { mediaId: newId(), localUri: item.photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: item.photo.width, height: item.photo.height }
      : item.kind === 'voice'
        ? { mediaId: newId(), localUri: item.uri, type: 'voice', ...voiceFormat(item.uri), durationMs: item.durationMs }
        : { mediaId: newId(), localUri: item.video.uri, type: 'video', contentType: item.video.contentType, ext: item.video.ext, width: item.video.width, height: item.video.height, durationMs: item.video.durationMs };
  await outbox.enqueue({ id: newId(), uid, cid: '', allowSave: false, files: [file], target: { kind: 'vault', caption } });
}

/** A travel journal entry with a photo, video, or voice diary. */
export async function queueTripEntry(
  who: Omit<Who, 'partnerId'>,
  tripId: string,
  media: { kind: 'photo'; photo: PreparedImage } | { kind: 'voice'; uri: string; durationMs: number } | { kind: 'video'; video: PickedVideo },
  caption: string,
  mood: string | undefined,
  date = dayKey(),
) {
  const file: OutboxFile =
    media.kind === 'photo'
      ? { mediaId: newId(), localUri: media.photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: media.photo.width, height: media.photo.height }
      : media.kind === 'voice'
        ? { mediaId: newId(), localUri: media.uri, type: 'voice', ...voiceFormat(media.uri), durationMs: media.durationMs }
        : {
            mediaId: newId(),
            localUri: media.video.uri,
            type: 'video',
            contentType: media.video.contentType,
            ext: media.video.ext,
            width: media.video.width,
            height: media.video.height,
            durationMs: media.video.durationMs,
            thumbUri: media.video.thumbUri,
          };
  await outbox.enqueue({
    id: newId(),
    uid: who.uid,
    cid: who.cid,
    allowSave: true,
    files: [file],
    target: { kind: 'tripEntry', tripId, entryId: newId(), caption, mood, date },
  });
}

/** A scheduled or surprise note with a photo or voice note (media stays hidden until it unlocks). */
export async function queueScheduledMedia(
  who: Who,
  media: { kind: 'photo'; photo: PreparedImage } | { kind: 'voice'; uri: string; durationMs: number },
  text: string,
  deliverAtMs: number,
  surprise: 'none' | 'date' | 'open',
) {
  const file: OutboxFile =
    media.kind === 'photo'
      ? { mediaId: newId(), localUri: media.photo.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: media.photo.width, height: media.photo.height }
      : { mediaId: newId(), localUri: media.uri, type: 'voice', ...voiceFormat(media.uri), durationMs: media.durationMs };
  await outbox.enqueue({
    id: newId(),
    uid: who.uid,
    cid: who.cid,
    allowSave: false,
    files: [file],
    target: { kind: 'scheduled', noteId: newId(), toUid: who.partnerId, msgKind: media.kind, text, surprise, deliverAtMs },
  });
}

/**
 * Post a status: a photo or video your partner sees in the status ring for 24
 * hours. It's also a love note, so it stays in Notes (and its photos and
 * videos page) to look back on.
 */
export async function queueStatus(who: Who, media: { kind: 'photo'; photo: PreparedImage } | { kind: 'video'; video: PickedVideo }, caption: string) {
  const opts: NoteOptions = { allowSave: true };
  if (media.kind === 'photo') {
    const p = media.photo;
    await noteJob(who, { mediaId: newId(), localUri: p.uri, type: 'photo', contentType: 'image/jpeg', ext: 'jpg', width: p.width, height: p.height }, 'photo', opts, { text: caption, status: true });
  } else {
    const v = media.video;
    await noteJob(
      who,
      { mediaId: newId(), localUri: v.uri, type: 'video', contentType: v.contentType, ext: v.ext, width: v.width, height: v.height, durationMs: v.durationMs, thumbUri: v.thumbUri },
      'video',
      opts,
      { text: caption, status: true },
    );
  }
}
