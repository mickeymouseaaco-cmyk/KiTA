/**
 * Pure helpers for syncing steps from Apple Health via an iPhone Shortcut.
 * No Firebase imports, so they can be unit-tested anywhere.
 */
import { createHash, randomBytes } from 'node:crypto';

/** Highest believable daily step count. Anything above is refused as a typo. */
export const MAX_STEPS = 150_000;

/** A new secret for one person's sync link: 32 URL-safe characters. */
export function newStepsToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Tokens are looked up by their hash, so the lookup table never holds a usable secret. */
export function hashStepsToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Steps as the Shortcut sends them. Health sums can arrive as "8412", "8,412",
 * "8412.0" or "8 412", depending on the phone's region settings.
 */
export function parseSteps(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 && raw <= MAX_STEPS ? Math.round(raw) : null;
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[\s  ']/g, '');
  if (!/\d/.test(s)) return null;
  // "8.412" or "8,412" with exactly three digits after one separator is a thousands separator.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(/,/g, '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && n <= MAX_STEPS ? n : null;
}

/** Today's date (YYYY-MM-DD) in the couple's time zone. */
export function dayKeyIn(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/**
 * Which day the steps belong to: the date the Shortcut sends if it is today or
 * yesterday (a late-night sync), otherwise today.
 */
export function syncDay(requested: unknown, timeZone: string, at: Date = new Date()): string {
  const today = dayKeyIn(timeZone, at);
  const yesterday = dayKeyIn(timeZone, new Date(at.getTime() - 86_400_000));
  return typeof requested === 'string' && (requested === today || requested === yesterday) ? requested : today;
}
