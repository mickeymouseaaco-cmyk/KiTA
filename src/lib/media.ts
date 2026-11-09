import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { db, storage } from './firebase';
import type { Media } from './types';

export const LIMITS = {
  photoMaxEdge: 1600,
  voiceMaxMs: 5 * 60_000,
  voiceHugMs: 10_000,
  videoMaxMs: 60_000,
} as const;

/** Mint a Firestore-style id locally (no network). */
export function newId(): string {
  return doc(collection(db, '_ids')).id;
}

export type PreparedImage = { uri: string; width: number; height: number };

/** Auto-resize photos so they are light to send and store. */
export async function prepareImage(uri: string, width?: number, height?: number): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const longEdge = Math.max(width ?? 0, height ?? 0);
  if (!longEdge || longEdge > LIMITS.photoMaxEdge) {
    if ((width ?? 0) >= (height ?? 0)) ctx.resize({ width: LIMITS.photoMaxEdge });
    else ctx.resize({ height: LIMITS.photoMaxEdge });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** File extension and content type for a recorded voice note on this platform. */
export function voiceFormat(uri: string): { ext: string; contentType: string } {
  if (Platform.OS === 'web' || uri.startsWith('blob:')) return { ext: 'webm', contentType: 'audio/webm' };
  const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
  const map: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', caf: 'audio/x-caf', '3gp': 'audio/3gpp', webm: 'audio/webm' };
  return { ext, contentType: map[ext] ?? 'audio/mp4' };
}

// --------------------------------------------------------------- reading

const urlCache = new Map<string, string>();

/** A signed download URL for a stored file (fetched through security rules). */
export function useMediaUrl(storagePath: string | undefined) {
  const [result, setResult] = useState<{ path: string; url: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!storagePath || urlCache.has(storagePath)) return;
    let alive = true;
    getDownloadURL(ref(storage, storagePath))
      .then((u) => {
        urlCache.set(storagePath, u);
        if (alive) setResult({ path: storagePath, url: u, failed: false });
      })
      .catch(() => alive && setResult({ path: storagePath, url: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [storagePath]);
  if (!storagePath) return { url: null, failed: false };
  const cached = urlCache.get(storagePath);
  if (cached) return { url: cached, failed: false };
  const mine = result?.path === storagePath ? result : null;
  return { url: mine?.url ?? null, failed: mine?.failed ?? false };
}

/** Live media metadata. `null` means it was removed by its owner. */
export function useMedia(cid: string, mediaId: string | undefined) {
  const [media, setMedia] = useState<Media | null | undefined>(undefined);
  useEffect(() => {
    if (!mediaId) return;
    return onSnapshot(
      doc(db, 'couples', cid, 'media', mediaId),
      (snap) => setMedia(snap.exists() ? ({ id: snap.id, ...snap.data() } as Media) : null),
      () => setMedia(null),
    );
  }, [cid, mediaId]);
  return media;
}

/** The owner removes their media everywhere: the file and its record. */
export async function deleteMedia(cid: string, media: Pick<Media, 'id' | 'storagePath'>) {
  urlCache.delete(media.storagePath);
  await deleteObject(ref(storage, media.storagePath)).catch((e: { code?: string }) => {
    if (e?.code !== 'storage/object-not-found') throw e;
  });
  await deleteDoc(doc(db, 'couples', cid, 'media', media.id));
}
