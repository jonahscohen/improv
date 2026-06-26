#!/usr/bin/env node
/**
 * Contract-6 CANDIDATE SOURCING + CAPTURE + MANIFEST (Stage 0).
 *
 * Jonah's corpus-sourcing process: WEB-SOURCE real shipped designs -> present the
 * FULL candidate manifest to lead + Jonah for the INDEPENDENCE REVIEW -> prune/approve
 * -> THEN freeze (corpus-tool.mjs). This module does the sourcing/capture/manifest;
 * it never freezes and never decides inclusion (the joint review does).
 *
 * INTEGRITY RULES baked in:
 * - Captures a SELF-CONTAINED static snapshot (inlines linked CSS, strips <script>)
 *   so the detector has real source to scan and the artifact is deterministic/safe.
 * - Records PROVENANCE per case: source URL, capture date, selector, why-chosen, register.
 * - NO DETECTABILITY PRE-FILTER: capture records what was sourced; it does NOT run
 *   any detector to screen candidates (that bias is what the independence review guards).
 * - LABELING INDEPENDENCE: `propose-label` tags each label objective|subjective. A
 *   subjective label whose labeler is a registered rule-author (or the rule-writer)
 *   is marked needsIndependentLabel=true and MUST be (re)labeled by an independent
 *   labeler before freeze. Objective labels (e.g. contrast) are computed from the
 *   WCAG/CSS spec at freeze time, not opinion.
 *
 * Manifest: corpus/candidates.json | Captures: corpus/candidates/<id>.html
 * `SIDECOACH_CORPUS_DIR` overridable for tests.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = process.env.SIDECOACH_CORPUS_DIR || path.join(HERE, 'corpus');
const CANDIDATES = path.join(CORPUS_DIR, 'candidates.json');
const CAP_DIR = path.join(CORPUS_DIR, 'candidates');
const RULE_AUTHORS = path.join(CORPUS_DIR, 'rule-authors.json');

const REGISTERS = new Set(['landing', 'marketing', 'dashboard', 'app-ui', 'product', 'forms', 'editorial', 'other']);

function readJson(p, fb) { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb; }
function writeJson(p, v) { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }
function norm(s) { return String(s ?? '').trim().toLowerCase(); }
function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; return o; }

/**
 * Capture a self-contained static snapshot of a URL: inline linked CSS, drop <script>.
 * Returns the HTML string. Uses Playwright (the same dep the hermetic browser engine uses).
 */
export async function captureSnapshot(url, { timeoutMs = 20000 } = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    // Inline same/cross-origin linked stylesheets, strip scripts, in-page (best-effort).
    await page.evaluate(async () => {
      for (const link of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) {
        try {
          const css = await (await fetch(link.href)).text();
          const style = document.createElement('style');
          style.setAttribute('data-inlined-from', link.href);
          style.textContent = css;
          link.replaceWith(style);
        } catch { /* leave the link; capture notes incompleteness */ }
      }
      for (const s of Array.from(document.querySelectorAll('script'))) s.remove();
    });
    const raw = await page.evaluate(() => document.documentElement.outerHTML);
    // Belt-and-suspenders: also strip any <script> that survived the DOM pass (some
    // pages - incl archive replays - re-inject after load). The static corpus must be
    // safe + deterministic; scripts are never needed for design-source scanning.
    const stripped = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script\b[^>]*\/?>/gi, '');
    return '<!doctype html>\n' + stripped;
  } finally {
    await browser.close();
  }
}

// Independence-critical exclusion (lead guardrail 1): the ORACLE must NEVER be in the
// test set. Refuse oracle's own pages/demos/docs/outputs by host. (Pages knowingly
// designed against oracle's/our rules are also excluded - procedural + caught at the
// independence review, since that can't be auto-detected from a URL.)
const ORACLE_HOST_RE = /(^|\.)oracle\b|oracle\.style|oracle/i;

export function isExcludedSource(url) {
  try { return ORACLE_HOST_RE.test(new URL(url).hostname) || ORACLE_HOST_RE.test(url); }
  catch { return false; }
}

// ARCHIVE-VALIDITY (lead reinforcement 3): a capture becomes a case ONLY if it rendered
// as the ORIGINAL intended page - substantive CSS present, not a broken-archive artifact.
// An archival break (wayback error / missing assets / near-empty) mislabeled as a design
// defect would poison the ground truth. Returns { valid, reason }.
const ARCHIVE_ERROR_RE = /Wayback Machine has not archived|Got an HTTP \d|page is not available|this URL has been excluded|Page cannot be (crawled|displayed)|robots\.txt/i;
// SPA EMPTY-SHELL (added from the hard-register yield probe: grafana captured a 16KB
// shell - inlined CSS present, but body was just "Grafana is starting up... Error
// loading Grafana", 0 form controls, 2 content elements). The CSS check passed it, so
// an unrendered SPA shell could be mislabeled a design case. These markers are
// unambiguous loading / JS-required / app-error states.
const SPA_SHELL_RE = /you need to enable JavaScript to run this app|enable JavaScript (and reload|to (use|view|run))|is starting up\b|Error loading [A-Z]\w+|this app (works best|requires) /i;
// Body prose (visible text) and content-bearing element count, for the empty-shell check.
function renderedProse(html) {
  const body = (/(<body[\s\S]*<\/body>)/i.exec(html) || [html])[0];
  const stripped = body
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ');
  const contentEls = (body.match(/<(h[1-6]|p|li|a|label|button|td|th|figcaption|blockquote)\b/gi) || []).length;
  return { prose: stripped.replace(/\s+/g, ' ').trim(), contentEls };
}
export function validateCapture(html) {
  if (!html || html.length < 1000) return { valid: false, reason: `near-empty capture (${html ? html.length : 0} bytes) - likely broken/blocked` };
  if (ARCHIVE_ERROR_RE.test(html)) return { valid: false, reason: 'archive/error artifact (wayback error or excluded page), not the original design' };
  // Substantive CSS must be present (inlined <style> with real content, or an inlined linked sheet).
  const styleCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('');
  const hasInlinedSheet = /data-inlined-from=/.test(html);
  if (styleCss.replace(/\s+/g, '').length < 200 && !hasInlinedSheet) {
    return { valid: false, reason: 'no substantive CSS (missing assets / broken archive) - cannot label design reliably' };
  }
  // SPA empty-shell: a loading/JS-required state with little real content. Conservative
  // so minimal-but-complete pages (e.g. example.com: ~170B prose, 3 content els) PASS:
  // reject only (a) a known loading/JS-required marker on a low-prose body, or (b) a
  // structurally-empty mount (0 content elements + near-zero prose).
  const { prose, contentEls } = renderedProse(html);
  if (prose.length < 200 && SPA_SHELL_RE.test(prose)) {
    return { valid: false, reason: `SPA empty-shell / loading state ("${prose.slice(0, 60)}") - content never rendered, not a design case` };
  }
  if (prose.length < 40 && contentEls === 0) {
    return { valid: false, reason: 'structurally-empty body (0 content elements) - unrendered shell, not a design case' };
  }
  return { valid: true };
}

export async function capture(a) {
  if (!a.id) throw new Error('--id required');
  if (!a.url) throw new Error('--url required');
  if (a.register && !REGISTERS.has(a.register)) throw new Error(`--register one of ${[...REGISTERS].join('/')}`);
  if (isExcludedSource(a.url)) throw new Error(`REFUSED: ${a.url} looks like the ORACLE (oracle) - the oracle must never be in the test set (independence-critical).`);
  const manifest = readJson(CANDIDATES, []);
  if (manifest.some((c) => c.id === a.id)) throw new Error(`duplicate candidate id: ${a.id}`);
  const html = await captureSnapshot(a.url);
  const validity = validateCapture(html);
  if (!validity.valid) throw new Error(`REJECTED (archive-validity): ${validity.reason}`);
  mkdirSync(CAP_DIR, { recursive: true });
  const rel = path.join('candidates', `${a.id}.html`);
  writeFileSync(path.join(CORPUS_DIR, rel), html);
  const c = {
    id: a.id,
    file: rel,
    register: a.register ?? 'other',
    // diversity metadata (guardrail 4) - source ACROSS quality + era so the corpus is
    // not biased toward what our rules detect. NOT a defect label; audited at the review.
    diversity: { quality: a.quality ?? null, era: a.era ?? null },
    status: 'candidate', // candidate -> approved|pruned by the joint independence review
    provenance: {
      source: a.url,
      captureUtc: new Date().toISOString(),
      selector: a.selector ?? 'web-source',
      why: a.why ?? null,
      license: a.license ?? null, // license/ToS note (guardrail 5)
    },
    objectiveLabels: [], // architect computes these by spec-math (propose-label, objective only)
    subjectiveStatus: 'pending-independent', // SUBJECTIVE labels are set ONLY by the lead-run independent Codex pass (Jonah's division of labor); architect never sets them
  };
  manifest.push(c);
  writeJson(CANDIDATES, manifest);
  return { id: a.id, file: rel, bytes: html.length };
}

/**
 * Architect adds OBJECTIVE labels ONLY (computed by WCAG/CSS spec-math). SUBJECTIVE
 * labels are REFUSED here - Jonah's division of labor keeps the rule-author (me)
 * completely out of subjective ground truth; those are set by the lead-run independent
 * Codex pass (labeledBy=codex) and enforced by corpus-tool's author!=labeler at freeze.
 */
export function proposeLabel(a) {
  const manifest = readJson(CANDIDATES, []);
  const c = manifest.find((x) => x.id === a.id);
  if (!c) throw new Error(`no candidate ${a.id}`);
  const kind = norm(a.kind);
  if (kind === 'subjective') {
    throw new Error('REFUSED: subjective labels are set by the lead-run independent Codex pass, NOT the architect (author!=labeler). Architect proposes objective labels only.');
  }
  if (kind !== 'objective') throw new Error('--kind objective (subjective is lead-run only)');
  if (!c.objectiveLabels) c.objectiveLabels = [];
  c.objectiveLabels.push({ class: a.class, kind: 'objective', labeledBy: a['labeled-by'] ?? 'spec-math', method: 'wcag/css-spec' });
  writeJson(CANDIDATES, manifest);
  return { id: a.id, class: a.class, kind: 'objective' };
}

/** Full candidate set for the joint independence review (NO favorable subset). */
export function manifestReport() {
  const manifest = readJson(CANDIDATES, []);
  const byRegister = {};
  let subjectivePending = 0, objectiveLabels = 0;
  for (const c of manifest) {
    byRegister[c.register] = (byRegister[c.register] || 0) + 1;
    if (c.subjectiveStatus === 'pending-independent') subjectivePending++;
    objectiveLabels += (c.objectiveLabels || []).length;
  }
  return { total: manifest.length, byRegister, candidatesPendingIndependentSubjectiveLabeling: subjectivePending, objectiveLabelsByArchitect: objectiveLabels, cases: manifest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  try {
    if (cmd === 'capture') { const r = await capture(a); console.log(`captured ${r.id} -> ${r.file} (${r.bytes} bytes); subjective labeling pending (lead-run Codex)`); }
    else if (cmd === 'propose-label') { const r = proposeLabel(a); console.log(`objective label ${r.class} on ${r.id} (spec-math)`); }
    else if (cmd === 'manifest') { const r = manifestReport(); console.log(JSON.stringify({ total: r.total, byRegister: r.byRegister, candidatesPendingIndependentSubjectiveLabeling: r.candidatesPendingIndependentSubjectiveLabeling, objectiveLabelsByArchitect: r.objectiveLabelsByArchitect }, null, 2)); }
    else { console.error('usage: corpus-candidate.mjs <capture --id --url [--register --selector --why --license --quality --era] | propose-label --id --class --kind objective [--labeled-by] | manifest>  (subjective labels are lead-run, not architect; oracle/oracle URLs refused)'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(1); }
}
