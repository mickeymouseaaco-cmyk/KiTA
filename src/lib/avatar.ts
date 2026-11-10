/**
 * Profile pictures. One small square photo per person, stored privately at
 * users/{uid}/avatar/{id}.jpg. Only you and your current partner can open it
 * (the Storage rule checks you share an active couple).
 *
 * Where it is known:
 * - users/{uid}.avatarId  : yours (private profile).
 * - couples/{cid}.avatars : { uid: id } so your partner knows which file to show.
 *   The pairing function copies it in when you pair or reconnect.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';
import { newId, useMediaUrl } from './media';

export const AVATAR_SIZE = 512;

export function avatarPath(uid: string, avatarId: string): string {
  return `users/${uid}/avatar/${avatarId}.jpg`;
}

/** The centred square of an image, as a crop box. */
export function centreSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { originX: Math.round((width - side) / 2), originY: Math.round((height - side) / 2), width: side, height: side };
}

/** Pick or take a photo, then crop it square and make it small. */
export async function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    ...(source === 'camera' ? { cameraType: ImagePicker.CameraType.front } : null),
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  // The web picker can't crop, so make sure it's square either way.
  if (a.width && a.height && a.width !== a.height) ctx.crop(centreSquare(a.width, a.height));
  ctx.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

/** Upload a new picture, point to it, then remove the old file. */
export async function setMyAvatar(opts: { uid: string; cid: string | null; uri: string; previousId?: string | null }) {
  const id = newId();
  const blob = await (await fetch(opts.uri)).blob();
  await uploadBytes(ref(storage, avatarPath(opts.uid, id)), blob, { contentType: 'image/jpeg' });
  await updateDoc(doc(db, 'users', opts.uid), { avatarId: id });
  if (opts.cid) await updateDoc(doc(db, 'couples', opts.cid), { [`avatars.${opts.uid}`]: id }).catch(() => {});
  if (opts.previousId) await deleteObject(ref(storage, avatarPath(opts.uid, opts.previousId))).catch(() => {});
  return id;
}

export async function removeMyAvatar(opts: { uid: string; cid: string | null; previousId?: string | null }) {
  await updateDoc(doc(db, 'users', opts.uid), { avatarId: null });
  if (opts.cid) await updateDoc(doc(db, 'couples', opts.cid), { [`avatars.${opts.uid}`]: deleteField() }).catch(() => {});
  if (opts.previousId) await deleteObject(ref(storage, avatarPath(opts.uid, opts.previousId))).catch(() => {});
}

/** The download URL for someone's picture, or null while loading / when there is none. */
export function useAvatarUrl(uid: string | null | undefined, avatarId: string | null | undefined) {
  return useMediaUrl(uid && avatarId ? avatarPath(uid, avatarId) : undefined).url;
}
