/**
 * Notes wallpaper: a picture or a soft colour behind your notes, like WhatsApp.
 * Each person picks their own (it only changes what you see).
 *
 * Stored as users/{uid}.notesWallpaper:
 * - 'preset:<id>'  one of the built-in looks below
 * - 'photo:<id>'   your own photo at users/{uid}/private/wp_<id>.jpg (only you can open it)
 * - null           no wallpaper
 */
import { doc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from './firebase';
import { newId, useMediaUrl, type PreparedImage } from './media';

export type WallpaperPreset = { id: string; label: string; from: string; to: string; hearts?: boolean };

export const WALLPAPER_PRESETS: readonly WallpaperPreset[] = [
  { id: 'blush', label: 'Blush', from: '#FFE1EA', to: '#FFF5EE' },
  { id: 'hearts', label: 'Little hearts', from: '#FFE8EF', to: '#FFF7F2', hearts: true },
  { id: 'sky', label: 'Sky', from: '#D9E8FF', to: '#F2EEFF' },
  { id: 'mint', label: 'Mint', from: '#D6F3E6', to: '#F5FBF2' },
  { id: 'sunset', label: 'Sunset', from: '#FFD3A8', to: '#FFB3CB' },
  { id: 'night', label: 'Night', from: '#1E1A36', to: '#3B2152' },
];

export type Wallpaper = { kind: 'preset'; preset: WallpaperPreset } | { kind: 'photo'; id: string } | null;

/** Read the stored value; unknown or broken values mean no wallpaper. */
export function parseWallpaper(value: string | null | undefined): Wallpaper {
  if (!value) return null;
  const [kind, id] = value.split(':');
  if (kind === 'preset') {
    const preset = WALLPAPER_PRESETS.find((p) => p.id === id);
    return preset ? { kind: 'preset', preset } : null;
  }
  if (kind === 'photo' && id && /^[A-Za-z0-9_-]{1,40}$/.test(id)) return { kind: 'photo', id };
  return null;
}

export function wallpaperPath(uid: string, id: string): string {
  return `users/${uid}/private/wp_${id}.jpg`;
}

/** The photo's download URL (null while loading, or when it isn't a photo). */
export function useWallpaperUrl(uid: string, w: Wallpaper) {
  return useMediaUrl(w?.kind === 'photo' ? wallpaperPath(uid, w.id) : undefined).url;
}

async function removeOldPhoto(uid: string, previous: string | null | undefined) {
  const old = parseWallpaper(previous);
  if (old?.kind === 'photo') await deleteObject(ref(storage, wallpaperPath(uid, old.id))).catch(() => {});
}

export async function setPresetWallpaper(uid: string, presetId: string | null, previous: string | null | undefined) {
  await updateDoc(doc(db, 'users', uid), { notesWallpaper: presetId ? `preset:${presetId}` : null });
  await removeOldPhoto(uid, previous);
}

export async function setPhotoWallpaper(uid: string, photo: PreparedImage, previous: string | null | undefined) {
  const id = newId();
  const blob = await (await fetch(photo.uri)).blob();
  await uploadBytes(ref(storage, wallpaperPath(uid, id)), blob, { contentType: 'image/jpeg' });
  await updateDoc(doc(db, 'users', uid), { notesWallpaper: `photo:${id}` });
  await removeOldPhoto(uid, previous);
}
