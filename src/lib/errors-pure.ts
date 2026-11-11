/** Shaping an error into a short, safe report. Pure, so it's easy to test. */

export type ErrorKind = 'crash' | 'error' | 'promise';
export type ErrorReport = { kind: ErrorKind; message: string; stack: string; route: string; platform: string; agent: string; version: string };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const LONG_NUMBER = /\b\d{6,}\b/g;
const QUERY = /\?[^\s)]*/g;

/** Keeps it short, and removes things that could be personal (emails, long numbers, link parameters). */
export function scrub(text: string, max: number): string {
  return text.replace(EMAIL, '[email]').replace(LONG_NUMBER, '[number]').replace(QUERY, '').slice(0, max);
}

export function cleanErrorReport(error: unknown, ctx: { kind: ErrorKind; route: string; platform: string; agent: string; version: string }): ErrorReport {
  const e = error as { name?: unknown; message?: unknown; stack?: unknown } | null;
  const raw = typeof error === 'string' ? error : e && typeof e.message === 'string' ? `${typeof e.name === 'string' && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}` : 'Unknown error';
  return {
    kind: ctx.kind,
    message: scrub(raw || 'Unknown error', 300),
    stack: scrub(e && typeof e.stack === 'string' ? e.stack : '', 2000),
    // Screen paths only (ids look like long random strings; keep the shape, not the id).
    route: scrub(ctx.route.replace(/\/[A-Za-z0-9_-]{16,}/g, '/[id]'), 120),
    platform: ctx.platform.slice(0, 20),
    agent: ctx.agent.slice(0, 200),
    version: ctx.version.slice(0, 20),
  };
}
