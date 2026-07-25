#!/usr/bin/env node

/**
 * Sidecoach Drift - token GOVERNANCE against a committed DESIGN.md baseline.
 *
 * A project silently accretes off-system tokens over time: a `--c-brand-red-hover` here, a
 * `--r-tiny` there, none of them sanctioned by the design system. This command reads the project's
 * committed DESIGN.md (the source of truth for what tokens are allowed) and every custom property the
 * project actually defines (in `.css` files and inline `<style>` blocks), and reports the ones that
 * have DRIFTED - a typed custom property whose VALUE is not covered by any DESIGN.md token in its
 * category (color / radius / spacing / easing / duration).
 *
 * This is the differentiator: the detection is a comparison against a KNOWN, persistent baseline, not
 * an isolated in-the-moment page read. A tool with no design-system memory can tell you a page looks
 * fine today; it cannot tell you the project is accreting a fourth shade of red that nobody approved.
 *
 * The report is ACTIONABLE: every drifted token is named WITH its value and the file(s) it was defined
 * in, so the fix ("add it to DESIGN.md or refactor to an existing token") is a mechanical next step.
 *
 * FAIL-CLOSED (the load-bearing property):
 *   The one verdict this tool must never emit falsely is "no drift". "No drift" is a claim that the
 *   project is clean against its baseline; it is only honest when a real baseline was read AND real
 *   tokens were scanned. So:
 *     - no DESIGN.md, or a DESIGN.md with no parseable token frontmatter, or a DESIGN.md that declares
 *       zero governed (color/radius/spacing/motion) tokens -> "cannot assess" (inconclusive), never clean.
 *     - no CSS/`<style>` to scan, or CSS that declares no custom properties at all -> "cannot assess".
 *   A check that could not run is never reported as a check that passed.
 *
 * OUTPUT
 *   default        human-readable governance report. clean/drift -> stdout; cannot-assess -> stderr.
 *   --json         exactly one JSON object on stdout (verdict + drifted[] + counts), nothing else.
 *   --quiet        suppress the human report (exit code still carries the verdict). Ignored with --json.
 *
 * Exit codes (one per outcome class; nonzero always means "not a clean, complete assessment"):
 *   0 = clean         a real baseline + real tokens were compared and ZERO drift was found
 *   1 = drift         one or more off-system tokens found; each named with value + file
 *   2 = usage / IO    the run never started (bad args, project dir missing, dist not built)
 *   3 = inconclusive  cannot assess - the baseline or the tokens were missing; NEVER emitted as clean
 *
 * KNOWN SCOPE BOUNDARY: custom-property NAMES that use CSS identifier ESCAPES (e.g. `--c-\78`) are not
 * assessed. The shipped detector matches names as `--[\w-]+`, so an escaped name is not a token it can
 * categorize; such declarations are spec-legal but effectively unused in design systems. This is a
 * documented limitation of the frozen engine, not a silent gap - conventional (unescaped) custom
 * properties, which is every real design token, are fully covered.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXIT_CLEAN = 0;
const EXIT_DRIFT = 1;
const EXIT_USAGE = 2;
const EXIT_INCONCLUSIVE = 3;

// ---- load the shipped engines from the committed build --------------------------------------------
// The pure detector and the DESIGN.md parser both live in dist/. Loading the built copies means this
// CLI runs the exact same categorization logic the rest of the suite verifies.
let detectTokenDrift;
let parseDesignMd;
try {
  ({ detectTokenDrift } = require('../dist/project-drift-detector'));
  ({ parseDesignMd } = require('../dist/design-md-parser'));
} catch (err) {
  console.error('sidecoach-drift: failed to load ../dist. Run `npm run build` in sidecoach/ first.');
  console.error(err && err.message ? err.message : String(err));
  process.exit(EXIT_USAGE);
}

// Directories that never hold a project's own authored tokens - skip them so a big node_modules does
// not turn a single-pass scan into a directory crawl.
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache', '.claude', 'vendor']);

// The five governed namespaces, mirroring the detector's own name predicates. Used ONLY to count how
// many scanned properties fall inside vs outside governance - the drift verdict itself comes from the
// detector, never from these.
const GOVERNED_PREFIX = /^--c-|^--color|^--r-|^--radius|^--rounded|^--s-|^--space|^--spacing|^--ease|^--d-|^--duration/;

const CATEGORY_FIELDS = [
  ['newColorTokens', 'color'],
  ['newRadiusTokens', 'radius'],
  ['newSpacingTokens', 'spacing'],
  ['newEasingTokens', 'easing'],
  ['newDurationTokens', 'duration'],
];

function usage() {
  console.error('Usage: sidecoach-drift <project-dir> [options]');
  console.error('       sidecoach-drift --design <DESIGN.md> --css <file> [--css <file> ...]');
  console.error('');
  console.error('Reports custom-property tokens that have DRIFTED from the project DESIGN.md baseline -');
  console.error('off-system colors / radii / spacings / easings / durations - each named with its value');
  console.error('and the file it was defined in.');
  console.error('');
  console.error('Arguments:');
  console.error('  <project-dir>      a project directory; DESIGN.md and CSS are discovered inside it');
  console.error('');
  console.error('Options:');
  console.error('  --design <file>    use this DESIGN.md instead of <project-dir>/DESIGN.md');
  console.error('  --css <file>       scan this CSS/HTML file (repeatable); disables directory discovery');
  console.error('  --json             emit one JSON object on stdout (verdict, drifted[], counts)');
  console.error('  --quiet            suppress the human report (exit code carries the verdict)');
  console.error('  -h, --help         show this help');
  console.error('');
  console.error('Exit: 0 no drift, 1 drift found, 2 usage/IO, 3 cannot assess (no baseline / nothing scanned).');
  console.error('"Cannot assess" is NEVER reported as "no drift": a missing baseline fails closed.');
}

function parseArgs(argv) {
  const args = { project: null, design: null, css: [], json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(EXIT_CLEAN); }
    else if (a === '--json') args.json = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--design') {
      const v = argv[++i];
      if (!v || v.startsWith('-')) { console.error('sidecoach-drift: --design needs a file path value'); usage(); process.exit(EXIT_USAGE); }
      args.design = v;
    } else if (a === '--css') {
      const v = argv[++i];
      if (!v || v.startsWith('-')) { console.error('sidecoach-drift: --css needs a file path value'); usage(); process.exit(EXIT_USAGE); }
      args.css.push(v);
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-drift: unknown option "${a}"`); usage(); process.exit(EXIT_USAGE);
    } else if (args.project === null) {
      args.project = a; // positional project dir
    } else {
      console.error(`sidecoach-drift: unexpected extra argument "${a}"`); usage(); process.exit(EXIT_USAGE);
    }
  }
  return args;
}

/**
 * Extract the inner CSS of every <style>...</style> block in an HTML document. A project may inline its
 * tokens rather than link a stylesheet; without this the scan would silently miss them.
 */
function extractStyleBlocks(html) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/**
 * One pass over a CSS string -> a name->value map of every custom-property DEFINITION (last write wins,
 * matching the detector's own `propValues` semantics). This is how the CLI recovers the VALUE of a
 * drifted token for display: the detector reports drifted NAMES; the value comes from this same-pass map
 * via an O(1) lookup, never a re-scan of the CSS per token.
 */
function buildValueMap(css) {
  const map = new Map();
  const re = /(--[\w-]+)\s*:\s*([^;]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) map.set(m[1], m[2].trim());
  return map;
}

/**
 * Every custom-property DECLARATION in the CSS, preserving DUPLICATES (one `{name, value}` per
 * declaration, trimmed). Unlike `buildValueMap` (name-keyed, last-write-wins), this keeps a token that
 * is defined more than once with different values - the exact case a theme/state override creates
 * (`:root{--c-x: sanctioned}` and `[data-theme]{--c-x: off-system}`). The detector's own scan is
 * last-wins by name, so a whole-source scan would check only ONE value per name and could MASK a drifted
 * override behind a sanctioned definition. Checking every DISTINCT declaration closes that false-clean.
 */
function collectDeclarations(css) {
  const out = [];
  const re = /(--[\w-]+)\s*:\s*([^;]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    // A real declaration begins at a DECLARATION boundary - the previous non-whitespace character is `{`,
    // `;`, or `}`. A `--name:` sequence whose predecessor is `(` (or anything else) is declaration-shaped
    // text INSIDE a function value (`foo(--c-x:#000)`), not a declaration, and must not be counted.
    let j = m.index - 1;
    while (j >= 0 && /\s/.test(css[j])) j--;
    const prev = j >= 0 ? css[j] : '{'; // start-of-source counts as a boundary
    if (prev === '{' || prev === ';' || prev === '}') out.push({ name: m[1], value: m[2].trim() });
  }
  return out;
}

/**
 * Normalize a value for whitespace-INSENSITIVE comparison WITHOUT collapsing values that use whitespace
 * as a significant separator. Legacy syntax separates with commas (`rgba(26, 31, 27, 0.16)`); modern
 * syntax separates with spaces (`rgb(26 31 27)`, `oklch(0.7 0.1 20)`, box-shadow lists). Deleting ALL
 * whitespace would collapse `rgb(1 23 4)` and `rgb(12 3 4)` to the same string and MISS real drift, so
 * instead: trim, collapse runs of whitespace to a single space, then drop spaces adjacent to `(`, `)`,
 * and `,`. That makes comma-formatting irrelevant while keeping space-separated components distinct.
 */
function normalizeValueWs(v) {
  return String(v)
    .trim()
    .replace(/\s*!\s*important\s*$/i, '') // `!important` is declaration PRIORITY, not part of the value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1');
}

/**
 * Preprocess a CSS source before it is scanned, fixing two things that would otherwise corrupt the
 * value read - for BOTH the value map and the frozen detector's own regex:
 *   1. Strip `/* ... *\/` comments. Without this, a commented-out declaration is read as a real
 *      custom property: a file of nothing but `/* --c-x: #fff; *\/` would satisfy the "has custom
 *      properties" gate (a vacuous clean) and a commented drift would be flagged as real.
 *   2. Guarantee a `;` before every `}`. The value regex captures up to the next `;`, so the LAST
 *      declaration in a block with no trailing semicolon (`--c-x: #fff }`) would otherwise capture
 *      `#fff }` and read as drift. Values never legitimately contain `}`, so this is safe.
 */
/**
 * Neutralize the three CSS contexts in which `--name: value`-shaped TEXT is not a real custom-property
 * declaration: comments, string literals, and url() tokens. Independent regexes cannot do this correctly
 * because the contexts interleave - a string may contain `/*`, a comment may contain a quote, a data-URI
 * url() may contain `;` and `--x:`. So this is a single left-to-right pass with explicit state; inside a
 * neutralized span every character is replaced with a space (newlines preserved for stable line math),
 * while the delimiters and ALL top-level structure (`{ } ; :` and real declarations) pass through intact.
 * Escapes and string line-continuations are consumed so an escaped quote never ends a string early.
 * Blanking these bodies is safe: a real custom-property declaration never lives inside a comment/string/url.
 */
function neutralizeCss(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  let state = 'top'; // top | comment | string | url
  let quote = '';
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  while (i < n) {
    const c = css[i];
    const c2 = i + 1 < n ? css[i + 1] : '';
    if (state === 'top') {
      if (c === '/' && c2 === '*') { state = 'comment'; out += '  '; i += 2; continue; }
      if (c === '"' || c === "'") { state = 'string'; quote = c; out += c; i += 1; continue; }
      // url( at an identifier boundary (not blur(, myurl(, ...)); a QUOTED url is handled by the string state.
      const prev = out.length ? out[out.length - 1] : '';
      if ((c === 'u' || c === 'U') && !/[\w-]/.test(prev) && /^url\(/i.test(css.slice(i, i + 4))) {
        out += css.slice(i, i + 4); i += 4; state = 'url'; continue;
      }
      out += c; i += 1; continue;
    }
    if (state === 'comment') {
      if (c === '*' && c2 === '/') { state = 'top'; out += '  '; i += 2; continue; }
      out += blank(c); i += 1; continue;
    }
    if (state === 'string') {
      if (c === '\\') { out += (c2 === '\n' ? ' \n' : '  '); i += 2; continue; } // escape / line-continuation
      if (c === quote) { state = 'top'; out += c; i += 1; continue; }
      out += blank(c); i += 1; continue;
    }
    // state === 'url' (unquoted token): blank until the closing ')'; a quote hands off to the string state.
    if (c === '"' || c === "'") { state = 'string'; quote = c; out += c; i += 1; continue; }
    if (c === ')') { state = 'top'; out += c; i += 1; continue; }
    out += blank(c); i += 1; continue;
  }
  return out;
}

// Neutralize comment/string/url text, THEN guarantee a `;` before every `}` so the last declaration in a
// block is captured to its own terminator, not the brace.
function preprocessCss(css) { return neutralizeCss(css).replace(/;?\s*}/g, ';}'); }

/**
 * Make the VALUE comparison whitespace-insensitive without touching the shipped detector. The detector
 * compares exact value strings, but CSS routinely authors `rgba(26, 31, 27, 0.16)` with spaces after
 * commas while DESIGN.md YAML writes it compact - the same color. Left as-is, a token whose value IS in
 * the baseline would be flagged as drift purely over formatting (a governance false positive that erodes
 * trust).
 *
 * The transform is applied IDENTICALLY to both sides in the CLI: each custom-property value here, and
 * every DESIGN.md token value in `normalizeTokens`. Because the same function runs on both, genuinely
 * different values stay different (no new false negatives) while comma-spacing variants match. Only the
 * value is touched - never across `;`, `{`, `}`, or a newline - so the boundaries the detector relies on
 * are preserved. The DISPLAY value still comes from the original CSS via `buildValueMap`.
 */
function normalizeCssForCompare(css) {
  return css.replace(/(--[\w-]+\s*:\s*)([^;{}\n]+)/g, (_m, decl, val) => decl + normalizeValueWs(val));
}

/** Deep-copy DESIGN.md tokens with every string value whitespace-collapsed (the baseline side of the compare). */
function normalizeTokens(tokens) {
  const walk = (n) => {
    if (typeof n === 'string') return normalizeValueWs(n);
    if (Array.isArray(n)) return n.map(walk);
    if (n && typeof n === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(n)) o[k] = walk(v);
      return o;
    }
    return n;
  };
  return walk(tokens);
}

function isGoverned(name) { return GOVERNED_PREFIX.test(name); }

const SOURCE_EXT = /\.(css|html?|htm)$/i;

/**
 * Discover CSS sources under a project dir: every `.css` file, plus every `<style>` block inside every
 * `.html`/`.htm` file. Symlinked files AND directories are FOLLOWED (a symlinked stylesheet or source
 * dir is real project scope); a realpath `visited` set makes the recursion cycle-safe. Only two things
 * are deliberately out of scope, and neither can hide drift a shipped stylesheet would show: hidden
 * DIRECTORIES (`.git`, `.claude`, ...) and dependency/build dirs (`node_modules`, `dist`, ...). Hidden
 * FILES are still scanned - a `.hidden.css` will not slip drift past the scan.
 *
 * Returns { sources: [{ label, css }], unreadable: [label...] }. `unreadable` records a source-shaped
 * entry (a `.css`/`.html` file, a directory, or a broken source-named symlink) that could NOT be read -
 * this is load-bearing: a scan that silently skipped a stylesheet must not certify "clean" (classify's
 * scanComplete). Deliberate scope exclusions (hidden/dependency dirs) are NOT recorded as unreadable.
 */
function collectSources(root) {
  const out = [];
  const unreadable = [];
  const visited = new Set();
  const walk = (dir) => {
    let real;
    try { real = fs.realpathSync(dir); } catch { unreadable.push(path.relative(root, dir) || '.'); return; }
    if (visited.has(real)) return; // cycle guard (a symlink pointing back up)
    visited.add(real);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { unreadable.push(path.relative(root, dir) || '.'); return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full);
      let isDir = ent.isDirectory();
      let isFile = ent.isFile();
      if (ent.isSymbolicLink()) {
        let st;
        try { st = fs.statSync(full); } catch { if (SOURCE_EXT.test(ent.name)) unreadable.push(rel); continue; }
        isDir = st.isDirectory();
        isFile = st.isFile();
      }
      if (isDir) {
        // Deliberate scope exclusions: hidden infra dirs and dependency/build dirs. NOT recorded as gaps.
        if (ent.name.startsWith('.') || IGNORE_DIRS.has(ent.name)) continue;
        walk(full); // follows symlinked dirs too; `visited` prevents cycles
        continue;
      }
      if (!isFile) continue;
      const lower = ent.name.toLowerCase();
      if (lower.endsWith('.css')) {
        let css; try { css = fs.readFileSync(full, 'utf8'); } catch { unreadable.push(rel); continue; }
        out.push({ label: rel, css });
      } else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        let html; try { html = fs.readFileSync(full, 'utf8'); } catch { unreadable.push(rel); continue; }
        extractStyleBlocks(html).forEach((b, i) => out.push({ label: `${rel} <style#${i + 1}>`, css: b }));
      }
    }
  };
  walk(root);
  return { sources: out, unreadable };
}

/** Flatten every string leaf out of a (possibly nested) color token tree, mirroring the detector. */
function flattenColorLeaves(colors) {
  const out = [];
  const walk = (n) => {
    if (typeof n === 'string') { out.push(n); return; }
    if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v);
  };
  walk(colors);
  return out;
}

/**
 * Count the actual sanctioned VALUES the baseline declares in each governed category, extracted exactly
 * the way the detector reads them (nested color leaves; string values of rounded / spacing.sizes /
 * motion.ease / motion.duration). This is deliberately LEAF-accurate, not a shallow key count: a junk
 * baseline like `colors: { brand: {} }` or `motion: { notes: "x" }` has zero real tokens and must count 0.
 */
function baselineCounts(tokens) {
  const strs = (o) => Object.values(o || {}).filter((s) => typeof s === 'string');
  const spacingSrc = tokens.spacing && tokens.spacing.sizes ? tokens.spacing.sizes : tokens.spacing;
  const motion = tokens.motion || {};
  return {
    color: flattenColorLeaves(tokens.colors).length,
    radius: strs(tokens.rounded).length,
    spacing: strs(spacingSrc).length,
    easing: strs(motion.ease).length,
    duration: strs(motion.duration).length,
  };
}

/** True only when DESIGN.md declares at least one real governed token VALUE to compare against. */
function hasGovernedTokens(tokens) {
  const c = baselineCounts(tokens);
  return (c.color + c.radius + c.spacing + c.easing + c.duration) > 0;
}

/** Which governed category, if any, the detector assigned to `name` in a report. */
function categoryOfName(report, name) {
  for (const [field, category] of CATEGORY_FIELDS) if (report[field].includes(name)) return category;
  return null;
}

/**
 * Compare every CSS source against the baseline tokens and merge the drift.
 *
 * Each source is enumerated ONCE (collectDeclarations, single pass), then every DISTINCT (name, value)
 * declaration is checked against the baseline by handing the detector a synthesized single declaration.
 * This is what makes the scan correct where a whole-source scan is not: the detector (and any name-keyed
 * value map) is last-write-wins, so a token defined twice - the theme/state override case - would have
 * only ONE value checked, masking a drifted override behind a sanctioned definition (a false clean). One
 * detector call per DISTINCT declaration on a tiny synthesized string is not a re-scan of the source, so
 * the "no re-scan per token" performance property holds. Drift entries merge by name+normalized-value,
 * unioning the files each appears in. Returns { drifted, customPropCount, governedCount, ungovernedCount }.
 */
function assessDrift(sources, tokens) {
  const merged = new Map(); // key `name|normalizedLcValue` -> { name, value, category, files:Set }
  const allProps = new Set();
  const normTokens = normalizeTokens(tokens); // baseline side of the whitespace-insensitive compare, once
  const verdictCache = new Map(); // distinct `name|normVal` -> category|null, so a repeated pair costs nothing
  for (const src of sources) {
    const clean = preprocessCss(src.css);
    const seenInSource = new Set();
    for (const { name, value } of collectDeclarations(clean)) {
      allProps.add(name);
      const normVal = normalizeValueWs(value);
      const key = `${name}|${normVal.toLowerCase()}`;
      if (seenInSource.has(key)) { const e = merged.get(key); if (e) e.files.add(src.label); continue; }
      seenInSource.add(key);
      let category = verdictCache.get(key);
      if (category === undefined) {
        // Check this ONE declaration in isolation (a `;` terminator so the detector's value capture stops).
        const report = detectTokenDrift(`:root{${name}:${normVal};}`, normTokens);
        category = categoryOfName(report, name);
        verdictCache.set(key, category);
      }
      if (category) {
        let entry = merged.get(key);
        if (!entry) { entry = { name, value, category, files: new Set() }; merged.set(key, entry); }
        entry.files.add(src.label);
      }
    }
  }
  let governedCount = 0;
  for (const name of allProps) if (isGoverned(name)) governedCount++;
  const drifted = Array.from(merged.values())
    .map((e) => ({ name: e.name, value: e.value, category: e.category, files: Array.from(e.files).sort() }))
    .sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)));
  return {
    drifted,
    customPropCount: allProps.size,
    governedCount,
    ungovernedCount: allProps.size - governedCount,
  };
}

/**
 * The fail-closed decision, pure and exported for the unit test. Given whether each precondition held,
 * resolve the verdict + exit code. "clean" is the strongest claim and requires that a baseline was read,
 * custom properties were scanned, AND the scan was complete; anything short of that is "inconclusive",
 * never "clean". `scanComplete` defaults true so existing callers/tests keep their meaning.
 */
function classify({ hasDesign, hasTokens, hasSources, hasCustomProps, driftCount, scanComplete = true }) {
  if (!hasDesign) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE, reason: 'no DESIGN.md baseline was found' };
  if (!hasTokens) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE, reason: 'DESIGN.md declares no color/radius/spacing/motion tokens to compare against' };
  if (!hasSources) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE, reason: 'no CSS or <style> was found to scan' };
  if (!hasCustomProps) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE, reason: 'the scanned CSS declares no custom properties (--*)' };
  // A real drift finding stands regardless of completeness. But a "no drift" result over an INCOMPLETE
  // scan cannot certify clean - the source we could not read is exactly where missed drift would hide.
  if (driftCount > 0) return { verdict: 'drift', exit: EXIT_DRIFT, reason: null };
  if (!scanComplete) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE, reason: 'one or more CSS sources could not be read, so a clean result cannot be certified' };
  return { verdict: 'clean', exit: EXIT_CLEAN, reason: null };
}

function printReport(target, designPath, outcome, assessment, counts) {
  const lines = [];
  lines.push(`sidecoach-drift: ${target}`);
  lines.push(`  baseline: ${designPath} (${counts.color} color, ${counts.radius} radius, ${counts.spacing} spacing, ${counts.easing} easing, ${counts.duration} duration)`);
  lines.push(`  scanned: ${assessment.customPropCount} custom propert${assessment.customPropCount === 1 ? 'y' : 'ies'} (${assessment.governedCount} governed, ${assessment.ungovernedCount} outside governed namespaces)`);
  if (outcome.verdict === 'drift') {
    lines.push('');
    let lastCat = null;
    for (const d of assessment.drifted) {
      if (d.category !== lastCat) { lines.push(`  ${d.category}:`); lastCat = d.category; }
      lines.push(`    [DRIFT] ${d.name} = ${d.value}   in ${d.files.join(', ')}`);
      lines.push('            not sanctioned by DESIGN.md -> add it to the design system or refactor to an existing token');
    }
    lines.push('');
    lines.push(`  verdict: DRIFT - ${assessment.drifted.length} off-system token(s). Governance action required.`);
  } else {
    lines.push(`  verdict: CLEAN - all ${assessment.governedCount} governed custom propert${assessment.governedCount === 1 ? 'y' : 'ies'} match DESIGN.md. No drift.`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function buildJson(target, designPath, outcome, assessment, counts, unreadable) {
  return {
    tool: 'sidecoach-drift',
    target,
    verdict: outcome.verdict,
    assessed: outcome.verdict === 'clean' || outcome.verdict === 'drift',
    design: designPath,
    reason: outcome.reason,
    scanComplete: (unreadable || []).length === 0,
    unreadableSources: unreadable || [],
    baselineTokenCounts: counts,
    customPropertyCount: assessment ? assessment.customPropCount : 0,
    governedCount: assessment ? assessment.governedCount : 0,
    ungovernedCount: assessment ? assessment.ungovernedCount : 0,
    driftCount: assessment ? assessment.drifted.length : 0,
    drifted: assessment ? assessment.drifted : [],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.project && !args.design && args.css.length === 0) {
    console.error('sidecoach-drift: a <project-dir> (or --design + --css) is required');
    usage();
    process.exit(EXIT_USAGE);
  }

  // ---- resolve target + validate the project dir exists (usage errors happen up front) ----
  const target = args.project ? path.resolve(args.project) : (args.design ? path.dirname(path.resolve(args.design)) : process.cwd());
  if (args.project) {
    let stat;
    try { stat = fs.statSync(target); } catch {
      console.error(`sidecoach-drift: project directory does not exist: ${target}`);
      process.exit(EXIT_USAGE);
    }
    if (!stat.isDirectory()) {
      console.error(`sidecoach-drift: not a directory: ${target}`);
      process.exit(EXIT_USAGE);
    }
  }

  // ---- resolve the DESIGN.md baseline (its absence is inconclusive, not usage: it's the whole point) ----
  let designPath = null;
  if (args.design) {
    const abs = path.resolve(args.design);
    if (fs.existsSync(abs)) designPath = abs;
  } else if (args.project) {
    const candidate = path.join(target, 'DESIGN.md');
    if (fs.existsSync(candidate)) designPath = candidate;
  }

  let tokens = null;
  let hasTokens = false;
  if (designPath) {
    let src;
    try { src = fs.readFileSync(designPath, 'utf8'); } catch { designPath = null; }
    if (designPath) {
      try { tokens = parseDesignMd(src); hasTokens = hasGovernedTokens(tokens); }
      catch { tokens = null; hasTokens = false; } // unparseable frontmatter -> no usable baseline
    }
  }

  // ---- collect the CSS sources (tracking any that could not be read: an incomplete scan can't be clean) ----
  let sources = [];
  let unreadable = [];
  if (args.css.length > 0) {
    for (const file of args.css) {
      const abs = path.resolve(file);
      let content;
      try { content = fs.readFileSync(abs, 'utf8'); } catch {
        // An EXPLICITLY named --css file that cannot be read is a usage error, not a silent skip.
        console.error(`sidecoach-drift: cannot read --css file: ${abs}`);
        process.exit(EXIT_USAGE);
      }
      const rel = args.project ? path.relative(target, abs) : path.basename(abs);
      if (abs.toLowerCase().endsWith('.html') || abs.toLowerCase().endsWith('.htm')) {
        extractStyleBlocks(content).forEach((b, i) => sources.push({ label: `${rel} <style#${i + 1}>`, css: b }));
      } else {
        sources.push({ label: rel, css: content });
      }
    }
  } else if (args.project) {
    const collected = collectSources(target);
    sources = collected.sources;
    unreadable = collected.unreadable;
  }

  // ---- assess (only meaningful with a real baseline; still computes counts for the report) ----
  const assessment = (tokens && hasTokens) ? assessDrift(sources, tokens) : assessDrift(sources, { colors: {}, rounded: {}, spacing: {}, motion: {} });
  const counts = tokens ? baselineCounts(tokens) : { color: 0, radius: 0, spacing: 0, easing: 0, duration: 0 };

  const outcome = classify({
    hasDesign: !!designPath,
    hasTokens,
    hasSources: sources.length > 0,
    hasCustomProps: assessment.customPropCount > 0,
    driftCount: assessment.drifted.length,
    scanComplete: unreadable.length === 0,
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(buildJson(target, designPath, outcome, (outcome.verdict === 'clean' || outcome.verdict === 'drift') ? assessment : null, counts, unreadable), null, 2) + '\n');
    process.exit(outcome.exit);
  }

  if (outcome.verdict === 'inconclusive') {
    if (!args.quiet) {
      console.error(`sidecoach-drift: CANNOT ASSESS - ${outcome.reason}.`);
      if (unreadable.length > 0) console.error(`  unreadable source(s): ${unreadable.join(', ')}`);
      console.error('  This is NOT "no drift". Nonzero exit (3). A missing baseline or an empty/incomplete scan fails closed.');
    }
    process.exit(outcome.exit);
  }

  if (!args.quiet) printReport(target, designPath, outcome, assessment, counts);
  process.exit(outcome.exit);
}

// Exported for the unit test: the fail-closed classifier, the arg parser, the pure scan helpers, and the
// exit constants are the load-bearing logic and are tested without spawning the process. Requiring this
// module must NOT run the CLI.
module.exports = {
  classify,
  parseArgs,
  extractStyleBlocks,
  buildValueMap,
  collectDeclarations,
  normalizeValueWs,
  normalizeCssForCompare,
  neutralizeCss,
  preprocessCss,
  normalizeTokens,
  assessDrift,
  hasGovernedTokens,
  baselineCounts,
  collectSources,
  isGoverned,
  EXIT_CLEAN,
  EXIT_DRIFT,
  EXIT_USAGE,
  EXIT_INCONCLUSIVE,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // A throw that reaches here happened after arg parsing (IO/scan failures exit earlier). The honest
    // class for an interrupted assessment is inconclusive - never a clean exit 0, never a false "no drift".
    console.error('sidecoach-drift: assessment failed before a verdict could be reached');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_INCONCLUSIVE);
  }
}
