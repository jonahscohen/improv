#!/usr/bin/env node
'use strict';

/**
 * sidecoach-taste-promote - the FULLY-GATED promote path for mined taste rules.
 *
 * WHAT THIS IS. Phase 1 (E) of the self-updating taste loop and its safety core. The miner
 * drops candidate rules into an INERT quarantine (data/proposed-rules/<ruleId>.json). Nothing
 * there is imported by the enforcer, so a proposal is inert BY CONSTRUCTION. This tool is the
 * ONLY sanctioned way a quarantined candidate crosses into the GUIDANCE tier
 * (data/guidance/<store>/), and it refuses to do so without an explicit human sign-off an
 * agent cannot forge.
 *
 * HOW A HUMAN APPROVES (the frontier-confirm model). The consent token is NOT minted by this
 * CLI - a CLI mint is reachable by an agent through a pseudo-TTY (`script`), which defeats a
 * `[ -t 0 ]` gate (Codex, 2026-08-23). Instead the token is minted by the UserPromptSubmit
 * hook `sidecoach-taste-promote-arm.sh` when the USER types, in their own REPL, the whole prompt:
 *       promote-confirm <candidateId> <store> <digest>
 * (the <digest>, from `approve`/`show`, binds the approval to the reviewed content).
 * An agent cannot submit a user prompt, so it cannot trigger the arm - byte-identical to the
 * frontier-confirm token. bash-guard + content-guard additionally fence the token PATH from
 * every agent Write/Edit/MultiEdit/Bash. This CLI only CONSUMES a token the human armed.
 *
 * THREE FAIL-CLOSED LAYERS (the whole point - see the design beat
 * session_2026-08-23_self-updating-taste-pipeline-design.md):
 *   1. STRUCTURAL - guidance stores and product-rule-registry import NOTHING from the
 *      quarantine or the guidance data dir; an un-promoted proposal is physically unreachable.
 *   2. HARNESS - promotion consumes a single-use consent token minted ONLY by the user's typed
 *      REPL confirm (the arm hook); the token path is guard-fenced from agents.
 *   3. BUILD - a candidate is validated before it lands; the miner's preflight.ok===false makes
 *      a candidate ineligible; a malformed candidate never moves.
 *
 * TAMPER-EVIDENT LEDGER (mirrors the Figma fidelity ledger, session_2026-07-18). Every
 * promotion appends to data/promotion-ledger.jsonl (HMAC hash-chained) plus a signed head
 * anchor (count|tip) so TAIL truncation is detectable; a consistency guard refuses to append
 * onto a base that does not match its own head (no head-laundering). The signed content is a
 * JSON array of fixed-order fields (unambiguous; no separator-redistribution). `verify-ledger`
 * and `audit` detect tampering; `audit` also flags any promoted rule with no ledger entry.
 *
 * TEST ISOLATION. One env var, SIDECOACH_PROMOTE_TEST_ROOT, relocates the ENTIRE apparatus
 * (token, secret, quarantine, guidance, ledger) under a temp root - ALL of it or NONE. There
 * is deliberately no per-path override: a per-path override would let an agent point the
 * guidance dir at the real store while faking the token/secret (Codex #1).
 *
 * EXIT CODES (fail-loud, distinct per class):
 *   0 ok | 2 usage | 3 no candidate | 4 bad candidate (malformed/bad store/pre-flight fail/
 *   id-mismatch) | 5 promote REFUSED: no valid token | 6 approve helper: not a TTY |
 *   8 ledger tampered | 9 audit discrepancy | 10 IO | 11 replay (already promoted / token reused)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const EXIT = {
  OK: 0, USAGE: 2, NO_CANDIDATE: 3, BAD_CANDIDATE: 4, NO_TOKEN: 5,
  NO_TTY: 6, LEDGER_TAMPERED: 8, AUDIT_DISCREPANCY: 9, IO: 10, REPLAY: 11,
};

const ALLOWED_STORES = ['design-laws', 'craft-corpus', 'design-judgment-rules'];
const GENESIS = 'taste-promotion-ledger:genesis';
const CONFIRM_PHRASE = 'promote-confirm';

// ---------------------------------------------------------------------------
// Paths. SIDECOACH_PROMOTE_TEST_ROOT relocates EVERYTHING or NOTHING (Codex #1).
// ---------------------------------------------------------------------------
function testRoot() { return process.env.SIDECOACH_PROMOTE_TEST_ROOT || ''; }
// The token/secret ALWAYS use the guard-fenced basenames, even under a test root. So even if an
// agent points SIDECOACH_PROMOTE_TEST_ROOT at the real data dir (Codex round 2 Critical), the
// token/secret land at basenames the guards block on ANY directory - the agent still cannot get
// a tool-writable token/secret. Pointing the root at the real store then gives no power beyond
// the accepted direct-arm-hook residual (which exists with the default paths too).
function tokenFile() {
  const r = testRoot();
  return r ? path.join(r, '.taste-rule-promote-consent') : path.join(os.homedir(), '.claude', '.taste-rule-promote-consent');
}
function secretFile() {
  const r = testRoot();
  return r ? path.join(r, '.taste-promotion-ledger-secret') : path.join(os.homedir(), '.claude', '.taste-promotion-ledger-secret');
}
function quarantineDir() {
  const r = testRoot();
  return r ? path.join(r, 'proposed-rules') : path.join(__dirname, '..', 'data', 'proposed-rules');
}
function guidanceDir() {
  const r = testRoot();
  return r ? path.join(r, 'guidance') : path.join(__dirname, '..', 'data', 'guidance');
}
function ledgerFile() {
  const r = testRoot();
  return r ? path.join(r, 'promotion-ledger.jsonl') : path.join(__dirname, '..', 'data', 'promotion-ledger.jsonl');
}
function ledgerHeadFile() { return ledgerFile() + '.head'; }

// ---------------------------------------------------------------------------
// Secret + HMAC. Machine-local, 0600, created O_EXCL. An agent is hook-blocked from reading
// OR writing it (bash-guard + content-guard fence the secret path); without it a ledger/token
// signature cannot be forged.
// ---------------------------------------------------------------------------
function getSecret() {
  const f = secretFile();
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (_e) { /* mint below */ }
  const secret = crypto.randomBytes(32).toString('hex');
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); } catch (_e) { /* exists */ }
  try {
    const fd = fs.openSync(f, 'wx', 0o600);   // O_CREAT|O_EXCL
    fs.writeSync(fd, secret + '\n');
    fs.closeSync(fd);
    return secret;
  } catch (e) {
    if (e && e.code === 'EEXIST') return fs.readFileSync(f, 'utf8').trim();
    throw e;
  }
}
function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

// Deterministic serialization (recursively key-sorted) so a content digest is stable
// regardless of key order. Used to bind the PROMOTED RULE CONTENT into the ledger.
function canonicalize(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
// sha256 of the candidate content EXCLUDING the _promotion block (which is added at promote
// time and carries the macs). Binds what the human approved; a post-promotion content swap
// changes this digest and is caught by `audit` (Codex round 3 Critical).
function contentDigest(obj) {
  const copy = Object.assign({}, obj);
  delete copy._promotion;
  return crypto.createHash('sha256').update(canonicalize(copy), 'utf8').digest('hex');
}
function macEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Id safety + binding. The id becomes a path segment (quarantine read + guidance write) and
// the ledger key, so it must not contain separators or "..". The miner sanitizes ruleId to
// exactly this shape via sanitizeId(); we enforce it independently AND require the candidate's
// own ruleId to sanitize back to the filename stem (Codex #6 - so file "safe.json" cannot
// carry ruleId "different-rule").
// ---------------------------------------------------------------------------
function isSafeId(id) {
  return typeof id === 'string' && id.length > 0 && /^[A-Za-z0-9._-]+$/.test(id) && !id.includes('..');
}
function sanitizeId(id) { return String(id).replace(/[^A-Za-z0-9._-]+/g, '_'); }

function internalIdOf(obj) {
  if (obj && typeof obj.candidateId === 'string' && obj.candidateId) return obj.candidateId;
  if (obj && typeof obj.ruleId === 'string' && obj.ruleId) return obj.ruleId;
  return '';
}
function hasRuleBody(obj) {
  if (obj && obj.rule && typeof obj.rule === 'object') return true;
  if (obj && (typeof obj.ruleId === 'string' || typeof obj.canonicalRuleKey === 'string')) return true;
  return false;
}
function resolveStore(obj, storeOverride) {
  if (storeOverride) return storeOverride;
  if (obj && typeof obj.targetStore === 'string') return obj.targetStore;
  return '';
}

// ---------------------------------------------------------------------------
// Candidate load + validation (the BUILD fail-closed layer for the guidance tier).
// ---------------------------------------------------------------------------
function candidatePath(id) { return path.join(quarantineDir(), id + '.json'); }

function readCandidate(id) {
  if (!isSafeId(id)) return { found: false, unsafeId: true };
  let raw;
  try { raw = fs.readFileSync(candidatePath(id), 'utf8'); } catch (_e) { return { found: false }; }
  try { return { found: true, obj: JSON.parse(raw) }; }
  catch (e) { return { found: true, parseError: e.message }; }
}

function validateCandidate(obj, id, storeOverride) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['candidate is not a JSON object'], store: '' };
  }
  // Bind EVERY id-bearing field to the filename stem (Codex round 2): top-level candidateId,
  // top-level ruleId, AND the nested rule.ruleId. Otherwise a file "safe.json" could carry a
  // mismatched or unsafe rule.ruleId that a guidance consumer might key off.
  const idFields = [
    obj.candidateId,
    obj.ruleId,
    obj.rule && typeof obj.rule === 'object' ? obj.rule.ruleId : undefined,
  ].filter((x) => typeof x === 'string' && x);
  if (idFields.length === 0) {
    errors.push('missing candidate id (ruleId or candidateId, required)');
  }
  for (const f of idFields) {
    if (sanitizeId(f) !== id) {
      errors.push(`id field "${f}" (sanitized "${sanitizeId(f)}") does not match filename id "${id}"`);
    }
  }
  const store = resolveStore(obj, storeOverride);
  if (!store) {
    errors.push(`no target store: pass --store <${ALLOWED_STORES.join('|')}> (candidate carries no targetStore hint)`);
  } else if (!ALLOWED_STORES.includes(store)) {
    errors.push(`target store must be one of ${ALLOWED_STORES.join(' | ')} (got ${JSON.stringify(store)})`);
  }
  if (!hasRuleBody(obj)) {
    errors.push('missing rule body (a `rule` object, or top-level ProductRuleDefinition fields)');
  }
  if (!obj.provenance || typeof obj.provenance !== 'object') {
    errors.push('missing provenance block (object, required)');
  } else if (typeof obj.provenance.source !== 'string' || !obj.provenance.source) {
    errors.push('provenance.source (string, required) missing');
  }
  if (obj.preflight && typeof obj.preflight === 'object' && obj.preflight.ok === false) {
    const pf = Array.isArray(obj.preflight.errors) ? obj.preflight.errors.join('; ') : 'see candidate';
    errors.push(`candidate FAILED miner pre-flight (validateRegistry) and is ineligible: ${pf}`);
  }
  return { ok: errors.length === 0, errors, store };
}

// ---------------------------------------------------------------------------
// Consent token. Format (one line): id|store|digest|nonce|minted|ttl|sig  where
// sig = HMAC(secret, "id|store|digest|nonce|minted|ttl"). All fields are separator-free by
// construction (id is isSafe, store is from the allowlist, digest is 64-hex, nonce is hex,
// minted/ttl numeric, sig hex), so split('|') is unambiguous. `digest` is the CONTENT digest
// the human copied from the approve/show helper - it binds the approval to the exact candidate
// content, so a swap between review and promote is caught. Minted ONLY by
// sidecoach-taste-promote-arm.sh; this file has NO mint path. token_mac (recorded in the ledger)
// binds a promotion to its authorizing token.
// ---------------------------------------------------------------------------
function parseTokenLine(line, secret) {
  if (!line) return { ok: false, reason: 'consent token is empty' };
  const parts = line.split('|');
  if (parts.length !== 7) return { ok: false, reason: 'consent token is malformed' };
  const [id, store, digest, nonce, mintedStr, ttlStr, sig] = parts;
  const body = `${id}|${store}|${digest}|${nonce}|${mintedStr}|${ttlStr}`;
  if (!macEqual(sig, hmac(secret, body))) return { ok: false, reason: 'consent token signature is invalid' };
  const minted = Number(mintedStr), ttl = Number(ttlStr);
  if (!Number.isFinite(minted) || !Number.isFinite(ttl)) return { ok: false, reason: 'consent token has a non-numeric timestamp/ttl' };
  if (Math.floor(Date.now() / 1000) > minted + ttl) return { ok: false, reason: `consent token expired (minted ${minted}, ttl ${ttl}s)` };
  return { ok: true, id, store, digest, token_mac: hmac(secret, body) };
}

/** Read + validate the token WITHOUT consuming it (the read-only `check`). */
function checkToken(id, store) {
  let line;
  try { line = fs.readFileSync(tokenFile(), 'utf8').trim(); } catch (_e) { return { ok: false, reason: 'no consent token present' }; }
  const secret = getSecret();
  const t = parseTokenLine(line, secret);
  if (!t.ok) return t;
  if (t.id !== id) return { ok: false, reason: `consent token names candidate "${t.id}", not "${id}"` };
  if (store && t.store !== store) return { ok: false, reason: `consent token authorizes store "${t.store}", not "${store}"` };
  return { ok: true, id: t.id, store: t.store, digest: t.digest, token_mac: t.token_mac };
}

/**
 * Atomically CLAIM the token for single-use (Codex #7): rename it aside so two concurrent
 * promotes cannot both consume one token - only the winner of the atomic rename proceeds.
 * Returns { ok, claimPath } or { ok:false }.
 */
function claimToken() {
  const claimPath = tokenFile() + '.claim.' + process.pid + '.' + crypto.randomBytes(4).toString('hex');
  try { fs.renameSync(tokenFile(), claimPath); return { ok: true, claimPath }; }
  catch (_e) { return { ok: false }; }
}
function removeClaim(claimPath) { try { fs.unlinkSync(claimPath); } catch (_e) { /* best-effort */ } }

// ---------------------------------------------------------------------------
// Ledger: append-only, HMAC hash-chained, signed head anchor. Signed content = a JSON array
// of fixed-order fields (unambiguous; no separator-redistribution attack - Codex #4).
// ---------------------------------------------------------------------------
function ledgerSignBody(e) {
  // store + content_digest are signed so the ledger binds WHICH store and WHAT rule content
  // the human approved - a post-promotion content swap or a store move is then detectable.
  return JSON.stringify([
    e.candidateId, e.store, e.content_digest, e.source, e.commit, e.retrieved_utc,
    e.approvedBy, e.approved_utc, e.token_mac, e.prev_mac,
  ]);
}
function readLedgerLines() {
  let raw;
  try { raw = fs.readFileSync(ledgerFile(), 'utf8'); } catch (_e) { return []; }
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
}
function parseLedger() {
  const out = [];
  const lines = readLedgerLines();
  for (let i = 0; i < lines.length; i++) {
    let obj;
    try { obj = JSON.parse(lines[i]); } catch (e) { out.push({ __parseError: e.message, __index: i }); continue; }
    obj.__index = i; out.push(obj);
  }
  return out;
}
function readHead() {
  let raw;
  try { raw = fs.readFileSync(ledgerHeadFile(), 'utf8').trim(); } catch (_e) { return null; }
  const parts = raw.split('|');
  if (parts.length !== 3) return { malformed: true };
  return { count: Number(parts[0]), tip: parts[1], sig: parts[2] };
}
function writeHead(secret, count, tip) {
  fs.writeFileSync(ledgerHeadFile(), `${count}|${tip}|${hmac(secret, `${count}|${tip}`)}\n`, { mode: 0o600 });
}

/**
 * Verify the whole ledger: every line's mac recomputes, every prev_mac chains, and the signed
 * head anchor matches count + tip. Detects middle edit/reorder/delete (chain break/bad mac),
 * tail truncation (head count/tip mismatch), and a forged/missing head. A FULL wipe of both
 * ledger and head verifies as an empty ledger - that case is caught by `audit` instead (any
 * remaining guidance file then has no ledger entry). See the design beat's external-anchor note.
 */
function verifyLedger() {
  const secret = getSecret();
  const entries = parseLedger();
  const errors = [];
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.__parseError) {
      errors.push(`line ${i}: not valid JSON (${e.__parseError})`);
      return { ok: false, count: entries.length, tip: null, errors };
    }
    if (e.prev_mac !== prev) {
      errors.push(`line ${i} (candidate ${e.candidateId}): prev_mac does not chain`);
    }
    if (!macEqual(e.mac, hmac(secret, ledgerSignBody(e)))) {
      errors.push(`line ${i} (candidate ${e.candidateId}): mac mismatch - entry altered or forged`);
    }
    prev = e.mac;
  }
  const tip = entries.length ? entries[entries.length - 1].mac : GENESIS;
  const head = readHead();
  if (head && head.malformed) {
    errors.push('head anchor is malformed');
  } else if (head) {
    // A head, whether the ledger is empty or not, must carry a valid signature over its own
    // count|tip (Codex #5 - do not ignore a malformed/forged head on an empty ledger).
    if (!macEqual(head.sig, hmac(secret, `${head.count}|${head.tip}`))) {
      errors.push('head anchor signature is invalid - head has been forged');
    } else if (head.count !== entries.length) {
      errors.push(`head count ${head.count} != ledger length ${entries.length} - entries added or truncated`);
    } else if (head.tip !== tip) {
      errors.push('head tip does not match the last entry mac - tail tampering');
    }
  } else if (entries.length > 0) {
    errors.push('missing head anchor (cannot detect tail truncation without it)');
  }
  return { ok: errors.length === 0, count: entries.length, tip, errors };
}

/**
 * Append one promotion entry. CONSISTENCY GUARD: refuses to append onto a ledger that does not
 * match its own signed head (never launders a tampered base by re-anchoring it).
 */
function appendLedger(fields) {
  const secret = getSecret();
  const pre = verifyLedger();
  if (!pre.ok) {
    const err = new Error('ledger is inconsistent; refusing to append (would launder a tampered base): ' + pre.errors.join('; '));
    err.code = 'ELEDGER';
    throw err;
  }
  const entries = parseLedger();
  const prev_mac = entries.length ? entries[entries.length - 1].mac : GENESIS;
  const entry = {
    candidateId: fields.candidateId, store: fields.store, content_digest: fields.content_digest,
    source: fields.source, commit: fields.commit,
    retrieved_utc: fields.retrieved_utc, approvedBy: fields.approvedBy || 'human',
    approved_utc: fields.approved_utc, token_mac: fields.token_mac, prev_mac,
  };
  entry.mac = hmac(secret, ledgerSignBody(entry));
  try { fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true }); } catch (_e) { /* exists */ }
  fs.appendFileSync(ledgerFile(), JSON.stringify(entry) + '\n');
  writeHead(secret, entries.length + 1, entry.mac);
  return { ok: true, mac: entry.mac };
}
function ledgerHasCandidate(id) { return parseLedger().some((e) => !e.__parseError && e.candidateId === id); }
function ledgerHasTokenMac(m) { return parseLedger().some((e) => !e.__parseError && e.token_mac === m); }

// Serialize the ledger critical section (replay re-check + token claim + append) so two
// concurrent promotes cannot both slip past the "already promoted" check and double-append
// (Codex round 2). mkdir is atomic on POSIX; a crashed holder is stolen after LOCK_STALE_MS.
// The lock is acquired BEFORE the token is claimed, so lock contention never consumes a token.
const LEDGER_LOCK_STALE_MS = 30 * 1000;
function acquireLedgerLock() {
  const lockDir = ledgerFile() + '.lock';
  try { fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true }); } catch (_e) { /* exists */ }
  try { fs.mkdirSync(lockDir); return { ok: true, lockDir }; }
  catch (e) {
    if (e && e.code === 'EEXIST') {
      try {
        if (Date.now() - fs.statSync(lockDir).mtimeMs > LEDGER_LOCK_STALE_MS) {
          fs.rmdirSync(lockDir); fs.mkdirSync(lockDir); return { ok: true, lockDir };
        }
      } catch (_e2) { /* lost the steal race */ }
    }
    return { ok: false };
  }
}
function releaseLedgerLock(h) { if (h && h.ok) { try { fs.rmdirSync(h.lockDir); } catch (_e) { /* best-effort */ } } }

// ---------------------------------------------------------------------------
// The PROMOTE action: consume a token, then move the candidate into the guidance store and
// append the ledger. The ONLY mutator of the guidance store.
// ---------------------------------------------------------------------------
function doPromote(id, storeOverride) {
  if (!isSafeId(id)) {
    process.stderr.write(`taste-promote: invalid candidate id "${id}" (letters, digits, dot, dash, underscore; no path separators)\n`);
    return EXIT.USAGE;
  }
  const cand = readCandidate(id);
  if (!cand.found) { process.stderr.write(`taste-promote: candidate "${id}" not found in quarantine (${quarantineDir()})\n`); return EXIT.NO_CANDIDATE; }
  if (cand.parseError) { process.stderr.write(`taste-promote: candidate "${id}" is not valid JSON: ${cand.parseError}\n`); return EXIT.BAD_CANDIDATE; }
  const v = validateCandidate(cand.obj, id, storeOverride);
  if (!v.ok) {
    process.stderr.write(`taste-promote: candidate "${id}" failed validation:\n`);
    for (const e of v.errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.BAD_CANDIDATE;
  }
  // Consistency guard FIRST - before any ledger-derived decision (Codex round 3 #3), so a
  // forged unsigned row cannot make a legit promote exit as "replay (11)" instead of the
  // truthful "ledger tampered (8)".
  const pre = verifyLedger();
  if (!pre.ok) {
    process.stderr.write('taste-promote: REFUSED - promotion ledger is inconsistent:\n');
    for (const e of pre.errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.LEDGER_TAMPERED;
  }
  if (ledgerHasCandidate(id)) {
    process.stderr.write(`taste-promote: candidate "${id}" already has a promotion-ledger entry - refusing to re-promote (replay)\n`);
    return EXIT.REPLAY;
  }

  // READ-ONLY token check. A benign mismatch (wrong candidate/store, expired, bad sig) must NOT
  // consume the token - otherwise a mistaken `promote` would burn a token still valid for its
  // real (candidate, store). So this touches nothing.
  const chk = checkToken(id, v.store);
  if (!chk.ok) {
    process.stderr.write(`taste-promote: REFUSED - ${chk.reason}. The user mints consent by running "sidecoach-taste-promote approve ${id} --store ${v.store}" and typing the printed "${CONFIRM_PHRASE} ${id} ${v.store} <digest>" line in their own REPL (an agent cannot).\n`);
    return EXIT.NO_TOKEN;
  }
  if (ledgerHasTokenMac(chk.token_mac)) {
    process.stderr.write('taste-promote: REFUSED - this consent token was already consumed (replay)\n');
    return EXIT.REPLAY;
  }

  const obj = cand.obj;
  const store = v.store;
  const destDir = path.join(guidanceDir(), store);
  const destPath = path.join(destDir, id + '.json');
  const approved_utc = new Date().toISOString();
  const secret = getSecret();

  // COMMIT SECTION under the ledger lock: the replay re-check + token claim + append are atomic
  // across concurrent promotes, closing the re-armed same-id race (Codex round 2). The lock is
  // acquired BEFORE the token is claimed, so lock contention never consumes a token.
  let tok, claim, mac;
  const lock = acquireLedgerLock();
  if (!lock.ok) {
    process.stderr.write('taste-promote: REFUSED - another promotion holds the ledger lock; retry in a moment.\n');
    return EXIT.IO;
  }
  try {
    // Re-check candidate replay UNDER the lock: a concurrent promote may have added this
    // candidate since the pre-lock check.
    if (ledgerHasCandidate(id)) {
      process.stderr.write(`taste-promote: candidate "${id}" already has a promotion-ledger entry - refusing to re-promote (replay)\n`);
      return EXIT.REPLAY;
    }
    // Atomically CLAIM (consume) the token. ENOENT -> consumed concurrently or withdrawn.
    claim = claimToken();
    if (!claim.ok) {
      process.stderr.write('taste-promote: REFUSED - the consent token was consumed concurrently or withdrawn.\n');
      return EXIT.NO_TOKEN;
    }
    // Re-validate the CLAIMED bytes: the token may have been re-armed between check and claim.
    let claimLine;
    try { claimLine = fs.readFileSync(claim.claimPath, 'utf8').trim(); } catch (_e) { claimLine = ''; }
    tok = parseTokenLine(claimLine, secret);
    // The token binds the CONTENT digest the human approved. If the candidate content changed
    // since the confirm (an agent swapped it in the review->promote window), the current digest
    // will not match and we REFUSE - the human approved different bytes (Codex round 4 High).
    const nowDigest = contentDigest(obj);
    const bad = !tok.ok ? tok.reason
      : tok.id !== id ? `token names candidate "${tok.id}", not "${id}"`
      : tok.store !== store ? `token authorizes store "${tok.store}", not "${store}"`
      : (tok.digest && tok.digest !== nowDigest) ? 'the candidate content changed since it was approved (approved digest does not match current content) - re-review and re-confirm'
      : ledgerHasTokenMac(tok.token_mac) ? 'this consent token was already consumed (replay)'
      : null;
    if (bad) {
      removeClaim(claim.claimPath);
      process.stderr.write(`taste-promote: REFUSED - ${bad}\n`);
      return bad.includes('replay') ? EXIT.REPLAY : EXIT.NO_TOKEN;
    }
    // Re-verify consistency under the lock, then append (the authorization commit). If append
    // fails, nothing is moved (no un-blessed live rule); the token is consumed, human re-confirms.
    const pre2 = verifyLedger();
    if (!pre2.ok) {
      removeClaim(claim.claimPath);
      process.stderr.write('taste-promote: REFUSED - promotion ledger is inconsistent:\n');
      for (const e of pre2.errors) process.stderr.write(`  - ${e}\n`);
      return EXIT.LEDGER_TAMPERED;
    }
    try {
      const p = obj.provenance || {};
      mac = appendLedger({
        candidateId: id,
        store,
        content_digest: contentDigest(obj),
        source: p.source || 'unknown',
        commit: p.commit || p.ref || 'unknown',
        retrieved_utc: p.retrieved_utc || 'unknown',
        approvedBy: 'human', approved_utc, token_mac: tok.token_mac,
      }).mac;
    } catch (e) {
      removeClaim(claim.claimPath);
      process.stderr.write(`taste-promote: ledger append failed (${e.code || 'ERR'}): ${e.message}\n`);
      return e.code === 'ELEDGER' ? EXIT.LEDGER_TAMPERED : EXIT.IO;
    }
  } finally {
    releaseLedgerLock(lock);
  }

  // Write the promoted candidate into the guidance store, atomically (temp + rename), so a
  //    reader never sees a half-written file. If this fails after the ledger append, the result
  //    is a SAFE orphan (a ledger entry with no guidance file - NOT an un-blessed live rule);
  //    `audit` reports it. Documented failure, mirroring the fidelity ledger's stance.
  try { fs.mkdirSync(destDir, { recursive: true }); } catch (e) {
    removeClaim(claim.claimPath);
    process.stderr.write(`taste-promote: ledger recorded the promotion but the guidance dir ${destDir} could not be created: ${e.message}. Safe ORPHAN (no live rule); "audit" will show it.\n`);
    return EXIT.IO;
  }
  const promoted = Object.assign({}, obj, {
    _promotion: { candidateId: id, promotedTo: store, approvedBy: 'human', approved_utc, token_mac: tok.token_mac, ledger_mac: mac },
  });
  const tmpPath = destPath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(promoted, null, 2) + '\n');
    fs.renameSync(tmpPath, destPath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (_e2) { /* best-effort */ }
    removeClaim(claim.claimPath);
    process.stderr.write(`taste-promote: ledger recorded the promotion but writing the guidance file ${destPath} FAILED: ${e.message}. This is a safe ORPHAN (no live rule); run "sidecoach-taste-promote audit" to see it. Reconcile by hand or re-mine.\n`);
    return EXIT.IO;
  }

  // 3) Remove the candidate from quarantine (this is a MOVE), then drop the consumed token claim.
  try { fs.unlinkSync(candidatePath(id)); } catch (e) {
    process.stderr.write(`taste-promote: warning - could not remove quarantine file: ${e.message}\n`);
  }
  removeClaim(claim.claimPath);

  process.stdout.write(`taste-promote: PROMOTED "${id}" into guidance store "${store}"\n`);
  process.stdout.write(`  guidance file: ${destPath}\n`);
  process.stdout.write(`  ledger mac:    ${mac}\n`);
  process.stdout.write('  token consumed (single-use).\n');
  return EXIT.OK;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------
function cmdPromote(id, store) { if (!id) { usage(); return EXIT.USAGE; } return doPromote(id, store); }

function cmdApprove(id, store) {
  // NOT a mint path. A TTY helper that reviews the candidate and prints the exact phrase the
  // user must type in their REPL so the arm hook mints the token. Refuses off a TTY only to
  // avoid a misleading affordance in a non-interactive context.
  if (!id) { usage(); return EXIT.USAGE; }
  if (!process.stdout.isTTY) {
    process.stderr.write(`taste-promote: "approve" is an interactive helper. To approve non-interactively is impossible by design.\n`);
    process.stderr.write(`Only the user, in their own REPL, mints consent by typing:  ${CONFIRM_PHRASE} ${id} <store> <digest>\n`);
    return EXIT.NO_TTY;
  }
  const cand = readCandidate(id);
  if (!cand.found) { process.stderr.write(`taste-promote: candidate "${id}" not found in quarantine\n`); return EXIT.NO_CANDIDATE; }
  if (cand.parseError) { process.stderr.write(`taste-promote: candidate "${id}" is not valid JSON: ${cand.parseError}\n`); return EXIT.BAD_CANDIDATE; }
  const v = validateCandidate(cand.obj, id, store);
  printCandidate(cand.obj);
  if (!v.ok) {
    process.stdout.write('\nvalidation  : FAIL (not eligible)\n');
    for (const e of v.errors) process.stdout.write(`  - ${e}\n`);
    return EXIT.BAD_CANDIDATE;
  }
  const digest = contentDigest(cand.obj);
  process.stdout.write('\nTo APPROVE this EXACT content, type the following line in YOUR OWN prompt (not via a tool):\n');
  process.stdout.write(`    ${CONFIRM_PHRASE} ${id} ${v.store} ${digest}\n`);
  process.stdout.write('The digest binds your approval to this content: if the candidate changes before you promote,\n');
  process.stdout.write('the promote is refused. That mints a single-use, ~120s consent token (an agent cannot). Then run:\n');
  process.stdout.write(`    sidecoach-taste-promote promote ${id} --store ${v.store}\n`);
  return EXIT.OK;
}

function cmdCheck(id, store) {
  if (!id) { usage(); return EXIT.USAGE; }
  if (!isSafeId(id)) { process.stderr.write(`taste-promote: invalid candidate id "${id}"\n`); return EXIT.USAGE; }
  const tok = checkToken(id, store);
  if (tok.ok) { process.stdout.write(`taste-promote: a valid consent token authorizes "${id}" -> "${tok.store}"\n`); return EXIT.OK; }
  process.stdout.write(`taste-promote: no valid consent token for "${id}": ${tok.reason}\n`);
  return EXIT.NO_TOKEN;
}

function cmdVerifyLedger() {
  const res = verifyLedger();
  if (res.ok) { process.stdout.write(`taste-promote: ledger OK - ${res.count} entr${res.count === 1 ? 'y' : 'ies'}, chain + head anchor verified.\n`); return EXIT.OK; }
  process.stderr.write('taste-promote: ledger verification FAILED:\n');
  for (const e of res.errors) process.stderr.write(`  - ${e}\n`);
  return EXIT.LEDGER_TAMPERED;
}

function listPromotedFiles() {
  const base = guidanceDir();
  const out = [];
  for (const store of ALLOWED_STORES) {
    let names;
    try { names = fs.readdirSync(path.join(base, store)); } catch (_e) { continue; }
    for (const n of names) if (n.endsWith('.json')) out.push({ store, name: n, full: path.join(base, store, n) });
  }
  return out;
}

function cmdAudit() {
  const led = verifyLedger();
  if (!led.ok) {
    process.stderr.write('taste-promote: AUDIT - promotion ledger is TAMPERED:\n');
    for (const e of led.errors) process.stderr.write(`  - ${e}\n`);
    return EXIT.LEDGER_TAMPERED;
  }
  // Index the ledger by candidateId (the authoritative approved id). Each entry carries the
  // signed store + content_digest, verified above, so we can bind live files to them.
  const byId = new Map();
  for (const e of parseLedger()) if (!e.__parseError) byId.set(e.candidateId, e);
  const promoted = listPromotedFiles();
  const promotedIds = new Set();
  const problems = [];
  for (const f of promoted) {
    // The FILENAME stem is the authoritative id - never an id read from inside the file.
    const id = f.name.replace(/\.json$/, '');
    promotedIds.add(id);
    let obj;
    try { obj = JSON.parse(fs.readFileSync(f.full, 'utf8')); } catch (e) { problems.push(`guidance file ${f.store}/${f.name} is not valid JSON (${e.message})`); continue; }
    const entry = byId.get(id);
    if (!entry) {
      problems.push(`UN-BLESSED: guidance rule "${id}" (${f.store}) has NO promotion-ledger entry - not promoted through the gate`);
      continue;
    }
    // Store must match the signed store (a rule cannot be moved between guidance stores).
    if (entry.store !== f.store) {
      problems.push(`STORE MISMATCH: "${id}" is in "${f.store}" but the ledger approved store "${entry.store}"`);
    }
    // Every id field in the file must sanitize to the filename stem (no masquerade).
    for (const cand of [obj.candidateId, obj.ruleId, obj.rule && typeof obj.rule === 'object' ? obj.rule.ruleId : undefined]) {
      if (typeof cand === 'string' && cand && sanitizeId(cand) !== id) {
        problems.push(`ID MASQUERADE: "${f.store}/${f.name}" carries id field "${cand}" that does not match filename "${id}"`);
      }
    }
    // Content must match the signed digest (a post-promotion content swap is detected).
    if (entry.content_digest && contentDigest(obj) !== entry.content_digest) {
      problems.push(`CONTENT TAMPERED: "${id}" (${f.store}) rule content does not match the ledger's approved digest`);
    }
  }
  const orphans = [...byId.keys()].filter((id) => !promotedIds.has(id));
  if (problems.length) {
    process.stderr.write('taste-promote: AUDIT FAILED:\n');
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    if (orphans.length) process.stderr.write(`  (info) ledger entries with no live guidance file (safe orphans): ${orphans.join(', ')}\n`);
    return EXIT.AUDIT_DISCREPANCY;
  }
  process.stdout.write(`taste-promote: AUDIT clean - ${promoted.length} promoted rule(s), all ledger-backed (store + content bound); chain verified (${led.count} entr${led.count === 1 ? 'y' : 'ies'}).\n`);
  if (orphans.length) process.stdout.write(`  (info) ledger entries with no live guidance file (safe orphans, e.g. a failed guidance write): ${orphans.join(', ')}\n`);
  return EXIT.OK;
}

function cmdList() {
  const dir = quarantineDir();
  let names;
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch (_e) { process.stdout.write(`taste-promote: no quarantine dir (${dir}).\n`); return EXIT.OK; }
  if (!names.length) { process.stdout.write('taste-promote: quarantine is empty (no candidates awaiting review).\n'); return EXIT.OK; }
  process.stdout.write(`taste-promote: ${names.length} candidate(s) in quarantine (${dir}):\n`);
  for (const n of names) {
    const id = n.replace(/\.json$/, '');
    const cand = readCandidate(id);
    let tag;
    if (cand.parseError) tag = ' [INVALID JSON]';
    else if (!cand.found) tag = ' [UNREADABLE]';
    else {
      const hint = (typeof cand.obj.targetStore === 'string' && cand.obj.targetStore) ? cand.obj.targetStore : '(needs --store)';
      const src = (cand.obj.provenance || {}).source || '?';
      const pf = (cand.obj.preflight && cand.obj.preflight.ok === false) ? ' [PRE-FLIGHT FAILED]' : '';
      tag = ` -> ${hint} (source: ${src})${pf}`;
    }
    process.stdout.write(`  ${id}${tag}\n`);
  }
  return EXIT.OK;
}

function indent(s, pad) { return s.split('\n').map((l) => pad + l).join('\n'); }
function printCandidate(obj) {
  process.stdout.write(`id          : ${internalIdOf(obj)}\n`);
  if (obj.title) process.stdout.write(`title       : ${obj.title}\n`);
  const hint = (typeof obj.targetStore === 'string' && obj.targetStore) ? obj.targetStore : '(none - pass --store)';
  process.stdout.write(`targetStore : ${hint}\n`);
  if (obj.preflight && typeof obj.preflight === 'object') process.stdout.write(`preflight   : ${obj.preflight.ok ? 'ok' : 'FAILED'}\n`);
  const p = obj.provenance || {};
  process.stdout.write('provenance  :\n');
  process.stdout.write(`  source     : ${p.source || '?'}\n`);
  process.stdout.write(`  commit/ref : ${p.commit || p.ref || '?'}\n`);
  process.stdout.write(`  retrieved  : ${p.retrieved_utc || '?'}\n`);
  process.stdout.write(`  minedBy    : ${p.minedBy || '?'}\n`);
  if (p.rationale) process.stdout.write(`  rationale  : ${p.rationale}\n`);
  const ruleBody = (obj.rule && typeof obj.rule === 'object') ? obj.rule : obj;
  process.stdout.write('rule        :\n');
  process.stdout.write(indent(JSON.stringify(ruleBody, null, 2), '  ') + '\n');
  process.stdout.write(`content digest: ${contentDigest(obj)}\n`);
}

function cmdShow(id, store) {
  if (!id) { usage(); return EXIT.USAGE; }
  const cand = readCandidate(id);
  if (cand.unsafeId) { process.stderr.write(`taste-promote: invalid candidate id "${id}"\n`); return EXIT.USAGE; }
  if (!cand.found) { process.stderr.write(`taste-promote: candidate "${id}" not found in quarantine\n`); return EXIT.NO_CANDIDATE; }
  if (cand.parseError) { process.stderr.write(`taste-promote: candidate "${id}" is not valid JSON: ${cand.parseError}\n`); return EXIT.BAD_CANDIDATE; }
  printCandidate(cand.obj);
  const v = validateCandidate(cand.obj, id, store);
  if (v.ok) { process.stdout.write(`\nvalidation  : PASS (eligible for promotion into "${v.store}")\n`); return EXIT.OK; }
  process.stdout.write('\nvalidation  : FAIL\n');
  for (const e of v.errors) process.stdout.write(`  - ${e}\n`);
  return EXIT.BAD_CANDIDATE;
}

function usage() {
  process.stderr.write(`sidecoach-taste-promote - fully-gated promotion of mined taste candidates into the GUIDANCE tier.

Usage:
  sidecoach-taste-promote list                      List quarantined candidates awaiting review.
  sidecoach-taste-promote show <id> [--store <s>]   Show a candidate's rule + provenance + validation.
  sidecoach-taste-promote approve <id> [--store <s>]  Review + print the exact REPL phrase to approve (does NOT mint).
  sidecoach-taste-promote promote <id> --store <s>  Promote by consuming a valid consent token.
  sidecoach-taste-promote check <id> [--store <s>]  Report whether a valid token authorizes the candidate (no consume).
  sidecoach-taste-promote verify-ledger             Verify the promotion ledger chain + head anchor.
  sidecoach-taste-promote audit                     Flag any promoted rule with no matching ledger entry.

  <id>       the candidate's ruleId / candidateId (the quarantine filename stem; see "list").
  --store    the GUIDANCE store: ${ALLOWED_STORES.join(' | ')}.

Approval is minted ONLY by the user typing "${CONFIRM_PHRASE} <id> <store> <digest>" in their OWN
prompt (the sidecoach-taste-promote-arm.sh UserPromptSubmit hook); run "approve <id> --store <s>"
to get the exact line to copy. The <digest> binds the approval to the reviewed content. Agents are
hook-fenced from the token path AND from executing the arm hook. Nothing auto-promotes.

Exit: 0 ok, 2 usage, 3 no candidate, 4 bad candidate, 5 no token, 6 no TTY, 8 ledger tampered,
9 audit discrepancy, 10 IO, 11 replay.
`);
}

function parseArgs(argv) {
  const cmd = argv[0];
  let arg; let store = '';
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--store') { store = argv[i + 1] || ''; i++; }
    else if (a.startsWith('--store=')) { store = a.slice('--store='.length); }
    else if (arg === undefined) { arg = a; }
  }
  return { cmd, arg, store };
}

function main() {
  const { cmd, arg, store } = parseArgs(process.argv.slice(2));
  let code;
  try {
    switch (cmd) {
      case 'list': code = cmdList(); break;
      case 'show': code = cmdShow(arg, store); break;
      case 'approve': code = cmdApprove(arg, store); break;
      case 'promote': code = cmdPromote(arg, store); break;
      case 'check': code = cmdCheck(arg, store); break;
      case 'verify-ledger': code = cmdVerifyLedger(); break;
      case 'audit': code = cmdAudit(); break;
      case '-h': case '--help': case 'help': usage(); code = EXIT.OK; break;
      default: usage(); code = EXIT.USAGE; break;
    }
  } catch (e) {
    process.stderr.write(`taste-promote: internal error: ${e && e.stack ? e.stack : e}\n`);
    code = EXIT.IO;
  }
  process.exit(code);
}

// This file exports NOTHING. Every capability that touches the machine-local signing secret or
// the consent token (getSecret, hmac, the path resolvers) is intentionally unreachable via
// require() - a `node -e "require(...)..."` call names neither the token nor the secret path
// and would slip past the bash-guard, which only greps the Bash command text. The only entry
// point is running this file as a program; the only mint path is the arm hook on user input.
if (require.main === module) {
  main();
}
