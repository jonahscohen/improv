import type { EnvironmentInfo } from './types.js';

/**
 * Server-side environment helpers. The browser is untrusted: push_changes /
 * push_annotations carry an `environment` that a malformed or hostile client can
 * shape however it likes. normalizeEnvironment() coerces it to the documented
 * shape (or rejects it), so the render path can never crash on a missing field
 * and never forwards oversized/instruction-like strings verbatim into Claude's
 * context. formatEnvironmentLines() mirrors core/environment.ts byte-for-byte for
 * valid input (core and server are separate build targets and duplicate shared
 * shapes, as with AdapterEnrichment).
 */

const MAX_STR = 256;

function cleanStr(v: unknown, max = MAX_STR): string {
  if (typeof v !== 'string') return '';
  // Strip control chars/newlines and collapse whitespace so a userAgent cannot
  // smuggle formatting or instructions into the documented block, then cap length.
  return v.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finiteNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Validate + sanitize an untrusted environment payload. Returns null when the
 *  payload is not an object at all (so callers can treat "no environment" and
 *  "garbage environment" the same way). */
export function normalizeEnvironment(raw: unknown): EnvironmentInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const vp = (r.viewport ?? {}) as Record<string, unknown>;
  const br = (r.browser ?? {}) as Record<string, unknown>;
  return {
    viewport: {
      width: finiteNum(vp.width, 0),
      height: finiteNum(vp.height, 0),
      devicePixelRatio: finiteNum(vp.devicePixelRatio, 1),
    },
    browser: {
      name: cleanStr(br.name, 64) || 'Unknown',
      version: cleanStr(br.version, 32),
    },
    os: cleanStr(r.os, 64) || 'Unknown',
    userAgent: cleanStr(r.userAgent, 512),
  };
}

/** Documented prompt lines for a (normalized) environment. Null-safe: a missing
 *  viewport yields no lines rather than throwing. */
export function formatEnvironmentLines(env: EnvironmentInfo | null | undefined): string[] {
  if (!env || !env.viewport) return [];
  const { width, height, devicePixelRatio } = env.viewport;
  const dprSuffix = devicePixelRatio && devicePixelRatio !== 1 ? ` @${devicePixelRatio}x` : '';
  const name = env.browser?.name || 'Unknown';
  const browser = env.browser?.version ? `${name} ${env.browser.version}` : name;
  return [`Viewport: ${width}x${height}${dprSuffix}`, `Browser: ${browser}`, `OS: ${env.os || 'Unknown'}`];
}

/** True when two environments would render identically. Used to keep the
 *  apply-changes block honest: it is shown only when every accumulated batch
 *  agrees, and omitted (never guessed) when batches disagree. */
export function environmentsEqual(
  a: EnvironmentInfo | null | undefined,
  b: EnvironmentInfo | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return formatEnvironmentLines(a).join('\n') === formatEnvironmentLines(b).join('\n');
}
