/**
 * Saving received media (when the sender allows it), storage usage, and
 * "free up space".
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from './firebase';
import { useMediaUrl } from './media';
import type { Media } from './types';

export { useMediaUrl };

/** Save a received photo or video to this device. Only offered when allowSave is true. */
export async function saveToDevice(url: string, media: Pick<Media, 'id' | 'contentType' | 'type'>): Promise<'saved' | 'denied'> {
  const ext = media.type === 'photo' ? 'jpg' : media.contentType.includes('webm') ? 'webm' : 'mp4';
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = url;
    a.download = `together-${media.id}.${ext}`;
    a.target = '_blank';
    a.click();
    return 'saved';
  }
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) return 'denied';
  const dest = new File(Paths.cache, `together-${media.id}.${ext}`);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(url, dest);
  await Asset.create(file.uri);
  file.delete();
  return 'saved';
}

export type Usage = {
  shared: { photo: number; voice: number; video: number; count: number };
  vault: { bytes: number; count: number };
  largest: (Media & { id: string })[];
};

/** What I've uploaded: shared media I own, and my private vault. */
export async function loadUsage(uid: string, cid: string | null): Promise<Usage> {
  const shared = { photo: 0, voice: 0, video: 0, count: 0 };
  let largest: (Media & { id: string })[] = [];
  if (cid) {
    const snap = await getDocs(query(collection(db, 'couples', cid, 'media'), where('ownerId', '==', uid)));
    const all = snap.docs.map((d) => ({ ...(d.data() as Media), id: d.id }));
    all.forEach((m) => {
      shared[m.type] += m.bytes ?? 0;
      shared.count += 1;
    });
    largest = all.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 8);
  }
  const vaultSnap = await getDocs(collection(db, 'users', uid, 'vault'));
  const vault = { bytes: 0, count: vaultSnap.size };
  vaultSnap.docs.forEach((d) => (vault.bytes += (d.data().bytes as number) ?? 0));
  return { shared, vault, largest };
}

/** Bytes used by caches on this device (thumbnails, downloaded media, temp recordings). */
export function deviceCacheBytes(): number | null {
  if (Platform.OS === 'web') return null;
  try {
    return new Directory(Paths.cache).size ?? 0;
  } catch {
    return null;
  }
}

/**
 * Free up space on this device. Only caches: nothing you've sent, saved or
 * queued is touched (the outbox lives in the document folder, not the cache).
 */
export async function clearDeviceCache(): Promise<void> {
  await Image.clearDiskCache().catch(() => false);
  await Image.clearMemoryCache().catch(() => false);
  if (Platform.OS === 'web') return;
  for (const entry of new Directory(Paths.cache).list()) {
    try {
      entry.delete();
    } catch {
      // in use; skip
    }
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
