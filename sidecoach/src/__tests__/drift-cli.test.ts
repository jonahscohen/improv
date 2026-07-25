// sidecoach/src/__tests__/drift-cli.test.ts
//
// Contract for bin/sidecoach-drift.js - token GOVERNANCE against a committed DESIGN.md baseline.
//
// The one verdict this tool must never emit falsely is "no drift": a clean report is a claim that a
// real baseline was read AND real tokens were scanned. So the fail-closed decision is unit-tested
// exhaustively here (fast, no spawn), and the outcomes are then exercised end to end through the real
// binary against committed fixtures. Two edge fixtures (no CSS at all, CSS with no custom properties)
// are built in temp dirs so the "cannot assess" gate is proven without shipping near-empty fixtures.
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-drift.js');
const FIX = path.join(SC, 'fixtures', 'drift');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const drift = require(BIN) as {
  classify: (i: { hasDesign: boolean; hasTokens: boolean; hasSources: boolean; hasCustomProps: boolean; driftCount: number; scanComplete?: boolean }) => { verdict: string; exit: number; reason: string | null };
  extractStyleBlocks: (html: string) => string[];
  buildValueMap: (css: string) => Map<string, string>;
  collectDeclarations: (css: string) => Array<{ name: string; value: string }>;
  normalizeValueWs: (v: string) => string;
  normalizeCssForCompare: (css: string) => string;
  neutralizeCss: (css: string) => string;
  preprocessCss: (css: string) => string;
  normalizeTokens: (t: any) => any;
  assessDrift: (sources: Array<{ label: string; css: string }>, tokens: any) => { drifted: Array<{ name: string; value: string; category: string; files: string[] }>; customPropCount: number; governedCount: number; ungovernedCount: number };
  hasGovernedTokens: (t: any) => boolean;
  baselineCounts: (t: any) => { color: number; radius: number; spacing: number; easing: number; duration: number };
  EXIT_CLEAN: number;
  EXIT_DRIFT: number;
  EXIT_USAGE: number;
  EXIT_INCONCLUSIVE: number;
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

interface RunResult { code: number; stdout: string; json: Record<string, any> }

function run(args: string[]): RunResult {
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [BIN, ...args], { encoding: 'utf8', cwd: SC, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    code = typeof err.status === 'number' ? err.status : -1;
    stdout = err.stdout ?? '';
  }
  let json: Record<string, any> = {};
  if (stdout.trim()) {
    try { json = JSON.parse(stdout); } catch { /* non-JSON (default human mode) - leave {} */ }
  }
  return { code, stdout, json };
}

function main(): void {
  // ---------------------------------------------------------------------
  // 1. FAIL-CLOSED verdict rule (pure, no spawn). "clean" is the strongest claim.
  // ---------------------------------------------------------------------
  assert(drift.classify({ hasDesign: false, hasTokens: false, hasSources: true, hasCustomProps: true, driftCount: 0 }).verdict === 'inconclusive', 'no DESIGN.md must be inconclusive, never clean');
  assert(drift.classify({ hasDesign: true, hasTokens: false, hasSources: true, hasCustomProps: true, driftCount: 0 }).verdict === 'inconclusive', 'DESIGN.md with no governed tokens must be inconclusive');
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: false, hasCustomProps: false, driftCount: 0 }).verdict === 'inconclusive', 'no CSS scanned must be inconclusive');
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: false, driftCount: 0 }).verdict === 'inconclusive', 'CSS with no custom properties must be inconclusive');
  // The central invariant: a real baseline + real tokens + zero drift is the ONLY route to clean.
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 0 }).verdict === 'clean', 'baseline + tokens + zero drift is clean');
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 3 }).verdict === 'drift', 'baseline + tokens + drift>0 is drift');

  // ---------------------------------------------------------------------
  // 2. Exit codes: one per class, and NEVER 0 for a non-clean verdict.
  // ---------------------------------------------------------------------
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 0 }).exit === drift.EXIT_CLEAN, 'clean -> 0');
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 1 }).exit === drift.EXIT_DRIFT, 'drift -> findings code');
  assert(drift.classify({ hasDesign: false, hasTokens: false, hasSources: false, hasCustomProps: false, driftCount: 0 }).exit === drift.EXIT_INCONCLUSIVE, 'inconclusive -> its own code');
  assert(drift.EXIT_INCONCLUSIVE !== drift.EXIT_DRIFT && drift.EXIT_DRIFT !== drift.EXIT_USAGE && drift.EXIT_INCONCLUSIVE !== drift.EXIT_CLEAN, 'every outcome class has a distinct exit code');

  // ---------------------------------------------------------------------
  // 3. Pure helpers: <style> extraction, value map, whitespace normalization.
  // ---------------------------------------------------------------------
  const blocks = drift.extractStyleBlocks('<style>:root{--c-a:#111}</style>x<style type="text/css">:root{--c-b:#222}</style>');
  assert(blocks.length === 2, 'extractStyleBlocks finds every <style> block');
  assert(blocks[0].includes('--c-a') && blocks[1].includes('--c-b'), 'extractStyleBlocks returns inner CSS');

  const vmap = drift.buildValueMap(':root{ --c-x: #ABCDEF; --r-y: 4px; }');
  assert(vmap.get('--c-x') === '#ABCDEF' && vmap.get('--r-y') === '4px', 'buildValueMap recovers trimmed original values');

  // Whitespace-insensitive comparison for COMMA-separated values, applied identically to both sides.
  assert(drift.normalizeValueWs('rgba(26, 31, 27, 0.16)') === 'rgba(26,31,27,0.16)', 'normalizeValueWs drops spaces around commas/parens');
  const wsTokens = { colors: { border: { firm: 'rgba(26,31,27,0.16)' } } };
  const wsAssess = drift.assessDrift([{ label: 'a.css', css: ':root{ --c-border-alias: rgba(26, 31, 27, 0.16); }' }], wsTokens);
  assert(wsAssess.drifted.length === 0, 'a value that differs only by comma-spacing is NOT drift (matches the sanctioned value)');
  const genuine = drift.assessDrift([{ label: 'a.css', css: ':root{ --c-off: rgba(26, 31, 27, 0.20); }' }], wsTokens);
  assert(genuine.drifted.length === 1 && genuine.drifted[0].name === '--c-off', 'a genuinely different value IS still flagged');
  // Display value stays the ORIGINAL (spaced), even though the compare is whitespace-insensitive.
  assert(genuine.drifted[0].value === 'rgba(26, 31, 27, 0.20)', 'the reported value is the original CSS spelling');

  // Codex P0: SPACE-separated modern color syntax must NOT collapse - deleting all whitespace would make
  // `rgb(1 23 4)` and `rgb(12 3 4)` the same string and MISS real drift.
  assert(drift.normalizeValueWs('rgb(1 23 4)') === 'rgb(1 23 4)', 'space-separated components keep their single-space boundaries');
  // Codex P2 (round 5): `!important` is declaration priority, not part of the value - stripped before compare.
  assert(drift.normalizeValueWs('#DC2618 !important') === '#DC2618', 'normalizeValueWs strips a trailing !important (case preserved)');
  const impTokens = { colors: { brand: { red: '#DC2618' } } };
  const impAssess = drift.assessDrift([{ label: 'a.css', css: ':root{ --c-brand-red: #DC2618 !important; }' }], impTokens);
  assert(impAssess.drifted.length === 0, 'a sanctioned value carrying !important is NOT drift (false-positive closed)');
  const spaceTokens = { colors: { p: { ok: 'rgb(1 23 4)' } } };
  const spaceGenuine = drift.assessDrift([{ label: 'a.css', css: ':root{ --c-off: rgb(12 3 4); }' }], spaceTokens);
  assert(spaceGenuine.drifted.length === 1, 'a genuinely different space-separated color IS flagged (no whitespace-collapse false negative)');
  const spaceSame = drift.assessDrift([{ label: 'a.css', css: ':root{ --c-ok: rgb(1  23   4); }' }], spaceTokens);
  assert(spaceSame.drifted.length === 0, 'the same space-separated color with different whitespace runs is NOT drift');

  // Codex P0: comment / string / url() bodies are neutralized - custom-property-shaped TEXT inside them
  // is not a real declaration. neutralizeCss is a single pass over interleaving contexts.
  assert(drift.buildValueMap(drift.preprocessCss('/* --c-x: #fff; */')).size === 0, 'a commented-out declaration is not a scanned custom property');
  assert(!drift.neutralizeCss('a/* --c-x:#fff */b').includes('--c-x'), 'neutralizeCss blanks comment bodies');
  // Codex P1: a declaration with no trailing semicolon before } is read correctly (not `#fff }`).
  assert(drift.buildValueMap(drift.preprocessCss(':root{ --c-x: #fff }')).get('--c-x') === '#fff', 'no-semicolon declaration parses the value without the trailing brace');
  // A --* pattern inside a string, or an unquoted url() token, is NOT a declaration.
  assert(drift.collectDeclarations(drift.preprocessCss('.x{content:"--c-brand-red: #DC2618;"}')).length === 0, 'a --* pattern inside a string is not scanned as a declaration');
  assert(drift.collectDeclarations(drift.preprocessCss('.x{background:url(data:text/css,--c-y:#fff;)}')).length === 0, 'a --* pattern inside an unquoted url() is not a declaration');
  // Codex P1 (round 4): declaration-shaped text inside ANY function value is not a declaration - only a
  // `--name:` at a declaration boundary ({ ; }) counts. Closes the whole "inside parens" class.
  assert(drift.collectDeclarations(drift.preprocessCss('.x{background:foo(--c-brand:#000000;)}')).length === 0, 'a --* pattern inside a non-url function value is not a declaration');
  assert(drift.collectDeclarations(drift.preprocessCss(':root{--c-x: rgba(1,2,3,0.5);}')).some((d) => d.name === '--c-x'), 'a real declaration whose VALUE contains parens is still enumerated');
  assert(drift.collectDeclarations(drift.preprocessCss(':root{--c-a:#111;--c-b:#222;}')).length === 2, 'consecutive real declarations are both enumerated (boundary after ;)');
  // Interleaving: a real declaration between strings that contain comment markers, and after a comment
  // that contains a quote, must SURVIVE neutralization (independent regexes would have dropped these).
  assert(drift.collectDeclarations(drift.preprocessCss('a{content:"/*"} :root{--c-real:#111} b{content:"*/"}')).some((d) => d.name === '--c-real'), 'a real declaration between strings holding comment markers survives');
  assert(drift.collectDeclarations(drift.preprocessCss('/* a " b */ :root{--c-real:#222}')).some((d) => d.name === '--c-real'), 'a real declaration after a comment containing a quote survives');

  // Codex P0: baseline validation is LEAF-accurate - a junk baseline has zero real tokens.
  assert(drift.hasGovernedTokens({ colors: { brand: {} }, motion: { notes: 'x' } }) === false, 'a baseline with empty/non-token groups declares no governed tokens');
  assert(drift.hasGovernedTokens({ colors: { brand: { red: '#DC2618' } } }) === true, 'a baseline with a real color leaf declares governed tokens');
  const jc = drift.baselineCounts({ colors: { brand: {} }, motion: { notes: 'x' } });
  assert(jc.color === 0 && jc.easing === 0 && jc.duration === 0, 'baselineCounts counts LEAF values, not shallow keys');

  // scanComplete: a clean-looking result over an INCOMPLETE scan must not classify clean.
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 0, scanComplete: false }).verdict === 'inconclusive', 'an incomplete scan cannot certify clean');
  assert(drift.classify({ hasDesign: true, hasTokens: true, hasSources: true, hasCustomProps: true, driftCount: 2, scanComplete: false }).verdict === 'drift', 'a real drift finding stands even on an incomplete scan');

  // Codex P0 (round 2): a token defined TWICE (theme/state override) must have BOTH values checked - a
  // whole-source last-wins scan would mask a drifted override behind a sanctioned definition (false clean).
  assert(drift.collectDeclarations(':root{--c-x:#111;--c-x:#222;}').length === 2, 'collectDeclarations preserves duplicate declarations');
  const dupTokens = { colors: { brand: { red: '#DC2618' } } };
  const dupA = drift.assessDrift([{ label: 'a.css', css: ':root{--c-x:#BADBAD} .dark{--c-x:#DC2618}' }], dupTokens);
  assert(dupA.drifted.some((d) => d.name === '--c-x' && d.value === '#BADBAD'), 'a drifted value masked by a LATER sanctioned definition is still flagged');
  const dupB = drift.assessDrift([{ label: 'a.css', css: ':root{--c-x:#DC2618} .dark{--c-x:#BADBAD}' }], dupTokens);
  assert(dupB.drifted.some((d) => d.name === '--c-x' && d.value === '#BADBAD'), 'a drifted override AFTER a sanctioned definition is flagged');
  assert(!dupA.drifted.some((d) => d.value === '#DC2618') && !dupB.drifted.some((d) => d.value === '#DC2618'), 'the sanctioned value is never itself flagged');

  // ---------------------------------------------------------------------
  // 4. e2e DRIFT: the drift fixture names all five categories WITH values.
  // ---------------------------------------------------------------------
  const d = run(['fixtures/drift/drift-project', '--json']);
  assert(d.code === drift.EXIT_DRIFT, `drift fixture must exit ${drift.EXIT_DRIFT} (got ${d.code})`);
  assert(d.json.verdict === 'drift' && d.json.assessed === true, `drift fixture verdict should be drift/assessed, got ${JSON.stringify(d.json.verdict)}`);
  assert(d.json.driftCount === 5, `drift fixture should report 5 drifted tokens, got ${d.json.driftCount}`);
  const cats = new Set((d.json.drifted as Array<{ category: string }>).map((x) => x.category));
  for (const c of ['color', 'radius', 'spacing', 'easing', 'duration']) {
    assert(cats.has(c), `drift fixture must surface a ${c} drift`);
  }
  const hover = (d.json.drifted as Array<{ name: string; value: string; files: string[] }>).find((x) => x.name === '--c-brand-red-hover');
  assert(!!hover, 'the planted --c-brand-red-hover drift must be named');
  assert(hover!.value === '#B01F15', `a drifted token must carry its VALUE, got ${hover!.value}`);
  assert(hover!.files.includes('styles.css'), 'a drifted token must carry its source file (where it drifted)');
  // matching tokens and var() references must NOT be flagged.
  const names = (d.json.drifted as Array<{ name: string }>).map((x) => x.name);
  assert(!names.includes('--c-brand-red'), 'a matching token must not be flagged');
  assert(!names.includes('--c-brand-primary'), 'a var() reference must not be flagged');

  // Default (human) mode names the token AND its value on stdout.
  const dHuman = run(['fixtures/drift/drift-project']);
  assert(dHuman.stdout.includes('--c-brand-red-hover') && dHuman.stdout.includes('#B01F15'), 'human report names the drifted token and its value');
  assert(dHuman.stdout.includes('DRIFT'), 'human report states the DRIFT verdict');

  // ---------------------------------------------------------------------
  // 5. e2e CLEAN: the all-matching fixture is clean, exit 0, and it actually scanned tokens.
  // ---------------------------------------------------------------------
  const c = run(['fixtures/drift/clean-project', '--json']);
  assert(c.code === drift.EXIT_CLEAN, `clean fixture must exit 0 (got ${c.code})`);
  assert(c.json.verdict === 'clean' && c.json.assessed === true, `clean fixture must be clean/assessed, got ${JSON.stringify(c.json.verdict)}`);
  assert(c.json.driftCount === 0, 'clean fixture reports zero drift');
  assert(c.json.governedCount > 0, 'a clean verdict must have actually scanned governed tokens (not a vacuous clean)');

  // ---------------------------------------------------------------------
  // 6. e2e FAIL-CLOSED: every "cannot assess" route is inconclusive (exit 3), NEVER clean.
  // ---------------------------------------------------------------------
  const noDesign = run(['fixtures/drift/no-design-project', '--json']);
  assert(noDesign.code === drift.EXIT_INCONCLUSIVE, `no DESIGN.md must exit ${drift.EXIT_INCONCLUSIVE} (got ${noDesign.code})`);
  assert(noDesign.json.verdict === 'inconclusive', `no DESIGN.md must be inconclusive, got ${JSON.stringify(noDesign.json.verdict)}`);
  assert(noDesign.json.verdict !== 'clean', 'no DESIGN.md must NEVER be reported clean');
  assert(noDesign.json.assessed === false, 'no DESIGN.md must report assessed:false');
  assert(typeof noDesign.json.reason === 'string' && noDesign.json.reason.length > 0, 'an inconclusive verdict must say WHY');

  const emptyTokens = run(['fixtures/drift/empty-tokens-project', '--json']);
  assert(emptyTokens.code === drift.EXIT_INCONCLUSIVE, `DESIGN.md with no governed tokens must exit ${drift.EXIT_INCONCLUSIVE} (got ${emptyTokens.code})`);
  assert(emptyTokens.json.verdict === 'inconclusive' && emptyTokens.json.verdict !== 'clean', 'empty-token DESIGN.md must be inconclusive, never clean');

  // Default (human) mode routes the "cannot assess" message and states it is NOT "no drift".
  const noDesignHuman = run(['fixtures/drift/no-design-project']);
  assert(noDesignHuman.code === drift.EXIT_INCONCLUSIVE, 'human-mode no-DESIGN.md still exits inconclusive');
  // Human "cannot assess" goes to stderr, so stdout carries no report the user could misread as clean.
  assert(!/no drift/i.test(noDesignHuman.stdout), 'cannot-assess must never print a "no drift" line');

  // Temp-dir edge: DESIGN.md present but nothing to scan -> inconclusive.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-cli-'));
  try {
    const noCss = path.join(tmp, 'no-css');
    fs.mkdirSync(noCss);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(noCss, 'DESIGN.md'));
    const rNoCss = run([noCss, '--json']);
    assert(rNoCss.code === drift.EXIT_INCONCLUSIVE, `no CSS to scan must exit ${drift.EXIT_INCONCLUSIVE} (got ${rNoCss.code})`);
    assert(rNoCss.json.verdict === 'inconclusive', 'no CSS to scan must be inconclusive, never clean');

    const noProps = path.join(tmp, 'no-props');
    fs.mkdirSync(noProps);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(noProps, 'DESIGN.md'));
    fs.writeFileSync(path.join(noProps, 'styles.css'), '.button { color: red; padding: 8px; }\n');
    const rNoProps = run([noProps, '--json']);
    assert(rNoProps.code === drift.EXIT_INCONCLUSIVE, `CSS with no custom properties must exit ${drift.EXIT_INCONCLUSIVE} (got ${rNoProps.code})`);
    assert(rNoProps.json.verdict === 'inconclusive', 'CSS with no custom properties must be inconclusive, never clean');

    // Codex P0: a file of ONLY commented-out declarations has zero real custom properties -> inconclusive.
    const commentOnly = path.join(tmp, 'comment-only');
    fs.mkdirSync(commentOnly);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(commentOnly, 'DESIGN.md'));
    fs.writeFileSync(path.join(commentOnly, 'styles.css'), '/* :root { --c-brand-red: #DC2618; --c-drift: #badbad; } */\n');
    const rComment = run([commentOnly, '--json']);
    assert(rComment.code === drift.EXIT_INCONCLUSIVE, `comment-only CSS must exit ${drift.EXIT_INCONCLUSIVE} (got ${rComment.code})`);
    assert(rComment.json.verdict === 'inconclusive' && rComment.json.customPropertyCount === 0, 'comment-only CSS has zero real custom properties and cannot be clean');

    // Codex P0: a junk DESIGN.md (non-empty groups but zero real token values) cannot certify clean.
    const junkBase = path.join(tmp, 'junk-baseline');
    fs.mkdirSync(junkBase);
    fs.writeFileSync(path.join(junkBase, 'DESIGN.md'), '---\ncolors:\n  brand: {}\nmotion:\n  notes: "x"\n---\n# junk\n');
    fs.writeFileSync(path.join(junkBase, 'styles.css'), ':root { --c-x: #123456; }\n');
    const rJunk = run([junkBase, '--json']);
    assert(rJunk.code === drift.EXIT_INCONCLUSIVE, `junk baseline must exit ${drift.EXIT_INCONCLUSIVE} (got ${rJunk.code})`);
    assert(rJunk.json.verdict === 'inconclusive' && rJunk.json.verdict !== 'clean', 'a junk baseline must be inconclusive, never clean');

    // Codex P1: a no-semicolon declaration whose value MATCHES the baseline must not be false drift.
    const noSemi = path.join(tmp, 'no-semi');
    fs.mkdirSync(noSemi);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(noSemi, 'DESIGN.md'));
    fs.writeFileSync(path.join(noSemi, 'styles.css'), ':root {\n  --c-brand-red: #DC2618;\n  --r-md: 8px\n}\n');
    const rNoSemi = run([noSemi, '--json']);
    assert(rNoSemi.code === drift.EXIT_CLEAN, `no-semicolon matching declarations must be clean (got ${rNoSemi.code}); drifted=${JSON.stringify(rNoSemi.json.drifted)}`);

    // Codex P0 (round 3): CSS whose ONLY `--*` text is inside a string literal has zero real custom
    // properties -> must fail closed (inconclusive), never a vacuous clean.
    const strOnly = path.join(tmp, 'string-only');
    fs.mkdirSync(strOnly);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(strOnly, 'DESIGN.md'));
    fs.writeFileSync(path.join(strOnly, 'styles.css'), '.doc::before { content: "--c-brand-red: #DC2618; --c-off: #badbad;"; }\n');
    const rStrOnly = run([strOnly, '--json']);
    assert(rStrOnly.code === drift.EXIT_INCONCLUSIVE, `string-literal-only CSS must exit ${drift.EXIT_INCONCLUSIVE} (got ${rStrOnly.code})`);
    assert(rStrOnly.json.verdict === 'inconclusive' && rStrOnly.json.customPropertyCount === 0, 'a --* pattern inside a string is not a real custom property and cannot certify clean');

    // Codex P0: an unreadable CSS source makes the scan INCOMPLETE - a clean-looking result must downgrade
    // to inconclusive, never certify clean over a stylesheet it could not read.
    const unread = path.join(tmp, 'unreadable');
    fs.mkdirSync(unread);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(unread, 'DESIGN.md'));
    fs.copyFileSync(path.join(FIX, 'clean-project', 'styles.css'), path.join(unread, 'clean.css')); // a real, clean, scannable source
    const blocked = path.join(unread, 'secret.css');
    fs.writeFileSync(blocked, ':root { --c-hidden: #010203; }\n');
    fs.chmodSync(blocked, 0o000);
    let unreadRan = false;
    try {
      // Skip on a privileged runner where chmod 000 is still readable (e.g. CI as root).
      let stillReadable = false;
      try { fs.readFileSync(blocked, 'utf8'); stillReadable = true; } catch { /* expected: unreadable */ }
      if (!stillReadable) {
        unreadRan = true;
        const rUnread = run([unread, '--json']);
        assert(rUnread.code === drift.EXIT_INCONCLUSIVE, `an unreadable source must exit ${drift.EXIT_INCONCLUSIVE} (got ${rUnread.code})`);
        assert(rUnread.json.verdict === 'inconclusive' && rUnread.json.scanComplete === false, 'an incomplete scan cannot certify clean');
        assert((rUnread.json.unreadableSources as string[]).some((s) => s.includes('secret.css')), 'the unreadable source must be named');
      }
    } finally {
      fs.chmodSync(blocked, 0o644); // restore so rmSync can clean up
    }
    void unreadRan;

    // Codex P0: a SYMLINKED stylesheet is a real source and must be scanned (drift found through the link).
    const symProj = path.join(tmp, 'symlinked');
    fs.mkdirSync(symProj);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(symProj, 'DESIGN.md'));
    const realTarget = path.join(tmp, 'real-drift.css');
    fs.writeFileSync(realTarget, ':root { --c-off: #abcabc; }\n');
    let symlinkOk = true;
    try { fs.symlinkSync(realTarget, path.join(symProj, 'linked.css')); } catch { symlinkOk = false; }
    if (symlinkOk) {
      const rSym = run([symProj, '--json']);
      assert(rSym.code === drift.EXIT_DRIFT, `a symlinked stylesheet with drift must be scanned and exit ${drift.EXIT_DRIFT} (got ${rSym.code})`);
      assert((rSym.json.drifted as Array<{ name: string }>).some((d) => d.name === '--c-off'), 'drift inside a symlinked stylesheet must be detected');
    }

    // Codex P1 (round 2): a HIDDEN css file is still scanned - drift cannot slip past behind a dot-prefix.
    const hiddenProj = path.join(tmp, 'hidden-file');
    fs.mkdirSync(hiddenProj);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(hiddenProj, 'DESIGN.md'));
    fs.writeFileSync(path.join(hiddenProj, '.hidden.css'), ':root { --c-sneaky: #0f0f0f; }\n');
    const rHidden = run([hiddenProj, '--json']);
    assert(rHidden.code === drift.EXIT_DRIFT, `a hidden .css with drift must be scanned and exit ${drift.EXIT_DRIFT} (got ${rHidden.code})`);
    assert((rHidden.json.drifted as Array<{ name: string }>).some((d) => d.name === '--c-sneaky'), 'drift in a hidden .css must be detected, not silently skipped');

    // Codex P1 (round 2): a symlinked DIRECTORY of sources is followed (its drift is found).
    const symDirProj = path.join(tmp, 'symlinked-dir');
    fs.mkdirSync(symDirProj);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(symDirProj, 'DESIGN.md'));
    const realDir = path.join(tmp, 'shared-styles');
    fs.mkdirSync(realDir);
    fs.writeFileSync(path.join(realDir, 'theme.css'), ':root { --c-linked-dir: #7a7a7a; }\n');
    let symDirOk = true;
    try { fs.symlinkSync(realDir, path.join(symDirProj, 'shared'), 'dir'); } catch { symDirOk = false; }
    if (symDirOk) {
      const rSymDir = run([symDirProj, '--json']);
      assert(rSymDir.code === drift.EXIT_DRIFT, `a symlinked source directory must be followed and exit ${drift.EXIT_DRIFT} (got ${rSymDir.code})`);
      assert((rSymDir.json.drifted as Array<{ name: string }>).some((d) => d.name === '--c-linked-dir'), 'drift inside a symlinked directory must be detected');
    }

    // Cycle safety: a directory symlink pointing back to its own parent must not hang the scan.
    const cycleProj = path.join(tmp, 'cycle');
    fs.mkdirSync(cycleProj);
    fs.copyFileSync(path.join(FIX, 'drift-project', 'DESIGN.md'), path.join(cycleProj, 'DESIGN.md'));
    fs.writeFileSync(path.join(cycleProj, 'styles.css'), ':root { --c-brand-red: #DC2618; }\n'); // sanctioned
    let cycleOk = true;
    try { fs.symlinkSync(cycleProj, path.join(cycleProj, 'loop'), 'dir'); } catch { cycleOk = false; }
    if (cycleOk) {
      const rCycle = run([cycleProj, '--json']); // must terminate (realpath visited-set guard), not spin
      assert(rCycle.code === drift.EXIT_CLEAN, `a self-referential symlink must terminate and still assess (got ${rCycle.code})`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ---------------------------------------------------------------------
  // 7. e2e INLINE <style>: a token defined in an HTML <style> block is scanned, with provenance.
  // ---------------------------------------------------------------------
  const inline = run(['fixtures/drift/inline-project', '--json']);
  assert(inline.code === drift.EXIT_DRIFT, `inline-style fixture must exit ${drift.EXIT_DRIFT} (got ${inline.code})`);
  const lime = (inline.json.drifted as Array<{ name: string; files: string[] }>).find((x) => x.name === '--c-accent-lime');
  assert(!!lime, 'the inline <style> drift must be detected');
  assert(lime!.files.some((f) => f.includes('index.html') && f.includes('<style#1>')), 'inline drift provenance must name the HTML file and its <style> block');

  // ---------------------------------------------------------------------
  // 8. USAGE: a missing project directory is an IO error, not a clean scan of nothing.
  // ---------------------------------------------------------------------
  const missing = run([path.join('fixtures', 'drift', 'does-not-exist'), '--json']);
  assert(missing.code === drift.EXIT_USAGE, `missing dir must exit ${drift.EXIT_USAGE} (got ${missing.code})`);
  assert(missing.stdout.trim() === '', 'a usage error must not emit a result JSON at all');

  const badFlag = run(['fixtures/drift/drift-project', '--design']);
  assert(badFlag.code === drift.EXIT_USAGE, `--design with no value must exit ${drift.EXIT_USAGE} (got ${badFlag.code})`);

  console.log('drift-cli: OK (fail-closed verdict matrix, exit-code classes, whitespace-insensitive compare, e2e drift/clean/inconclusive/usage, inline <style> provenance)');
}

main();
