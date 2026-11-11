/**
 * Status: photos and videos shown in a ring for 24 hours (like WhatsApp and
 * Instagram), which also stay in Love Notes. Pure, so it's easy to test.
 */
import type { Message } from './types';

export const STATUS_HOURS = 24;
const DAY_MS = STATUS_HOURS * 3600_000;

const atMs = (m: Pick<Message, 'createdAt'>) => m.createdAt?.toMillis?.() ?? Date.now();

/** Someone's statuses from the last 24 hours, oldest first (the order they're watched in). */
export function activeStatuses<T extends Pick<Message, 'status' | 'fromUid' | 'createdAt' | 'viewOnce'>>(messages: readonly T[], uid: string, nowMs = Date.now()): T[] {
  return messages
    .filter((m) => m.status && !m.viewOnce && m.fromUid === uid && nowMs - atMs(m) < DAY_MS)
    .sort((a, b) => atMs(a) - atMs(b));
}

/** How many of these I haven't seen yet. */
export function unseenCount(statuses: readonly Pick<Message, 'readAt'>[]): number {
  return statuses.filter((m) => !m.readAt).length;
}

/** Where to start watching: the first unseen one, or the beginning. */
export function startIndex(statuses: readonly Pick<Message, 'readAt'>[]): number {
  const i = statuses.findIndex((m) => !m.readAt);
  return i < 0 ? 0 : i;
}

/** Notes from my partner I haven't opened yet (for the Notes tab badge). */
export function unreadNotes<T extends Pick<Message, 'fromUid' | 'readAt' | 'kind'>>(messages: readonly T[], uid: string): number {
  return messages.filter((m) => m.fromUid !== uid && !m.readAt).length;
}

/** "2h ago", "just now". */
export function statusAge(createdMs: number | undefined, nowMs = Date.now()): string {
  if (createdMs === undefined) return 'just now';
  const min = Math.max(0, Math.floor((nowMs - createdMs) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
