#!/usr/bin/env node

/**
 * Sidecoach Detect - ONE command that scans any target and emits normalized findings.
 *
 * This is the productized entry point for detectors that ALREADY EXIST. It contains no
 * detection logic of its own: it dispatches a target to the shipping engines and folds
 * their results into one findings shape. If you find yourself adding a rule here, it
 * belongs in a scanner, not in this file.
 *
 * DISPATCH
 *   url / host        -> runRenderedAudit  (objective + subjective rendered lenses)
 *   directory         -> static-ban + static-check
 *   source file       -> static-ban + static-check
 *   local .html file  -> static-ban + static-check AND a rendered pass over its file:// URL
 *
 *   A local .html gets BOTH paths because they see different things: the rendered lenses
 *   read computed styles off a real render, and the static ban scanners read the raw source
 *   (which is what catches gradient-text). Where a target can be rendered, the render URL is
 *   also threaded into the static-check context, so the registry's rendered-evidence rules
 *   (contrast, heading order, hit area, typography rhythm) resolve against real evidence
 *   instead of reporting inconclusive.
 *
 * LENSES (a lens is one engine's verdict on this target)
 *   objective     - rendered WCAG scanner            (via runRenderedAudit)
 *   subjective    - rendered taste scanner           (via runRenderedAudit)
 *   static-ban    - the 5 named absolute-ban scanners over RAW file content
 *   static-check  - the product rule registry via run-validator's evaluateCleanPolicy
 *
 *   static-ban and static-check OVERLAP by design: the anti-pattern validator adapts the
 *   same 5 ban scanners over the collector's extracted css/markup slices, while static-ban
 *   runs them over raw file text and carries each ban's rewrite options.
 *
 *   A defect BOTH engines see at the SAME location is reported ONCE, carrying
 *   `corroboratedBy: ['<other lens>']`. This is not a hidden dedupe - the older behaviour
 *   emitted two findings for one defect, which double-counted our own numbers and asked the
 *   reader to notice that two lines were the same bug. The reason a silent merge was refused
 *   still holds (two-engine agreement must stay distinguishable from a single read), and
 *   corroboratedBy is what preserves it: the agreement is now an explicit field on one
 *   finding instead of a coincidence between two. Findings at DIFFERENT locations are never
 *   merged - those are different sites, not one defect seen twice.
 *
 * FAIL-CLOSED (the whole point of this tool)
 *   A lens that did not run is NEVER counted as clean. `clean` is the strongest claim and
 *   needs the most evidence: EVERY attempted lens actually ran AND found nothing. One lens
 *   failing with zero findings elsewhere is `inconclusive`, because the lens that did not
 *   run is exactly where the blockers might have been. Nothing scanned at all is
 *   `inconclusive`. This is runRenderedAudit's verdict discipline, generalized over N lenses.
 *
 * OUTPUT
 *   stdout - the result JSON of a SCAN, always, so the exit code is never the only machine signal.
 *            The QUERY modes (--help, --list-rules) are the exception: they answer a question
 *            without scanning and never emit a result JSON (see READING THE EXIT CODE below).
 *   stderr - a human-readable summary (suppress with --quiet).
 *
 * Exit codes (one per outcome class - a nonzero code always means "not certified clean"):
 *   0 = clean         every attempted lens ran and found nothing
 *   1 = findings      at least one finding (verdict blocked or warnings-only)
 *   2 = usage / IO / load error - a scan was never started
 *   3 = inconclusive  at least one attempted lens did not run; NEVER reported as clean
 *
 * READING THE EXIT CODE: exit 0 means clean ONLY when a result JSON was written to stdout.
 * The query modes exit 0 WITHOUT scanning: `--help` (text to stderr, empty stdout) and
 * `--list-rules` (a rule-registry listing to stdout that is NOT a result JSON); the load-failure
 * path also exits without a scan and emits no result JSON. A machine consumer must therefore
 * parse stdout as a scan verdict ONLY when it did not pass a query flag - never treat --list-rules
 * text as a pass. Every path that DID start a scan writes a JSON verdict, including the
 * unexpected-failure path (inconclusive, not a usage error, because a scan was already in flight).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let looksLikeUrl, normalizeRenderUrl;
let scanContentForAbsoluteBans, scannedBanLabel;
let collectFromPath, collectFromSingleFile;
let VALIDATOR_REGISTRATIONS;
let GENERATED_VALIDATORS;
let SEVERITY_TABLE;
let getRuleById;
let RULES;
let listRenderedManifest;

/**
 * runRenderedAudit, loaded ONLY when a render is actually going to happen.
 *
 * ../dist/audit-rendered reaches playwright through rendered-live-scan, and requiring it cost
 * 146ms of a 188ms static scan (measured 2026-07-29) - 78% of the run spent loading a browser
 * driver that --no-render never touches. The two helpers this file needs at ARG-PARSE time
 * (looksLikeUrl / normalizeRenderUrl) are pure string logic and now live in the zero-dependency
 * ../dist/render-target, so classifying a target no longer implies loading a browser.
 *
 * FAIL-CLOSED IS PRESERVED. A require that throws here propagates out of runRenderedLenses,
 * whose catch marks BOTH rendered lenses unavailable-with-a-reason - which makes the verdict
 * inconclusive (exit 3), never clean. The one behaviour change is the exit code for a tree
 * where ONLY audit-rendered is broken: exit 3 (a scan started, one lens could not run) instead
 * of the old exit 2 (nothing was ever scanned). Both are non-zero and neither certifies clean,
 * so no fail-closed guarantee moves; exit 3 is the more accurate class for it.
 */
function loadRenderedAudit() {
  return require('../dist/audit-rendered').runRenderedAudit;
}

try {
  ({ looksLikeUrl, normalizeRenderUrl } = require('../dist/render-target'));
  ({ scanContentForAbsoluteBans, scannedBanLabel } = require('../dist/absolute-ban-detector'));
  ({ collectFromPath, collectFromSingleFile } = require('../dist/validators/project-collector'));
  ({ VALIDATOR_REGISTRATIONS } = require('../dist/flow-validation-capabilities'));
  ({ GENERATED_VALIDATORS } = require('../dist/validators.generated'));
  ({ SEVERITY_TABLE } = require('../dist/product-rule-types'));
  ({ getRuleById, RULES, listRenderedManifest } = require('../dist/product-rule-registry'));
} catch (err) {
  console.error('sidecoach-detect: failed to load ../dist. Run `npm run build` in sidecoach/ first.');
  console.error(err.message);
  process.exit(2);
}

const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_USAGE = 2;
const EXIT_INCONCLUSIVE = 3;

const RENDERABLE_EXT = /\.html?$/i;
const CSS_SOURCE_KINDS = new Set(['css', 'scss', 'sass', 'less']);

function usage() {
  console.error('Usage: sidecoach-detect <target> [options]');
  console.error('');
  console.error('  <target>              a URL/host, a directory, or a source file');
  console.error('');
  console.error('Options:');
  console.error('  --render-url <url>    render this URL for the rendered lenses instead of');
  console.error('                        deriving one (required to render a directory target)');
  console.error('  --no-render           skip the rendered lenses entirely');
  console.error('  --quiet               suppress the stderr summary (JSON still goes to stdout)');
  console.error('  --list-rules          enumerate the rule registry and exit (runs no scan)');
  console.error('  -h, --help            show this help');
  console.error('');
  console.error('stdout is always the result JSON. stderr is the human summary.');
  console.error('');
  console.error('Exit: 0 clean, 1 findings, 2 usage/IO error, 3 inconclusive.');
  console.error('A lens that did not run is NEVER clean - a partial scan with zero findings is inconclusive.');
}

// --list-rules: enumerate the SINGLE rule registry (Stage 3c consolidation). Prints the validator-owned decision
// rules grouped by owner, then the rendered-scanner bindings (scanner rule name -> registry descriptor) that this
// CLI and the audit resolve rendered findings through. A QUERY mode, not a scan: it writes the listing to stdout
// and exits 0, so it never emits a result JSON and never claims a verdict.
function printRuleList() {
  const rendered = listRenderedManifest();
  const lines = [];
  lines.push(`sidecoach detect - rule registry: ${RULES.length} validator-owned rule(s), ${rendered.length} rendered-scanner binding(s)`);
  lines.push('');
  lines.push('VALIDATOR-OWNED RULES (resolved through the generated registry; static + browser + rendered evidence):');
  const owners = [...new Set(RULES.map((r) => r.ownerValidatorId))].sort();
  for (const owner of owners) {
    const owned = RULES.filter((r) => r.ownerValidatorId === owner);
    lines.push(`  ${owner} (${owned.length}):`);
    for (const r of owned) {
      lines.push(`    ${r.ruleId.padEnd(34)} ${r.severity.padEnd(9)} ${r.findingClass.padEnd(12)} ${r.evidenceRequirements.join('+').padEnd(14)} ${r.scope}`);
    }
  }
  lines.push('');
  lines.push('RENDERED-SCANNER BINDINGS (scanner rule -> registry; the single source detect + the audit resolve through):');
  lines.push(`    ${'scannerRule'.padEnd(20)} ${'lens'.padEnd(11)} ${'severity/verdict'.padEnd(18)} maps to`);
  for (const m of rendered) {
    const verdict = m.blocking ? 'blocking' : 'warning';
    const target = m.ruleId ? m.ruleId : `audit-only (${m.findingClass}/${m.registryScope})`;
    lines.push(`    ${m.scannerRule.padEnd(20)} ${m.lens.padEnd(11)} ${`${m.severity}/${verdict}`.padEnd(18)} -> ${target}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function parseArgs(argv) {
  const args = { target: null, renderUrl: null, render: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--list-rules') { printRuleList(); process.exit(EXIT_CLEAN); }
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--no-render') args.render = false;
    else if (a === '--render-url') {
      // Must not swallow the NEXT option as its value: `--render-url --quiet` is a missing
      // value, not a request to render http://--quiet.
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        console.error('sidecoach-detect: --render-url needs a URL value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.renderUrl = value;
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-detect: unknown option "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    } else if (args.target === null) args.target = a;
    else {
      console.error(`sidecoach-detect: unexpected extra argument "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    }
  }
  return args;
}

// The blocking severity set is the SHIPPED policy's, read off the generated validator -
// never a second severity table hand-maintained here.
function blockingSeveritiesFor(validatorId) {
  const gen = GENERATED_VALIDATORS.find((v) => v.validatorId === validatorId);
  return new Set(gen ? gen.cleanPolicy.blockingSeverities : ['blocker', 'major']);
}

const BAN_BLOCKING = blockingSeveritiesFor('anti-pattern');

/**
 * Severity for a named absolute ban, resolved through the REGISTRY entry that owns it
 * (`anti-pattern.<banName>`), not through the scanner's raw P0/P1/P2 tag.
 *
 * The two disagree on purpose: the ban scanners tag hero-metric-template P1, but the
 * registry deliberately overrides that rule to `minor`. Reading the raw tag would let this
 * CLI call a defect blocking while the anti-pattern validator - the shipped owner of the
 * same rule - calls it non-blocking. Deriving from the registry keeps this file wiring.
 * SEVERITY_TABLE is only the fallback for a ban with no registry entry (the detector's
 * ban-list-drift guard makes that near-impossible, but a silent wrong severity would be
 * worse than an explicit fallback).
 */
function banSeverity(banName, rawSeverity) {
  const def = getRuleById(`anti-pattern.${banName}`);
  const canonical = def ? def.severity : SEVERITY_TABLE[rawSeverity];
  return BAN_BLOCKING.has(canonical) ? 'blocking' : 'warning';
}

/** A lens record. `attempted` is what we set out to run; `available` is what actually ran. */
function lens(attempted) {
  return { attempted, available: false, findings: 0, reason: undefined };
}

// Every lens this tool knows about, in report order.
const ALL_LENSES = ['static-ban', 'static-check', 'objective', 'subjective'];

/**
 * Record the lenses that were deliberately NOT attempted, with why. A skipped lens is not a
 * coverage gap (it cannot make the verdict inconclusive), but leaving it out of the report
 * entirely would let a two-lens `clean` read like a four-lens `clean`. Naming the skip is
 * the difference between "we checked and found nothing" and "we did not check".
 */
function recordSkippedLenses(lenses, reasonFor) {
  const ordered = {};
  for (const name of ALL_LENSES) {
    if (lenses[name]) ordered[name] = lenses[name];
    else ordered[name] = { attempted: false, available: false, findings: 0, reason: reasonFor(name) };
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// static-ban lens: the 5 named absolute bans over RAW file content.
// ---------------------------------------------------------------------------
function runStaticBanLens(collected, readRaw) {
  const record = lens(true);
  const findings = [];
  // A file we discovered but could NOT read is a coverage gap, not an absent defect.
  const gaps = collected.discovered.filter((d) => d.outcome === 'unreadable' || d.outcome === 'oversized');
  for (const f of collected.files) {
    // Raw file content: a css-family file keeps its full text in cssText, every other
    // collectable kind keeps its full text in markup.
    const raw = CSS_SOURCE_KINDS.has(f.sourceKind) ? f.cssText : f.markup;
    const kind = CSS_SOURCE_KINDS.has(f.sourceKind) ? 'css' : 'html';
    let banFindings;
    try {
      banFindings = scanContentForAbsoluteBans(raw, f.path, kind);
    } catch (err) {
      // A scanner that throws on one file makes this lens unable to certify - it does not
      // make that file ban-free.
      record.findings = findings.length;
      record.reason = `ban scan threw on ${f.path}: ${err && err.message ? err.message : String(err)}`;
      return { record, findings };
    }
    for (const b of banFindings) {
      findings.push({
        rule: `ban.${b.banName}`,
        severity: banSeverity(b.banName, b.severity),
        lens: 'static-ban',
        location: `${b.file}:${b.line ?? '?'}`,
        // A named ban is always a PRESENCE finding: the banned construct is at this line.
        locationKind: b.line === undefined ? undefined : 'defect',
        detail: b.rewriteOptions.length ? `${b.reason} Rewrites: ${b.rewriteOptions.join('; ')}` : b.reason,
      });
    }
  }
  if (collected.files.length === 0) {
    record.reason = `no scannable source collected from ${readRaw} (${scannedBanLabel()} could not be checked)`;
  } else if (gaps.length > 0) {
    record.reason = `${gaps.length} file(s) discovered but not read: ${gaps.map((g) => `${g.path} (${g.reason || g.outcome})`).join(', ')}`;
  } else {
    record.available = true;
  }
  record.findings = findings.length;
  return { record, findings };
}

// ---------------------------------------------------------------------------
// static-check lens: the product rule registry, via each validator's own clean policy.
// ---------------------------------------------------------------------------
async function runStaticCheckLens(context) {
  const record = lens(true);
  const findings = [];
  const gaps = [];
  const registrations = VALIDATOR_REGISTRATIONS.filter((v) => typeof v.validateProduct === 'function');
  if (registrations.length === 0) {
    record.reason = 'no product validators are registered';
    return { record, findings };
  }
  for (const reg of registrations) {
    let result;
    try {
      result = await reg.validateProduct(context);
    } catch (err) {
      gaps.push(`${reg.validatorId}: threw (${err && err.message ? err.message : String(err)})`);
      continue;
    }
    // The validator's OWN evaluateCleanPolicy verdict decides whether it measured this
    // target. 'inconclusive'/'error' is a gap; 'clean'/'findings' means it really ran.
    if (result.status === 'inconclusive' || result.status === 'error') {
      const why = result.status === 'error'
        ? `${result.normalizedErrorCategory}: ${result.error}`
        : (result.rules.filter((r) => r.status === 'inconclusive').map((r) => r.ruleId).join(', ') || 'no applicable rule measured');
      gaps.push(`${reg.validatorId}: ${result.status} (${why})`);
    }
    const blocking = blockingSeveritiesFor(reg.validatorId);
    for (const f of result.findings) {
      const located = f.evidenceLocations && f.evidenceLocations.length;
      findings.push({
        rule: f.ruleId,
        severity: blocking.has(f.severity) ? 'blocking' : 'warning',
        lens: 'static-check',
        location: located ? f.evidenceLocations.join(', ') : undefined,
        // 'defect' = the offending source is AT this line. 'anchor' = nothing at this line is
        // wrong; it is where the missing rule has to go (an absence finding has no defect
        // line). Carried through so a consumer is never told a fix site is a defect site.
        locationKind: located ? (f.locationKind || 'defect') : undefined,
        detail: f.remediation ? `${f.message} Fix: ${f.remediation}` : f.message,
      });
    }
  }
  record.findings = findings.length;
  if (gaps.length > 0) record.reason = gaps.join(' | ');
  else record.available = true;
  return { record, findings };
}

// ---------------------------------------------------------------------------
// rendered lenses: delegated wholesale to runRenderedAudit.
// ---------------------------------------------------------------------------
async function runRenderedLenses(renderUrl) {
  let audit;
  try {
    audit = await loadRenderedAudit()(renderUrl);
  } catch (err) {
    // runRenderedAudit is fail-closed internally, but a throw escaping it must still land
    // as "these lenses did not run" - never as a lens silently missing from the report.
    const reason = `rendered audit threw: ${err && err.message ? err.message : String(err)}`;
    const dead = { attempted: true, available: false, findings: 0, reason };
    return { renderUrl, objective: { ...dead }, subjective: { ...dead }, findings: [] };
  }
  const findings = audit.findings.map((f) => ({
    rule: f.rule,
    severity: f.severity,
    lens: f.lens,
    selector: f.selector,
    detail: f.detail,
  }));
  const toRecord = (l) => ({ attempted: true, available: l.available, findings: l.findings, reason: l.reason });
  return {
    renderUrl: audit.renderUrl,
    objective: toRecord(audit.lenses.objective),
    subjective: toRecord(audit.lenses.subjective),
    findings,
  };
}

// ---------------------------------------------------------------------------
// Verdict: runRenderedAudit's discipline, generalized over every attempted lens.
// ---------------------------------------------------------------------------
function decideVerdict(lenses, blocking, warning) {
  const attempted = Object.values(lenses).filter((l) => l.attempted);
  if (attempted.length === 0) return 'inconclusive';               // nothing was even tried
  if (!attempted.some((l) => l.available)) return 'inconclusive';  // nothing actually ran
  if (blocking > 0) return 'blocked';
  if (warning > 0) return 'warnings-only';
  if (!attempted.every((l) => l.available)) return 'inconclusive'; // partial scan cannot certify clean
  return 'clean';
}

function exitCodeFor(verdict) {
  if (verdict === 'clean') return EXIT_CLEAN;
  if (verdict === 'inconclusive') return EXIT_INCONCLUSIVE;
  return EXIT_FINDINGS;
}

// Rules whose findings are inherently PER-ELEMENT but read as one page-level defect. A single real page produced
// 35 `low-contrast` lines carrying the identical "2.91:1 (need 4.5:1)" detail, which buries every other finding
// in the summary. Collapse them to one line per (lens, rule) carrying the element COUNT, the number of DISTINCT
// details, and a representative element.
//
// WHY THIS IS A DISPLAY-LAYER COLLAPSE AND NOT A SCANNER CHANGE, unlike tiny-text and nested-cards: those two are
// PAGE-LEVEL judgments (their thresholds are page-wide proportions/counts), so emitting one line per element was
// restating one verdict N times and the fix belongs in the scanner. A low-contrast element, by contrast, is a
// genuinely distinct defect with its own measured ratio, and the per-element findings are what the a11y check
// mapping and evidenceLocations consume. So the evidence stays intact in the scan and the JSON output; only the
// human-readable summary is collapsed.
const PAGE_LEVEL_DISPLAY_RULES = new Set(['low-contrast', 'gray-on-color']);

/**
 * The shared identity of a named absolute ban across the two static lenses.
 *
 * static-ban emits `ban.gradient-text`; the registry rule the anti-pattern validator owns
 * for the same scanner emits `anti-pattern.gradient-text`. Both come from the SAME scanner
 * function in absolute-ban-detector.ts, so at one location they are one defect. Returns null
 * for every other rule, so nothing outside this deliberate overlap can ever be merged.
 */
function banIdentityOf(finding) {
  const m = /^(?:ban|anti-pattern)\.(.+)$/.exec(finding.rule || '');
  if (!m) return null;
  if (finding.lens !== 'static-ban' && finding.lens !== 'static-check') return null;
  return m[1];
}

/**
 * Collapse the static-ban / static-check double report of ONE named ban at ONE location into
 * a single finding that names both lenses.
 *
 * Keeps the static-check finding when present, because that is the registry-owned decision
 * rule whose severity the shipped clean policy actually reads; the static-ban twin's lens is
 * recorded in corroboratedBy. Requires an EXACT location match, so a ban found at two
 * different lines stays two findings, and a finding with NO location is never merged (an
 * unlocated pair cannot be shown to be the same site).
 */
function mergeCorroborated(findings) {
  const keyOf = (f) => {
    const ban = banIdentityOf(f);
    if (!ban || !f.location) return null;
    return `${ban}@${f.location}`;
  };
  const groups = new Map();
  for (const f of findings) {
    const k = keyOf(f);
    if (k === null) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const dropped = new Set();
  const extra = new Map();
  const escalated = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = group.find((f) => f.lens === 'static-check') || group[0];
    const others = group.filter((f) => f !== keep);
    extra.set(keep, [...new Set(others.map((f) => `${f.lens}/${f.rule}`))].sort());
    // The survivor inherits the group's HIGHEST severity. Without this, merging a blocking
    // twin into a warning survivor would drop the blocking count and could flip the verdict
    // from `blocked` to `warnings-only` - a dedupe silently weakening a gate. De-duplication
    // may only ever remove a REPEAT, never a severity.
    if (others.some((f) => f.severity === 'blocking')) escalated.set(keep, 'blocking');
    for (const f of others) dropped.add(f);
  }
  return findings
    .filter((f) => !dropped.has(f))
    .map((f) => {
      if (!extra.has(f)) return f;
      const merged = { ...f, corroboratedBy: extra.get(f) };
      if (escalated.get(f) === 'blocking') merged.severity = 'blocking';
      return merged;
    });
}

function collapseForDisplay(findings) {
  const out = [];
  const groups = new Map();
  for (const f of findings) {
    if (!PAGE_LEVEL_DISPLAY_RULES.has(f.rule)) { out.push(f); continue; }
    const key = `${f.lens}/${f.rule}/${f.severity}`;
    if (!groups.has(key)) groups.set(key, { first: f, count: 0, details: new Set(), index: out.length });
    const g = groups.get(key);
    if (g.count === 0) out.push(null);            // reserve the group's position in finding order
    g.count++;
    if (f.detail) g.details.add(f.detail);
  }
  for (const g of groups.values()) {
    const f = g.first;
    if (g.count === 1) { out[g.index] = f; continue; }
    const distinct = g.details.size;
    const detail = `${g.count} element(s)${distinct ? `, ${distinct} distinct measurement(s)` : ''}`
      + `${f.detail ? ` (e.g. ${f.selector || 'element'} - ${f.detail})` : ''}`;
    out[g.index] = { ...f, detail };
  }
  return out.filter(Boolean);
}

function printSummary(result) {
  const lines = [];
  lines.push(`sidecoach-detect: ${result.target} (${result.targetKind})`);
  if (result.renderUrl) lines.push(`  render: ${result.renderUrl}`);
  for (const [name, l] of Object.entries(result.lenses)) {
    // An unavailable lens may still have produced findings - it just cannot certify
    // ABSENCE of findings. Say "incomplete", not "did not run", when it found something.
    // A lens that was never attempted is called out separately so a two-lens clean is
    // never mistaken for a four-lens clean.
    const state = !l.attempted
      ? `SKIPPED - ${l.reason || 'not attempted'}`
      : l.available
        ? `ran, ${l.findings} finding(s)`
        : `INCOMPLETE (${l.findings} finding(s), cannot certify clean) - ${l.reason || 'no reason reported'}`;
    lines.push(`  lens ${name}: ${state}`);
  }
  for (const f of collapseForDisplay(result.findings)) {
    const where = f.selector || f.location || '(no location)';
    // An anchor is labelled in the human summary. A reader who jumps to an anchor line and
    // finds nothing wrong there has been misled unless the line says so.
    const kind = f.location && f.locationKind === 'anchor' ? ' (fix site)' : '';
    const corroborated = f.corroboratedBy && f.corroboratedBy.length
      ? ` [also seen by: ${f.corroboratedBy.join(', ')}]` : '';
    lines.push(`  [${f.severity}] ${f.lens}/${f.rule} @ ${where}${kind}${corroborated}${f.detail ? ` - ${f.detail}` : ''}`);
  }
  lines.push(`  verdict: ${result.verdict} (blocking ${result.severityCounts.blocking}, warning ${result.severityCounts.warning})`);
  if (result.verdict === 'inconclusive') {
    lines.push('  NOT CLEAN: at least one lens did not run. A scan that did not happen is not a passing scan.');
  }
  const skipped = Object.entries(result.lenses).filter(([, l]) => !l.attempted).map(([name]) => name);
  if (result.verdict === 'clean' && skipped.length > 0) {
    lines.push(`  SCOPE: clean by the lenses that ran. Not covered here: ${skipped.join(', ')}.`);
  }
  console.error(lines.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) { usage(); process.exit(EXIT_USAGE); }

  const findings = [];
  const lenses = {};
  let targetKind;
  let renderUrl = null;
  let skipReason = () => 'not attempted for this target';

  if (looksLikeUrl(args.target)) {
    targetKind = 'url';
    if (!args.render) {
      console.error('sidecoach-detect: --no-render on a URL target leaves nothing to scan.');
      process.exit(EXIT_USAGE);
    }
    const rendered = await runRenderedLenses(args.renderUrl || args.target);
    renderUrl = rendered.renderUrl;
    lenses.objective = rendered.objective;
    lenses.subjective = rendered.subjective;
    findings.push(...rendered.findings);
    skipReason = () => 'target is a URL - there is no local source for the static lenses to read';
  } else {
    const abs = path.resolve(args.target);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch (err) {
      console.error(`sidecoach-detect: cannot read target: ${abs}`);
      console.error(err.message);
      process.exit(EXIT_USAGE);
    }
    targetKind = stat.isDirectory() ? 'directory' : 'file';

    let collected;
    try {
      collected = stat.isDirectory() ? await collectFromPath(abs) : collectFromSingleFile(abs);
    } catch (err) {
      console.error(`sidecoach-detect: collection failed for ${abs}`);
      console.error(err.message);
      process.exit(EXIT_USAGE);
    }

    // A local .html renders as itself; anything else needs an explicit --render-url.
    if (args.render) {
      if (args.renderUrl) renderUrl = normalizeRenderUrl(args.renderUrl);
      else if (targetKind === 'file' && RENDERABLE_EXT.test(abs)) renderUrl = pathToFileURL(abs).href;
    }

    const staticBan = runStaticBanLens(collected, abs);
    lenses['static-ban'] = staticBan.record;
    findings.push(...staticBan.findings);

    // Threading renderUrl into the validator context lets run-validator resolve the
    // registry's rendered-evidence rules for real instead of reporting them inconclusive.
    const staticCheck = await runStaticCheckLens({
      files: collected.files,
      discoveredFiles: collected.discovered,
      renderUrl: renderUrl || undefined,
    });
    lenses['static-check'] = staticCheck.record;
    findings.push(...staticCheck.findings);

    if (renderUrl) {
      const rendered = await runRenderedLenses(renderUrl);
      renderUrl = rendered.renderUrl;
      lenses.objective = rendered.objective;
      lenses.subjective = rendered.subjective;
      findings.push(...rendered.findings);
    } else {
      skipReason = () => (args.render
        ? `no render URL for this ${targetKind} target - pass --render-url to render it`
        : 'rendered lenses disabled with --no-render');
    }
  }

  const reported = recordSkippedLenses(lenses, skipReason);
  // Merge the deliberate static-ban/static-check overlap BEFORE counting, so the severity
  // counts describe DEFECTS rather than reports. The per-lens `findings` counts above stay
  // raw on purpose - they answer "what did this lens see", which is the question that makes
  // an INCOMPLETE lens meaningful; the merged list answers "what is wrong with this target".
  const merged = mergeCorroborated(findings);
  const blocking = merged.filter((f) => f.severity === 'blocking').length;
  const warning = merged.filter((f) => f.severity === 'warning').length;
  const verdict = decideVerdict(reported, blocking, warning);
  const result = {
    target: args.target,
    targetKind,
    renderUrl,
    verdict,
    scanned: Object.values(reported).some((l) => l.available),
    findings: merged,
    severityCounts: { blocking, warning, info: 0 },
    lenses: reported,
    unavailableReasons: Object.entries(reported)
      .filter(([, l]) => l.attempted && !l.available)
      .map(([name, l]) => `${name} lens unavailable: ${l.reason || 'no reason reported'}`),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!args.quiet) printSummary(result);
  process.exit(exitCodeFor(verdict));
}

// The fail-closed verdict rule is the load-bearing logic in this file, so it is exported
// and unit-tested directly rather than only through a subprocess that has to launch a
// browser. Requiring this module must therefore NOT run a scan.
module.exports = { decideVerdict, exitCodeFor, collapseForDisplay, EXIT_CLEAN, EXIT_FINDINGS, EXIT_USAGE, EXIT_INCONCLUSIVE };

if (require.main === module) {
  main().catch((err) => {
    // Everything that fails BEFORE scanning (bad args, unreadable target, failed
    // collection) exits EXIT_USAGE from inside main and never reaches here. So a throw
    // that lands here happened DURING the scan, and the honest class for an interrupted
    // scan is inconclusive - not a usage error, and never a clean exit 0.
    console.error('sidecoach-detect: scan failed before a verdict could be reached');
    console.error(err && err.stack ? err.stack : String(err));
    process.stdout.write(JSON.stringify({
      verdict: 'inconclusive',
      scanned: false,
      findings: [],
      unavailableReasons: [`scan aborted: ${err && err.message ? err.message : String(err)}`],
    }, null, 2) + '\n');
    process.exit(EXIT_INCONCLUSIVE);
  });
}
