#!/usr/bin/env node
'use strict';

/**
 * sidecoach-taste-enforce - the SECOND, precision-gated, human-signed gate. It is the ONLY
 * sanctioned way a mined taste rule crosses from advisory GUIDANCE to build-BLOCKING enforcement.
 *
 * WHAT THIS IS. Phase 3b of the self-updating taste loop. sidecoach-taste-promote moved a mined
 * candidate into the GUIDANCE tier (advisory). This tool takes a rule that is ALREADY
 * guidance-promoted and, only after a FRESH held-out precision measurement clears the bar AND a
 * human signs off, writes it into the ENFORCED tier (data/enforced-rules/<ruleId>.json) at a
 * BLOCKING severity. It is byte-parallel to sidecoach-taste-promote.js and shares NONE of its state:
 * a SEPARATE consent token, a SEPARATE arm hook, and a SEPARATE HMAC-chained ledger with its own
 * signing secret. Nothing auto-crosses either gate - the two-key rule.
 *
 * HOW A HUMAN APPROVES (the frontier-confirm model, cloned from promote). The enforce token is NOT
 * minted by this CLI - a CLI mint is reachable by an agent through a pseudo-TTY. Instead the token is
 * minted by the UserPromptSubmit hook sidecoach-taste-enforce-arm.sh when the USER types, in their
 * own REPL, the whole prompt:
 *       enforce-confirm <ruleId> <precision-digest>
 * The <precision-digest> comes from a FRESH precision measurement (eval/taste-enforce-precision.mjs,
 * printed by `approve`). Binding it means the sign-off is tied to the EXACT measured precision: this
 * CLI re-measures precision FRESH at enforce time and refuses unless the fresh digest matches the
 * token's, so an agent that swaps the spec/corpus between review and enforce is caught, and a
 * precision that has drifted below the bar since the human looked cannot slip through. An agent
 * cannot submit a user prompt, so it cannot trigger the arm; bash-guard + content-guard additionally
 * fence the token PATH, the ledger SECRET, and DIRECT EXECUTION of the arm hook from every agent tool.
 *
 * THE PRECISION GATE (the whole point of the second gate). A mined detector may enforce only if its
 * FROZEN patternSpec is precise OUT OF SAMPLE: P_heldout >= threshold AND a minimum-denominator
 * FLOOR (enough held-out positives / enough fires). Under floor is a REFUSAL, never a pass - the
 * synthetic-positives-only P=1.000 lesson. This CLI re-runs that measurement FRESH (never trusts a
 * cache) and REFUSES with a DISTINCT exit code (7) on under-threshold or under-floor.
 *
 * FAIL-CLOSED LAYERS:
 *   1. STRUCTURAL - the enforced tier is INERT DATA, exactly like the guidance tier: no src/ file
 *      imports data/enforced-rules or either ledger, so an enforced record cannot self-activate. The
 *      runtime-invariant test (mined-taste-invariant.test.ts) is the CI backstop: a mined-taste rule
 *      at a blocking severity WITHOUT an enforcement-ledger entry + a passing precision record fails
 *      the build/CI loud.
 *   2. HARNESS - enforcement consumes a single-use consent token minted ONLY by the user's typed REPL
 *      confirm (the arm hook); the token path + ledger secret are guard-fenced from agents.
 *   3. PRECISION - a fresh held-out measurement must clear the bar; under threshold/floor => refuse.
 *   4. BUILD - after the flip, `npm run build` (validateRegistry + --check + tsc) must pass; a failure
 *      ROLLS BACK the enforced file (the ledger entry remains a safe ORPHAN that `audit` reports).
 *
 * TAMPER-EVIDENT LEDGER. Every enforcement appends to data/enforcement-ledger.jsonl (HMAC
 * hash-chained) plus a signed head anchor (count|tip) so TAIL truncation is detectable; a
 * consistency guard refuses to append onto a base that does not match its own head. The signed
 * content is a JSON array of fixed-order fields (unambiguous). Cloned from the promotion ledger with
 * a DISTINCT secret + DISTINCT chain - the enforcement ledger is NEVER the promotion ledger.
 *
 * TEST ISOLATION. One env var, SIDECOACH_ENFORCE_TEST_ROOT, relocates the ENTIRE apparatus (token,
 * secret, guidance source, promotion-ledger source, enforced tier, enforcement ledger) under a temp
 * root - ALL of it or NONE (no per-path override, matching promote). The token/secret ALWAYS use the
 * guard-fenced basenames even under a test root, so an agent that points the root at the real data
 * dir still cannot obtain a tool-writable token/secret. SIDECOACH_ENFORCE_TEST_ROOT also gates the
 * build-cmd override and the precision-floor env overrides (test seams).
 *
 * CAVEAT A (accepted, documented residual - Codex): SIDECOACH_ENFORCE_TEST_ROOT is a
 * PRODUCTION-FORBIDDEN env var. Every test-seam gate assumes it is NOT set in a real run; an agent that
 * sets it ITSELF in production re-opens the seams. That is the SAME accepted same-uid limit (an agent
 * controlling its own env is an agent acting as the user) and is NOT code-closable (an env var is
 * agent-settable, and the tests legitimately set it). Documented and surfaced to the user, not fenced.
 *
 * EXIT CODES (fail-loud, distinct per class):
 *   0 ok | 2 usage | 3 no rule (guidance rule not found) | 4 bad rule (malformed / no patternSpec /
 *   id mismatch) | 5 enforce REFUSED: no valid token | 6 approve helper: not a TTY | 7 enforce
 *   REFUSED: precision under threshold OR denominator under floor | 8 ledger tampered | 9 audit
 *   discrepancy | 10 IO | 11 replay (already enforced / token reused) | 12 NOT guidance-promoted |
 *   13 build failed after flip (rolled back)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const EXIT = {
  OK: 0, USAGE: 2, NO_RULE: 3, BAD_RULE: 4, NO_TOKEN: 5, NO_TTY: 6, PRECISION_REFUSED: 7,
  LEDGER_TAMPERED: 8, AUDIT_DISCREPANCY: 9, IO: 10, REPLAY: 11, NOT_PROMOTED: 12, BUILD_FAILED: 13,
};

const ALLOWED_STORES = ['design-laws', 'craft-corpus', 'design-judgment-rules'];
const GENESIS = 'taste-enforcement-ledger:genesis';
const CONFIRM_PHRASE = 'enforce-confirm';
const BLOCKING_SEVERITY = 'major';   // the severity a mined rule is flipped to on enforce (blocking)

// ---------------------------------------------------------------------------
// Paths. SIDECOACH_ENFORCE_TEST_ROOT relocates EVERYTHING or NOTHING (mirrors promote's Codex #1).
// The token/secret ALWAYS use the guard-fenced basenames, even under a test root, so pointing the
// root at the real data dir still yields no tool-writable token/secret (the guards block those
// basenames on ANY directory).
// ---------------------------------------------------------------------------
function testRoot() { return process.env.SIDECOACH_ENFORCE_TEST_ROOT || ''; }
function tokenFile() {
  const r = testRoot();
  return r ? path.join(r, '.taste-rule-enforce-consent') : path.join(os.homedir(), '.claude', '.taste-rule-enforce-consent');
}
function secretFile() {
  const r = testRoot();
  return r ? path.join(r, '.taste-enforce-ledger-secret') : path.join(os.homedir(), '.claude', '.taste-enforce-ledger-secret');
}
function guidanceDir() {
  const r = testRoot();
  return r ? path.join(r, 'guidance') : path.join(__dirname, '..', 'data', 'guidance');
}
function enforcedDir() {
  const r = testRoot();
  return r ? path.join(r, 'enforced-rules') : path.join(__dirname, '..', 'data', 'enforced-rules');
}
function promotionLedgerFile() {
  const r = testRoot();
  return r ? path.join(r, 'promotion-ledger.jsonl') : path.join(__dirname, '..', 'data', 'promotion-ledger.jsonl');
}
function ledgerFile() {
  const r = testRoot();
  return r ? path.join(r, 'enforcement-ledger.jsonl') : path.join(__dirname, '..', 'data', 'enforcement-ledger.jsonl');
}
function ledgerHeadFile() { return ledgerFile() + '.head'; }
function repoRoot() { return path.join(__dirname, '..'); }
function precisionHarness() { return path.join(repoRoot(), 'eval', 'taste-enforce-precision.mjs'); }

// ---------------------------------------------------------------------------
// Secret + HMAC (machine-local, 0600, O_EXCL). Distinct from the promotion secret. Cloned crypto.
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
function hmac(secret, data) { return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex'); }

// Deterministic serialization (recursively key-sorted). MUST match the precision harness's canonical()
// so a content digest is stable regardless of key order.
function canonicalize(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
// sha256 of the SUBSTANTIVE rule content the human enforced - stable across the flip itself. The
// enforce gate MUTATES exactly two fields (severity minor -> blocking, and severityOverrideReason)
// plus the _promotion/_enforcement metadata blocks; excluding those, the digest is identical BEFORE
// (guidance) and AFTER (enforced tier), so `audit` recomputes it over the enforced file and matches
// the ledger's digest taken at enforce time from the guidance content. A post-enforce swap of the
// SUBSTANTIVE content (patternSpec, exampleCorpus, message, an injected field) still changes it and
// is caught. Normalizes both the top-level (bare body) and the nested `.rule` object.
function stripEnforceVolatile(obj) {
  const c = Object.assign({}, obj);
  delete c._promotion;
  delete c._enforcement;
  delete c.severity;
  delete c.severityOverrideReason;
  if (c.rule && typeof c.rule === 'object') {
    c.rule = Object.assign({}, c.rule);
    delete c.rule.severity;
    delete c.rule.severityOverrideReason;
  }
  return c;
}
function contentDigest(obj) {
  return crypto.createHash('sha256').update(canonicalize(stripEnforceVolatile(obj)), 'utf8').digest('hex');
}
function macEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Id safety
// ---------------------------------------------------------------------------
function isSafeId(id) {
  return typeof id === 'string' && id.length > 0 && /^[A-Za-z0-9._-]+$/.test(id) && !id.includes('..');
}
function sanitizeId(id) { return String(id).replace(/[^A-Za-z0-9._-]+/g, '_'); }

// ---------------------------------------------------------------------------
// Guidance-promotion check (READ-ONLY) + guidance rule load.
// The rule must ALREADY be guidance-promoted: the promotion ledger has an entry keyed by candidateId
// === ruleId, naming the store the guidance file lives in. We READ the promotion ledger (we do NOT
// verify its HMAC - that is the promote CLI's audit job; the enforce gate only needs the entry's
// existence + the guidance file, then re-derives its own trust from the FRESH precision + the enforce
// token). We never write the promotion ledger.
// ---------------------------------------------------------------------------
function promotionEntryFor(ruleId) {
  let raw;
  try { raw = fs.readFileSync(promotionLedgerFile(), 'utf8'); } catch (_e) { return null; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let e;
    try { e = JSON.parse(t); } catch (_e2) { continue; }
    if (e && e.candidateId === ruleId) return e;   // last one wins is fine; a ruleId promotes once
  }
  return null;
}
function guidancePath(store, id) { return path.join(guidanceDir(), store, id + '.json'); }
function readGuidanceRule(id, store) {
  let raw;
  try { raw = fs.readFileSync(guidancePath(store, id), 'utf8'); } catch (_e) { return { found: false }; }
  try { return { found: true, obj: JSON.parse(raw) }; } catch (e) { return { found: true, parseError: e.message }; }
}

function ruleBodyOf(obj) {
  return obj && obj.rule && typeof obj.rule === 'object' ? obj.rule : obj;
}
function validateEnforceable(obj, id) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['guidance record is not a JSON object'] };
  const body = ruleBodyOf(obj);
  const idFields = [obj.ruleId, body && body.ruleId].filter((x) => typeof x === 'string' && x);
  if (idFields.length === 0) errors.push('missing ruleId in guidance record');
  for (const f of idFields) if (sanitizeId(f) !== id) errors.push(`id field "${f}" (sanitized "${sanitizeId(f)}") does not match "${id}"`);
  if (!body || !body.patternSpec || typeof body.patternSpec !== 'object') errors.push('rule carries no patternSpec (not a runnable mined detector - cannot enforce)');
  if (!body || !body.exampleCorpus || typeof body.exampleCorpus !== 'object') errors.push('rule carries no exampleCorpus (no held-out precision can be measured)');
  if (body && body.sourceVocabulary && body.sourceVocabulary !== 'mined-taste') errors.push(`rule sourceVocabulary is "${body.sourceVocabulary}", not "mined-taste" (only mined rules cross this gate)`);
  return { ok: errors.length === 0, errors, body };
}

// ---------------------------------------------------------------------------
// Fresh precision measurement (the PRECISION gate). Runs the harness as a CHILD over the guidance
// rule file. Never trusts a cache. Returns { pass, refused, report, digest, code }.
// ---------------------------------------------------------------------------
function measurePrecision(ruleId, ruleFilePath) {
  const args = ['measure', ruleId, '--rule-file', ruleFilePath, '--json'];
  const baseDir = process.env.SIDECOACH_ENFORCE_CORPUS_BASE || repoRoot();
  args.push('--base-dir', baseDir);
  if (process.env.SIDECOACH_ENFORCE_NEGATIVES_DIR) args.push('--negatives-dir', process.env.SIDECOACH_ENFORCE_NEGATIVES_DIR);
  const res = spawnSync(process.execPath, [precisionHarness(), ...args], { encoding: 'utf8' });
  if (res.error) return { error: `precision harness failed to launch: ${res.error.message}`, code: EXIT.IO };
  let report = null;
  try { report = JSON.parse(res.stdout); } catch (_e) { /* non-JSON on some error paths */ }
  const code = res.status;
  // harness exit contract: 0 pass; 4 under threshold; 7 under floor; 3 rule/corpus error; 2 usage.
  if (code === 0 && report) return { pass: true, refused: false, report, digest: report.precisionDigest, code };
  if (code === 4 || code === 7) return { pass: false, refused: true, report, code, stderr: res.stderr };
  return { error: (res.stderr || 'precision harness error').trim(), code };
}

// ---------------------------------------------------------------------------
// Consent token. Format (one line): id|precisionDigest|nonce|minted|ttl|sig  where
// sig = HMAC(secret, "id|precisionDigest|nonce|minted|ttl"). All fields are separator-free by
// construction. `precisionDigest` binds the sign-off to the measured precision report. Minted ONLY by
// sidecoach-taste-enforce-arm.sh; this file has NO mint path.
// ---------------------------------------------------------------------------
function parseTokenLine(line, secret) {
  if (!line) return { ok: false, reason: 'consent token is empty' };
  const parts = line.split('|');
  if (parts.length !== 6) return { ok: false, reason: 'consent token is malformed' };
  const [id, digest, nonce, mintedStr, ttlStr, sig] = parts;
  const body = `${id}|${digest}|${nonce}|${mintedStr}|${ttlStr}`;
  if (!macEqual(sig, hmac(secret, body))) return { ok: false, reason: 'consent token signature is invalid' };
  const minted = Number(mintedStr), ttl = Number(ttlStr);
  if (!Number.isFinite(minted) || !Number.isFinite(ttl)) return { ok: false, reason: 'consent token has a non-numeric timestamp/ttl' };
  if (Math.floor(Date.now() / 1000) > minted + ttl) return { ok: false, reason: `consent token expired (minted ${minted}, ttl ${ttl}s)` };
  return { ok: true, id, digest, token_mac: hmac(secret, body) };
}
function checkToken(id, precisionDigest) {
  let line;
  try { line = fs.readFileSync(tokenFile(), 'utf8').trim(); } catch (_e) { return { ok: false, reason: 'no consent token present' }; }
  const secret = getSecret();
  const t = parseTokenLine(line, secret);
  if (!t.ok) return t;
  if (t.id !== id) return { ok: false, reason: `consent token names rule "${t.id}", not "${id}"` };
  if (precisionDigest && t.digest !== precisionDigest) return { ok: false, reason: 'consent token precision-digest does not match the FRESH measurement (spec/corpus/build changed, or precision drifted, since sign-off) - re-measure and re-confirm' };
  return { ok: true, id: t.id, digest: t.digest, token_mac: t.token_mac };
}
function claimToken() {
  const claimPath = tokenFile() + '.claim.' + process.pid + '.' + crypto.randomBytes(4).toString('hex');
  try { fs.renameSync(tokenFile(), claimPath); return { ok: true, claimPath }; }
  catch (_e) { return { ok: false }; }
}
function removeClaim(claimPath) { try { fs.unlinkSync(claimPath); } catch (_e) { /* best-effort */ } }

// ---------------------------------------------------------------------------
// Enforcement ledger: append-only, HMAC hash-chained, signed head anchor. Cloned from the promotion
// ledger with a DISTINCT secret + DISTINCT chain. Signed content = a JSON array of fixed-order fields.
// ---------------------------------------------------------------------------
function ledgerSignBody(e) {
  return JSON.stringify([
    e.ruleId, e.store, e.content_digest, e.precision_digest, e.precision, e.source, e.commit,
    e.retrieved_utc, e.approvedBy, e.approved_utc, e.token_mac, e.prev_mac,
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
function verifyLedger() {
  const secret = getSecret();
  const entries = parseLedger();
  const errors = [];
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.__parseError) { errors.push(`line ${i}: not valid JSON (${e.__parseError})`); return { ok: false, count: entries.length, tip: null, errors }; }
    if (e.prev_mac !== prev) errors.push(`line ${i} (rule ${e.ruleId}): prev_mac does not chain`);
    if (!macEqual(e.mac, hmac(secret, ledgerSignBody(e)))) errors.push(`line ${i} (rule ${e.ruleId}): mac mismatch - entry altered or forged`);
    prev = e.mac;
  }
  const tip = entries.length ? entries[entries.length - 1].mac : GENESIS;
  const head = readHead();
  if (head && head.malformed) {
    errors.push('head anchor is malformed');
  } else if (head) {
    if (!macEqual(head.sig, hmac(secret, `${head.count}|${head.tip}`))) errors.push('head anchor signature is invalid - head has been forged');
    else if (head.count !== entries.length) errors.push(`head count ${head.count} != ledger length ${entries.length} - entries added or truncated`);
    else if (head.tip !== tip) errors.push('head tip does not match the last entry mac - tail tampering');
  } else if (entries.length > 0) {
    errors.push('missing head anchor (cannot detect tail truncation without it)');
  }
  return { ok: errors.length === 0, count: entries.length, tip, errors };
}
function appendLedger(fields) {
  const secret = getSecret();
  const pre = verifyLedger();
  if (!pre.ok) { const err = new Error('ledger is inconsistent; refusing to append (would launder a tampered base): ' + pre.errors.join('; ')); err.code = 'ELEDGER'; throw err; }
  const entries = parseLedger();
  const prev_mac = entries.length ? entries[entries.length - 1].mac : GENESIS;
  const entry = {
    ruleId: fields.ruleId, store: fields.store, content_digest: fields.content_digest,
    precision_digest: fields.precision_digest, precision: fields.precision, source: fields.source,
    commit: fields.commit, retrieved_utc: fields.retrieved_utc, approvedBy: fields.approvedBy || 'human',
    approved_utc: fields.approved_utc, token_mac: fields.token_mac, prev_mac,
  };
  entry.mac = hmac(secret, ledgerSignBody(entry));
  try { fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true }); } catch (_e) { /* exists */ }
  fs.appendFileSync(ledgerFile(), JSON.stringify(entry) + '\n');
  writeHead(secret, entries.length + 1, entry.mac);
  return { ok: true, mac: entry.mac };
}
function ledgerHasRule(id) { return parseLedger().some((e) => !e.__parseError && e.ruleId === id); }
function ledgerHasTokenMac(m) { return parseLedger().some((e) => !e.__parseError && e.token_mac === m); }

const LEDGER_LOCK_STALE_MS = 30 * 1000;
function acquireLedgerLock() {
  const lockDir = ledgerFile() + '.lock';
  try { fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true }); } catch (_e) { /* exists */ }
  try { fs.mkdirSync(lockDir); return { ok: true, lockDir }; }
  catch (e) {
    if (e && e.code === 'EEXIST') {
      try { if (Date.now() - fs.statSync(lockDir).mtimeMs > LEDGER_LOCK_STALE_MS) { fs.rmdirSync(lockDir); fs.mkdirSync(lockDir); return { ok: true, lockDir }; } }
      catch (_e2) { /* lost the steal race */ }
    }
    return { ok: false };
  }
}
function releaseLedgerLock(h) { if (h && h.ok) { try { fs.rmdirSync(h.lockDir); } catch (_e) { /* best-effort */ } } }

// ---------------------------------------------------------------------------
// The ENFORCE action.
// ---------------------------------------------------------------------------
function doEnforce(id) {
  if (!isSafeId(id)) { process.stderr.write(`taste-enforce: invalid rule id "${id}"\n`); return EXIT.USAGE; }

  // 1) must be guidance-promoted.
  const prom = promotionEntryFor(id);
  if (!prom) {
    process.stderr.write(`taste-enforce: REFUSED - "${id}" has NO promotion-ledger entry (it is not guidance-promoted). Promote it through sidecoach-taste-promote first.\n`);
    return EXIT.NOT_PROMOTED;
  }
  const store = prom.store;
  if (!ALLOWED_STORES.includes(store)) { process.stderr.write(`taste-enforce: promotion entry names an unknown store "${store}"\n`); return EXIT.BAD_RULE; }

  const g = readGuidanceRule(id, store);
  if (!g.found) { process.stderr.write(`taste-enforce: guidance rule "${id}" not found in store "${store}" (${guidancePath(store, id)})\n`); return EXIT.NO_RULE; }
  if (g.parseError) { process.stderr.write(`taste-enforce: guidance rule "${id}" is not valid JSON: ${g.parseError}\n`); return EXIT.BAD_RULE; }
  const v = validateEnforceable(g.obj, id);
  if (!v.ok) { process.stderr.write(`taste-enforce: rule "${id}" is not enforceable:\n`); for (const e of v.errors) process.stderr.write(`  - ${e}\n`); return EXIT.BAD_RULE; }

  // 2) FRESH precision measurement (never trust a cache).
  const meas = measurePrecision(id, guidancePath(store, id));
  if (meas.error) { process.stderr.write(`taste-enforce: precision measurement error: ${meas.error}\n`); return meas.code === EXIT.IO ? EXIT.IO : EXIT.BAD_RULE; }
  if (meas.refused) {
    process.stderr.write(`taste-enforce: REFUSED - fresh held-out precision did not clear the bar (${meas.code === 7 ? 'denominator under floor - cannot validate out of sample' : 'precision below threshold'}).\n`);
    if (meas.report) process.stderr.write(`  P=${meas.report.precision === null ? 'n/a' : meas.report.precision} fires=${meas.report.fires} held-out-positives=${meas.report.heldoutPositives}\n`);
    return EXIT.PRECISION_REFUSED;
  }
  const freshDigest = meas.digest;

  // Consistency guard FIRST (before any ledger-derived decision), so a forged unsigned row cannot
  // make a legit enforce exit as replay instead of the truthful tamper.
  const pre = verifyLedger();
  if (!pre.ok) { process.stderr.write('taste-enforce: REFUSED - enforcement ledger is inconsistent:\n'); for (const e of pre.errors) process.stderr.write(`  - ${e}\n`); return EXIT.LEDGER_TAMPERED; }
  if (ledgerHasRule(id)) { process.stderr.write(`taste-enforce: "${id}" already has an enforcement-ledger entry - refusing to re-enforce (replay)\n`); return EXIT.REPLAY; }

  // 3) READ-ONLY token check (benign mismatch must NOT consume the token).
  const chk = checkToken(id, freshDigest);
  if (!chk.ok) {
    process.stderr.write(`taste-enforce: REFUSED - ${chk.reason}. Mint consent by running "sidecoach-taste-enforce approve ${id}" and typing the printed "${CONFIRM_PHRASE} ${id} <precision-digest>" line in your own REPL (an agent cannot).\n`);
    return EXIT.NO_TOKEN;
  }
  if (ledgerHasTokenMac(chk.token_mac)) { process.stderr.write('taste-enforce: REFUSED - this consent token was already consumed (replay)\n'); return EXIT.REPLAY; }

  const obj = g.obj;
  const approved_utc = new Date().toISOString();
  const secret = getSecret();

  // COMMIT SECTION under the ledger lock (atomic across concurrent enforces).
  let tok, claim, mac;
  const lock = acquireLedgerLock();
  if (!lock.ok) { process.stderr.write('taste-enforce: REFUSED - another enforcement holds the ledger lock; retry in a moment.\n'); return EXIT.IO; }
  try {
    if (ledgerHasRule(id)) { process.stderr.write(`taste-enforce: "${id}" already has an enforcement-ledger entry - refusing to re-enforce (replay)\n`); return EXIT.REPLAY; }
    claim = claimToken();
    if (!claim.ok) { process.stderr.write('taste-enforce: REFUSED - the consent token was consumed concurrently or withdrawn.\n'); return EXIT.NO_TOKEN; }
    let claimLine;
    try { claimLine = fs.readFileSync(claim.claimPath, 'utf8').trim(); } catch (_e) { claimLine = ''; }
    tok = parseTokenLine(claimLine, secret);
    const bad = !tok.ok ? tok.reason
      : tok.id !== id ? `token names rule "${tok.id}", not "${id}"`
      : (tok.digest && tok.digest !== freshDigest) ? 'the precision-digest changed since sign-off (spec/corpus/build drift or precision drift) - re-measure and re-confirm'
      : ledgerHasTokenMac(tok.token_mac) ? 'this consent token was already consumed (replay)'
      : null;
    if (bad) { removeClaim(claim.claimPath); process.stderr.write(`taste-enforce: REFUSED - ${bad}\n`); return bad.includes('replay') ? EXIT.REPLAY : EXIT.NO_TOKEN; }

    const pre2 = verifyLedger();
    if (!pre2.ok) { removeClaim(claim.claimPath); process.stderr.write('taste-enforce: REFUSED - enforcement ledger is inconsistent:\n'); for (const e of pre2.errors) process.stderr.write(`  - ${e}\n`); return EXIT.LEDGER_TAMPERED; }

    try {
      const p = (obj.provenance || {});
      mac = appendLedger({
        ruleId: id, store, content_digest: contentDigest(obj), precision_digest: freshDigest,
        precision: meas.report ? meas.report.precision : null,
        source: p.source || 'unknown', commit: p.commit || p.ref || 'unknown', retrieved_utc: p.retrieved_utc || 'unknown',
        approvedBy: 'human', approved_utc, token_mac: tok.token_mac,
      }).mac;
    } catch (e) { removeClaim(claim.claimPath); process.stderr.write(`taste-enforce: ledger append failed (${e.code || 'ERR'}): ${e.message}\n`); return e.code === 'ELEDGER' ? EXIT.LEDGER_TAMPERED : EXIT.IO; }
  } finally {
    releaseLedgerLock(lock);
  }

  // 4) Flip to the blocking tier: write data/enforced-rules/<id>.json with severity flipped to
  //    blocking, atomically (temp + rename). If this fails after the ledger append, the result is a
  //    SAFE orphan (a ledger entry with no enforced file), reported by `audit`.
  const destDir = enforcedDir();
  const destPath = path.join(destDir, id + '.json');
  const body = ruleBodyOf(obj);
  const enforcedBody = Object.assign({}, body, {
    severity: BLOCKING_SEVERITY,
    sourceVocabulary: 'mined-taste',
    severityOverrideReason: `enforced via sidecoach-taste-enforce (held-out precision ${meas.report ? meas.report.precision : 'n/a'} >= threshold, human-signed); flipped from advisory to blocking`,
  });
  const enforced = Object.assign({}, obj, {
    rule: enforcedBody,
    _enforcement: {
      ruleId: id, store, promotedFrom: 'guidance', approvedBy: 'human', approved_utc,
      precision: meas.report ? meas.report.precision : null, precision_digest: freshDigest,
      token_mac: tok.token_mac, ledger_mac: mac, content_digest: contentDigest(obj),
    },
  });
  try { fs.mkdirSync(destDir, { recursive: true }); } catch (e) {
    removeClaim(claim.claimPath);
    process.stderr.write(`taste-enforce: ledger recorded the enforcement but the enforced dir ${destDir} could not be created: ${e.message}. Safe ORPHAN; "audit" will show it.\n`);
    return EXIT.IO;
  }
  const tmpPath = destPath + '.tmp.' + process.pid;
  try { fs.writeFileSync(tmpPath, JSON.stringify(enforced, null, 2) + '\n'); fs.renameSync(tmpPath, destPath); }
  catch (e) {
    try { fs.unlinkSync(tmpPath); } catch (_e2) { /* best-effort */ }
    removeClaim(claim.claimPath);
    process.stderr.write(`taste-enforce: ledger recorded the enforcement but writing ${destPath} FAILED: ${e.message}. Safe ORPHAN; run "audit".\n`);
    return EXIT.IO;
  }
  removeClaim(claim.claimPath);

  // 5) BUILD gate: validateRegistry + --check + tsc must pass. A failure rolls back the enforced file
  //    (the ledger entry stays a safe orphan). SECURITY (Codex HIGH): the build-cmd override is
  //    TEST-ONLY - honored ONLY under a test root. In production (no SIDECOACH_ENFORCE_TEST_ROOT) the
  //    REAL `npm run build` ALWAYS runs, so `SIDECOACH_ENFORCE_BUILD_CMD=true enforce <id>` cannot
  //    skip the gate and leave a rule enforced that the real build would reject.
  const buildCmd = (process.env.SIDECOACH_ENFORCE_TEST_ROOT && process.env.SIDECOACH_ENFORCE_BUILD_CMD)
    ? process.env.SIDECOACH_ENFORCE_BUILD_CMD
    : 'npm run build';
  process.stdout.write(`taste-enforce: running build gate (${buildCmd}) ...\n`);
  const build = spawnSync(buildCmd, { shell: true, cwd: repoRoot(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (build.status !== 0) {
    try { fs.unlinkSync(destPath); } catch (_e) { /* best-effort */ }
    process.stderr.write(`taste-enforce: BUILD FAILED after flip (${buildCmd} exit ${build.status}); rolled back ${destPath}. The enforcement-ledger entry remains as a safe ORPHAN ("audit" shows it); reconcile or re-enforce.\n`);
    if (build.stderr) process.stderr.write(build.stderr.slice(-2000));
    return EXIT.BUILD_FAILED;
  }

  process.stdout.write(`taste-enforce: ENFORCED "${id}" -> blocking tier (severity ${BLOCKING_SEVERITY}) in store "${store}"\n`);
  process.stdout.write(`  enforced file : ${destPath}\n`);
  process.stdout.write(`  precision     : ${meas.report ? meas.report.precision : 'n/a'} (digest ${freshDigest})\n`);
  process.stdout.write(`  ledger mac    : ${mac}\n`);
  process.stdout.write('  token consumed (single-use). Blocking ships OFF-BY-DEFAULT behind a per-project opt-in.\n');
  return EXIT.OK;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------
function cmdEnforce(id) { if (!id) { usage(); return EXIT.USAGE; } return doEnforce(id); }

function cmdApprove(id) {
  // NOT a mint path. A TTY helper that re-measures precision fresh and prints the exact phrase the
  // user must type so the arm hook mints the token. Refuses off a TTY (misleading affordance).
  if (!id) { usage(); return EXIT.USAGE; }
  if (!isSafeId(id)) { process.stderr.write(`taste-enforce: invalid rule id "${id}"\n`); return EXIT.USAGE; }
  if (!process.stdout.isTTY) {
    process.stderr.write('taste-enforce: "approve" is an interactive helper. Only the user, in their own REPL, mints consent by typing:\n');
    process.stderr.write(`    ${CONFIRM_PHRASE} ${id} <precision-digest>\n`);
    return EXIT.NO_TTY;
  }
  const prom = promotionEntryFor(id);
  if (!prom) { process.stderr.write(`taste-enforce: "${id}" is not guidance-promoted (no promotion-ledger entry). Promote it first.\n`); return EXIT.NOT_PROMOTED; }
  const g = readGuidanceRule(id, prom.store);
  if (!g.found) { process.stderr.write(`taste-enforce: guidance rule "${id}" not found in store "${prom.store}"\n`); return EXIT.NO_RULE; }
  if (g.parseError) { process.stderr.write(`taste-enforce: guidance rule "${id}" is not valid JSON: ${g.parseError}\n`); return EXIT.BAD_RULE; }
  const v = validateEnforceable(g.obj, id);
  if (!v.ok) { process.stdout.write('validation  : FAIL (not enforceable)\n'); for (const e of v.errors) process.stdout.write(`  - ${e}\n`); return EXIT.BAD_RULE; }
  const meas = measurePrecision(id, guidancePath(prom.store, id));
  if (meas.error) { process.stderr.write(`taste-enforce: precision measurement error: ${meas.error}\n`); return EXIT.BAD_RULE; }
  if (meas.refused) {
    process.stdout.write(`taste-enforce: NOT eligible - precision did not clear the bar (${meas.code === 7 ? 'denominator under floor' : 'below threshold'}).\n`);
    if (meas.report) process.stdout.write(`  P=${meas.report.precision === null ? 'n/a' : meas.report.precision} fires=${meas.report.fires} held-out-positives=${meas.report.heldoutPositives}\n`);
    return EXIT.PRECISION_REFUSED;
  }
  process.stdout.write(`taste-enforce: rule "${id}" CLEARS the precision bar (P=${meas.report.precision}, fires=${meas.report.fires}, held-out-positives=${meas.report.heldoutPositives}).\n`);
  process.stdout.write('\nTo ENFORCE this rule (flip it to a BLOCKING detector), type the following line in YOUR OWN prompt (not via a tool):\n');
  process.stdout.write(`    ${CONFIRM_PHRASE} ${id} ${meas.digest}\n`);
  process.stdout.write('The digest binds your sign-off to THIS measured precision: if the spec, corpus, interpreter build, or\n');
  process.stdout.write('the precision itself changes before you enforce, the enforce is refused. That mints a single-use consent\n');
  process.stdout.write(`token (an agent cannot). Then run:\n    sidecoach-taste-enforce enforce ${id}\n`);
  return EXIT.OK;
}

function cmdCheck(id) {
  if (!id) { usage(); return EXIT.USAGE; }
  if (!isSafeId(id)) { process.stderr.write(`taste-enforce: invalid rule id "${id}"\n`); return EXIT.USAGE; }
  const tok = checkToken(id, '');   // presence + id binding only (digest bound at enforce time)
  if (tok.ok) { process.stdout.write(`taste-enforce: a consent token is present for "${id}" (precision-digest ${tok.digest})\n`); return EXIT.OK; }
  process.stdout.write(`taste-enforce: no valid consent token for "${id}": ${tok.reason}\n`);
  return EXIT.NO_TOKEN;
}

function cmdVerifyLedger() {
  const res = verifyLedger();
  if (res.ok) { process.stdout.write(`taste-enforce: enforcement ledger OK - ${res.count} entr${res.count === 1 ? 'y' : 'ies'}, chain + head anchor verified.\n`); return EXIT.OK; }
  process.stderr.write('taste-enforce: enforcement ledger verification FAILED:\n');
  for (const e of res.errors) process.stderr.write(`  - ${e}\n`);
  return EXIT.LEDGER_TAMPERED;
}

function listEnforcedFiles() {
  const base = enforcedDir();
  let names;
  try { names = fs.readdirSync(base); } catch (_e) { return []; }
  return names.filter((n) => n.endsWith('.json')).map((n) => ({ name: n, full: path.join(base, n) }));
}

function cmdAudit() {
  const led = verifyLedger();
  if (!led.ok) { process.stderr.write('taste-enforce: AUDIT - enforcement ledger is TAMPERED:\n'); for (const e of led.errors) process.stderr.write(`  - ${e}\n`); return EXIT.LEDGER_TAMPERED; }
  const byId = new Map();
  for (const e of parseLedger()) if (!e.__parseError) byId.set(e.ruleId, e);
  const enforced = listEnforcedFiles();
  const enforcedIds = new Set();
  const problems = [];
  for (const f of enforced) {
    const id = f.name.replace(/\.json$/, '');
    enforcedIds.add(id);
    let obj;
    try { obj = JSON.parse(fs.readFileSync(f.full, 'utf8')); } catch (e) { problems.push(`enforced file ${f.name} is not valid JSON (${e.message})`); continue; }
    const entry = byId.get(id);
    if (!entry) { problems.push(`UN-BLESSED: enforced rule "${id}" has NO enforcement-ledger entry - not enforced through the gate`); continue; }
    const body = ruleBodyOf(obj);
    if (!body || (body.severity !== 'blocker' && body.severity !== 'major')) problems.push(`NON-BLOCKING: enforced rule "${id}" carries severity "${body ? body.severity : '(none)'}" - an enforced rule must be blocking`);
    for (const cand of [obj.ruleId, body && body.ruleId]) if (typeof cand === 'string' && cand && sanitizeId(cand) !== id) problems.push(`ID MASQUERADE: "${f.name}" carries id field "${cand}" that does not match filename "${id}"`);
    // content_digest is REQUIRED (Codex HIGH #2): a MISSING one is a failure, not a skipped check - an
    // HMAC-valid but content_digest-less row (legacy/migrated/forged) must not escape content-binding,
    // or a later enforced-file content swap would go uncaught.
    if (!entry.content_digest) problems.push(`MISSING CONTENT DIGEST: "${id}" enforcement-ledger entry carries no content_digest - content cannot be bound (legacy/forged); refusing`);
    else if (contentDigest(obj) !== entry.content_digest) problems.push(`CONTENT TAMPERED: "${id}" enforced content does not match the ledger's approved digest`);
    if (entry.store && f.name && obj._enforcement && obj._enforcement.store && obj._enforcement.store !== entry.store) problems.push(`STORE MISMATCH: "${id}" enforced store "${obj._enforcement.store}" != ledger store "${entry.store}"`);
  }
  const orphans = [...byId.keys()].filter((id) => !enforcedIds.has(id));
  if (problems.length) {
    process.stderr.write('taste-enforce: AUDIT FAILED:\n');
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    if (orphans.length) process.stderr.write(`  (info) ledger entries with no enforced file (safe orphans): ${orphans.join(', ')}\n`);
    return EXIT.AUDIT_DISCREPANCY;
  }
  process.stdout.write(`taste-enforce: AUDIT clean - ${enforced.length} enforced rule(s), all ledger-backed (content bound); chain verified (${led.count} entr${led.count === 1 ? 'y' : 'ies'}).\n`);
  if (orphans.length) process.stdout.write(`  (info) ledger entries with no enforced file (safe orphans): ${orphans.join(', ')}\n`);
  return EXIT.OK;
}

function cmdList() {
  const enforced = listEnforcedFiles();
  if (!enforced.length) { process.stdout.write('taste-enforce: no enforced rules yet.\n'); return EXIT.OK; }
  process.stdout.write(`taste-enforce: ${enforced.length} enforced rule(s):\n`);
  for (const f of enforced) {
    const id = f.name.replace(/\.json$/, '');
    let sev = '?';
    try { const o = JSON.parse(fs.readFileSync(f.full, 'utf8')); sev = ruleBodyOf(o).severity || '?'; } catch (_e) { sev = 'INVALID'; }
    process.stdout.write(`  ${id} (severity ${sev})\n`);
  }
  return EXIT.OK;
}

function usage() {
  process.stderr.write(`sidecoach-taste-enforce - the second, precision-gated, human-signed gate: flip a mined GUIDANCE rule to a BUILD-BLOCKING detector.

Usage:
  sidecoach-taste-enforce list                  List enforced rules.
  sidecoach-taste-enforce approve <ruleId>      Re-measure precision + print the exact REPL phrase to sign off (does NOT mint).
  sidecoach-taste-enforce enforce <ruleId>      Enforce by consuming a valid precision-bound consent token, then build-gate.
  sidecoach-taste-enforce check <ruleId>        Report whether a consent token is present (no consume).
  sidecoach-taste-enforce verify-ledger         Verify the enforcement ledger chain + head anchor.
  sidecoach-taste-enforce audit                 Flag any enforced rule with no matching ledger entry / non-blocking severity.

The rule must be ALREADY guidance-promoted (a promotion-ledger entry). Consent is minted ONLY by the
user typing "${CONFIRM_PHRASE} <ruleId> <precision-digest>" in their OWN prompt (sidecoach-taste-enforce-arm.sh);
run "approve <ruleId>" to get the exact line. The <precision-digest> binds the sign-off to a FRESH
held-out precision measurement. Agents are hook-fenced from the token path and from the arm hook.

Exit: 0 ok, 2 usage, 3 no rule, 4 bad rule, 5 no token, 6 no TTY, 7 precision refused, 8 ledger tampered,
9 audit discrepancy, 10 IO, 11 replay, 12 not guidance-promoted, 13 build failed.
`);
}

function parseArgs(argv) {
  const cmd = argv[0];
  let arg;
  for (let i = 1; i < argv.length; i++) { if (arg === undefined && !argv[i].startsWith('--')) arg = argv[i]; }
  return { cmd, arg };
}

function main() {
  const { cmd, arg } = parseArgs(process.argv.slice(2));
  let code;
  try {
    switch (cmd) {
      case 'list': code = cmdList(); break;
      case 'approve': code = cmdApprove(arg); break;
      case 'enforce': code = cmdEnforce(arg); break;
      case 'check': code = cmdCheck(arg); break;
      case 'verify-ledger': code = cmdVerifyLedger(); break;
      case 'audit': code = cmdAudit(); break;
      case '-h': case '--help': case 'help': usage(); code = EXIT.OK; break;
      default: usage(); code = EXIT.USAGE; break;
    }
  } catch (e) {
    process.stderr.write(`taste-enforce: internal error: ${e && e.stack ? e.stack : e}\n`);
    code = EXIT.IO;
  }
  process.exit(code);
}

// Exports NOTHING - every capability touching the secret/token is unreachable via require().
if (require.main === module) { main(); }
