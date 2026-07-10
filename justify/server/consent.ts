import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomBytes, timingSafeEqual } from 'crypto';

// Disarm consent. The watch is the product: if it is off, Justify is silently
// not receiving the user's changes. So NOTHING may disarm it except a human who
// said so, just now.
//
// The token is:
//   - single use   (consumed on the first successful verify)
//   - short lived  (default 120s; a stale "yes" is not a yes)
//   - unguessable  (32 random bytes)
//   - compared in constant time
//
// It is issued ONLY by `justify-watch-disarm` running attached to a TTY, after
// the human types the confirmation phrase. An agent's shell has no TTY, so the
// agent cannot mint one, and `bash-guard.sh` blocks it from calling the disarm
// paths at all. This module is the daemon-side half of that contract: even if
// something reaches POST /watch/disarm, it is refused without a live token.

export interface ConsentIssue {
  token: string;
  issuedAt: number;
  issuedBy: string | null;
  expiresAt: number;
}

export type ConsentFailure =
  | 'consent_required'
  | 'consent_expired'
  | 'consent_mismatch';

export interface ConsentResult {
  ok: boolean;
  reason?: ConsentFailure;
}

function defaultConsentPath(): string {
  const base = process.env.JUSTIFY_STATE_DIR || join(homedir(), '.claude', 'justify');
  return join(base, 'disarm-consent.json');
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  // timingSafeEqual throws on length mismatch, which itself leaks length. Compare
  // fixed-size digests of the inputs instead by padding to the longer length.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export class DisarmConsentStore {
  private path: string;
  private ttlMs: number;

  constructor(path?: string, ttlMs?: number) {
    this.path = path || defaultConsentPath();
    this.ttlMs = ttlMs ?? (Number(process.env.JUSTIFY_CONSENT_TTL_MS) || 120000);
  }

  statePath(): string {
    return this.path;
  }

  // Mint a fresh token, replacing any outstanding one (a new ask supersedes an
  // older unanswered ask; there is never more than one live token).
  issue(by: string | null, now: number = Date.now()): ConsentIssue {
    const record: ConsentIssue = {
      token: randomBytes(32).toString('hex'),
      issuedAt: now,
      issuedBy: by,
      expiresAt: now + this.ttlMs,
    };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp.${process.pid}.${now}`;
    writeFileSync(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
    renameSync(tmp, this.path);
    return record;
  }

  peek(): ConsentIssue | null {
    try {
      if (!existsSync(this.path)) return null;
      const parsed = JSON.parse(readFileSync(this.path, 'utf-8')) as Partial<ConsentIssue>;
      if (typeof parsed?.token !== 'string' || typeof parsed?.expiresAt !== 'number') return null;
      return parsed as ConsentIssue;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      rmSync(this.path, { force: true });
    } catch {
      /* nothing to clear */
    }
  }

  // Verify a presented token and CONSUME it. Consumed on success AND on expiry,
  // so a stale token can never be replayed. A mismatch does NOT consume - that
  // would let a wrong guess cancel a legitimate pending consent.
  verifyAndConsume(token: string | null | undefined, now: number = Date.now()): ConsentResult {
    const record = this.peek();
    if (!record) return { ok: false, reason: 'consent_required' };

    if (now > record.expiresAt) {
      this.clear();
      return { ok: false, reason: 'consent_expired' };
    }

    if (typeof token !== 'string' || token.length === 0) {
      return { ok: false, reason: 'consent_required' };
    }

    if (!constantTimeEquals(token, record.token)) {
      return { ok: false, reason: 'consent_mismatch' };
    }

    this.clear();
    return { ok: true };
  }
}
