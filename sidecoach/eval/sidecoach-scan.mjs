#!/usr/bin/env node
/**
 * Scorecard helper: run Sidecoach's CURRENT scanner on ONE HTML file and print normalized findings as JSON.
 * Runs as a SUBPROCESS so the collect can group-kill it on a timeout.
 *
 * DECOUPLE (lead ruling 2026-06-24): the SUBJECTIVE family (validateTaste + absolute-ban scanners) has a
 * ReDoS-class SYNC hang (scanIdenticalCardGrids on large HTML) that blocks the event loop. When it ran in the
 * SAME process as the async OBJECTIVE rendered scan, a ReDoS hang starved the objective scan entirely (the
 * subprocess was group-killed at the outer timeout before the objective render even started), turning real
 * objective detections into false negatives (e.g. db_worldbank_data, mk_kubernetes_live). The fix isolates the
 * two families into SEPARATE subprocess invocations so a subjective hang can never starve the objective result:
 *   mode 'objective'  -> ONLY the rendered objective scan (immune to the subjective ReDoS)
 *   mode 'subjective' -> ONLY validateTaste + absolute-ban (the ReDoS-prone family; may legitimately time out)
 *   mode 'both' (default, back-compat) -> both, in-process
 * NOT done here: deleting scanIdenticalCardGrids (that is the Stage-2 first destructive deletion, hard-
 * checkpointed to Jonah, sequenced AFTER ST1 ships the replacement icon-tile-stack detector).
 * Output: JSON array of { source, rule, severity } on stdout.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', 'dist');
const file = process.argv[2];
const mode = process.argv[3] || 'both'; // 'objective' | 'subjective' | 'both'
if (!file || !['objective', 'subjective', 'both'].includes(mode)) {
  process.stderr.write('usage: sidecoach-scan.mjs <html-file> [objective|subjective|both]\n'); process.exit(2);
}
const html = readFileSync(file, 'utf8');
const out = [];

if (mode === 'subjective' || mode === 'both') {
  const taste = await import(path.join(DIST, 'taste-validator.js'));
  const ban = await import(path.join(DIST, 'absolute-ban-detector.js'));
  // EVAL-SCAN EXCLUDE (lead ruling 2026-06-24): taste/fabricated-svg + taste/hex-in-interactive-state are KEPT in
  // the product (fabricated-svg = the core "never fabricate SVG icons" guardrail; hex-in-interactive = a theming
  // blocker) but are UNMAPPED noise on this real-world eval corpus (they fire on legit unmarked SVGs / hex usage).
  // Excluding them here cleans the raw-finding VOLUME optic WITHOUT deleting product code; they're unmapped so this
  // changes no class recall/precision. (scanIdenticalCardGrids was DELETED from the product - Stage-2 - so it's
  // simply gone from the ban list below.)
  const EVAL_EXCLUDE = new Set(['taste/fabricated-svg', 'taste/hex-in-interactive-state']);
  for (const v of (taste.validateTaste(html) || [])) { if (EVAL_EXCLUDE.has(v.ruleId)) continue; out.push({ source: 'taste-validator', rule: v.ruleId, severity: v.severity ?? null }); }
  for (const s of ['scanSideStripeBorders', 'scanGradientText', 'scanGlassmorphism', 'scanHeroMetricTemplate', 'scanModalAsFirstThought']) {
    if (typeof ban[s] === 'function') for (const b of (ban[s](html, path.basename(file)) || [])) out.push({ source: 'absolute-ban', rule: b.banName, severity: b.severity ?? null });
  }
}

if (mode === 'objective' || mode === 'both') {
  // Stage 1: the OWNED rendered objective scanner - the SAME compiled product module that ships (dist/), NOT an
  // eval-only reimplementation (lead strengthening #4). The scorecard therefore measures shipping product code.
  const objective = await import(path.join(DIST, 'validators', 'objective-rendered-scanner.js'));
  const objScan = await objective.scanObjectiveRendered(html, { timeoutMs: 60000 });
  if (objScan && objScan.available) {
    for (const f of objScan.findings) out.push({ source: 'objective-rendered', rule: f.rule, severity: f.severity ?? null });
  } else if (mode === 'objective') {
    // FAIL-CLOSED (Codex review High): an unavailable objective render must NOT read as "available, 0 findings"
    // (a false clean). In dedicated 'objective' mode, exit nonzero so the collect records
    // sidecoachObjectiveAvailable=false (-> the page's objective GT classes count as FN, never a false pass).
    process.stderr.write(`objective scan unavailable: ${(objScan && objScan.reason) || 'unknown'}\n`);
    process.exit(3);
  }
  // RENDERED SUBJECTIVE (taste) scan - runs in the SAME rendered subprocess as objective (immune to the static
  // subjective ReDoS) and reads the same hermetic render the dev labeler screenshotted (render-basis parity).
  // Stage 1 ST1: tiny-text. source='subjective-rendered' so the scorer maps it to its taste class.
  const subjectiveR = await import(path.join(DIST, 'validators', 'subjective-rendered-scanner.js'));
  const sjScan = await subjectiveR.scanSubjectiveRendered(html, { timeoutMs: 60000 });
  if (sjScan && sjScan.available) {
    for (const f of sjScan.findings) out.push({ source: 'subjective-rendered', rule: f.rule, severity: f.severity ?? null });
  } else if (mode === 'objective' && !(objScan && objScan.available)) {
    // (only fail-closed once; the objective branch above already exits if its render failed)
  }
  // ('both' mode is back-compat only and not used by the collect; it stays lenient by design.)
}
process.stdout.write(JSON.stringify(out));
