// sidecoach/src/__tests__/product-validator-pipeline.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getValidatorRegistration } from '../flow-validation-capabilities';
import { getRuleById } from '../product-rule-registry';
import { CHECKS } from '../validators/checks';
import type { CheckFn } from '../validators/checks';
import { runValidatorForTest } from '../validators/run-validator';
import type { ProductCheckContext, RuleVerdict } from '../validators/check-context';

const mkproj = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'p4a2-pipeline-'));

const file = (p: string, sourceKind: string, cssText: string, markup = ''): ProductCheckContext['files'][number] =>
  ({ path: p, sourceKind, cssText, markup, evidenceKindsPresent: [sourceKind] });

// A context with CSS present but NO reduced-motion media query.
const cssNoReducedMotion = (css: string): ProductCheckContext => ({
  cssText: css, markup: '', files: [file('a.css', 'css', css)],
});
const emptyCtx: ProductCheckContext = { cssText: '', markup: '', files: [] };

async function basics() {
  // 1. validateProduct is ATTACHED to every gating registration
  for (const id of ['polish-standard', 'theming', 'anti-pattern', 'static-a11y']) {
    const reg = getValidatorRegistration(id);
    if (!reg || typeof reg.validateProduct !== 'function') throw new Error(`${id} must have an attached validateProduct`);
  }

  // 2. checkProduct is ATTACHED to every rule and returns a four-status result
  const rm = getRuleById('polish.reduced-motion-respect')!;
  if (typeof rm.checkProduct !== 'function') throw new Error('reduced-motion checkProduct must be attached');

  // 3. evidence PRESENT, feature ABSENT -> FAIL (not the old absence-pass, not inconclusive)
  const failV = rm.checkProduct!(cssNoReducedMotion('.btn { transition: opacity 150ms; }'));
  if (failV.status !== 'fail') throw new Error(`css present without reduced-motion must FAIL, got ${failV.status}`);

  // 4. evidence PRESENT, feature PRESENT -> PASS
  const passV = rm.checkProduct!(cssNoReducedMotion('@media (prefers-reduced-motion: reduce) { * { animation: none; } }'));
  if (passV.status !== 'pass') throw new Error(`reduced-motion present must PASS, got ${passV.status}`);

  // 5. evidence ABSENT (no CSS collected) -> INCONCLUSIVE, never pass
  const incV = rm.checkProduct!(emptyCtx);
  if (incV.status !== 'inconclusive') throw new Error(`no CSS evidence must be INCONCLUSIVE, got ${incV.status}`);
  if (!incV.normalizedErrorCategory) throw new Error('an evidence-gap inconclusive must carry a normalizedErrorCategory');

  // 6. an UNATTACHED rule (missingCheck) is inconclusive, never a false pass. By
  //    Tasks 3-6 every key has a check, so simulate "unattached" by removing the
  //    check for the duration and confirm the registry wrapper falls back to
  //    missingCheck -> inconclusive (then restore exactly).
  const unattached = getRuleById('polish.scale-on-press')!;
  const savedSc = CHECKS['polish/scale-on-press'];
  delete CHECKS['polish/scale-on-press'];
  const unattachedStatus = unattached.checkProduct!(cssNoReducedMotion('.btn{}')).status;
  if (savedSc) CHECKS['polish/scale-on-press'] = savedSc;
  if (unattachedStatus !== 'inconclusive') throw new Error('unattached rule must be inconclusive');

  // 7. a genuinely throwing injected check is CAUGHT -> inconclusive + rule_exception
  const original = CHECKS['polish/reduced-motion-respect'];
  CHECKS['polish/reduced-motion-respect'] = new Proxy(original, { apply() { throw new Error('injected rule explosion'); } });
  const thrown = rm.checkProduct!(cssNoReducedMotion('.btn{}'));
  CHECKS['polish/reduced-motion-respect'] = original;
  if (thrown.status !== 'inconclusive') throw new Error('a thrown check must be caught as inconclusive');
  if (thrown.normalizedErrorCategory !== 'rule_exception') throw new Error('throw must normalize to rule_exception');

  // 8. validateProduct end-to-end on an empty project -> required rules inconclusive -> status inconclusive
  const res = await getValidatorRegistration('polish-standard')!.validateProduct!(emptyCtx);
  if (res.status !== 'inconclusive') throw new Error(`empty project must yield validator status inconclusive, got ${res.status}`);
  if (!res.coverage || !Array.isArray(res.coverage.measuredScope)) throw new Error('coverage must be reproducible even when inconclusive');
  if (res.coverage.measuredScope.includes('polished-motion-respect')) throw new Error('inconclusive rule must not claim measured scope');
  if (!res.coverage.unverifiedScope.includes('polished-motion-respect')) throw new Error('unmeasured registry scope must remain unverified');
}

// Inject a CHECKS override around a (possibly async) body, then restore exactly. The
// body must be AWAITED so the override is still installed while the now-async validator
// runs, and only restored once it resolves.
async function withCheck(key: string, fn: CheckFn, body: () => void | Promise<void>) {
  const had = Object.prototype.hasOwnProperty.call(CHECKS, key);
  const prev = CHECKS[key];
  CHECKS[key] = fn;
  try { await body(); }
  finally { if (had) CHECKS[key] = prev; else delete CHECKS[key]; }
}

async function executionCoverage() {
  const RM = 'polish.reduced-motion-respect';
  const findExec = async (validatorId: string, ctx: unknown, ruleId: string) => {
    const detail = await runValidatorForTest(validatorId, ctx);
    const x = detail.executions.find((e) => e.result.ruleId === ruleId);
    if (!x) throw new Error(`no execution for ${ruleId}`);
    return { detail, x };
  };

  // 1. file-scoped per-file aggregation: good passes, bad fails -> aggregate FAIL,
  //    check called once PER applicable file with one-file contexts.
  {
    let calls = 0;
    const spy: CheckFn = (ctx: ProductCheckContext): RuleVerdict => {
      calls++;
      if (ctx.files.length !== 1) throw new Error('file-scoped rule must run with a one-file context');
      return ctx.cssText.includes('GOODMOTION') ? { status: 'pass', message: 'ok' } : { status: 'fail', message: 'bad', evidenceLocations: [ctx.files[0].path] };
    };
    await withCheck('polish/reduced-motion-respect', spy, async () => {
      const ctx: ProductCheckContext = {
        cssText: '', markup: '',
        files: [file('good.css', 'css', '.g { transition: opacity 1s; } /* GOODMOTION */'), file('bad.css', 'css', '.b { transition: opacity 1s; }')],
      };
      const { x } = await findExec('polish-standard', ctx, RM);
      if (x.result.status !== 'fail') throw new Error(`a fail in one applicable file must not be covered by a pass in another (got ${x.result.status})`);
      if (calls !== 2) throw new Error(`check must run once per applicable file (got ${calls})`);
      const files = x.discoveredApplicableFiles.map((d) => d.file).sort();
      if (JSON.stringify(files) !== JSON.stringify(['bad.css', 'good.css'])) throw new Error(`discoveredApplicableFiles must be exactly both files, got ${JSON.stringify(files)}`);
    });
  }

  // 2. an oversized supported applicable file plus an inspected applicable file ->
  //    required rule INCONCLUSIVE, gap stays in discoveredApplicableFiles, only the
  //    inspected file is in inspectedFiles, coverage.skippedFiles non-empty.
  {
    const spy: CheckFn = (): RuleVerdict => ({ status: 'pass', message: 'ok' });
    await withCheck('polish/reduced-motion-respect', spy, async () => {
      const ctx = {
        cssText: '', markup: '',
        files: [file('a.css', 'css', '.a { transition: opacity 1s; }')],
        discoveredFiles: [
          { path: 'a.css', sourceKind: 'css', outcome: 'inspected' as const },
          { path: 'big.css', sourceKind: 'css', outcome: 'oversized' as const, reason: 'over_2mb' },
        ],
      };
      const { detail, x } = await findExec('polish-standard', ctx, RM);
      if (x.result.status !== 'inconclusive') throw new Error(`an unread applicable gap must make the rule inconclusive, got ${x.result.status}`);
      const disc = x.discoveredApplicableFiles.map((d) => d.file).sort();
      if (JSON.stringify(disc) !== JSON.stringify(['a.css', 'big.css'])) throw new Error('the gap must remain in discoveredApplicableFiles');
      if (JSON.stringify(x.inspectedApplicableFiles) !== JSON.stringify(['a.css'])) throw new Error('only the inspected file may be in inspectedFiles');
      if (detail.runCoverage.skippedFiles.length === 0) throw new Error('coverage.skippedFiles must be non-empty');
    });
  }

  // 3. mixed supported/unsupported project -> unsupportedSourceKinds contains the
  //    matrix-derived unsupported extension kind.
  {
    const ctx = {
      cssText: '', markup: '',
      files: [file('a.css', 'css', '.a { color: red; }')],
      discoveredFiles: [
        { path: 'a.css', sourceKind: 'css', outcome: 'inspected' as const },
        { path: 'notes.md', sourceKind: 'extension:.md', outcome: 'unsupported' as const },
      ],
    };
    const detail = await runValidatorForTest('polish-standard', ctx);
    if (detail.runCoverage.unsupportedSourceKinds.length === 0) throw new Error('unsupportedSourceKinds must be non-empty');
    if (!detail.runCoverage.unsupportedSourceKinds.includes('extension:.md')) throw new Error('unsupportedSourceKinds must contain the matrix-derived unsupported kind');
  }

  // 4. a conclusive covered rule and an inconclusive rule with different registry
  //    scopes -> only the covered scope is measured; the other stays unverified.
  {
    await withCheck('polish/reduced-motion-respect', (): RuleVerdict => ({ status: 'pass', message: 'ok' }), async () => {
      await withCheck('polish/scale-on-press', (): RuleVerdict => ({ status: 'inconclusive', message: 'gap', normalizedErrorCategory: 'unreadable_input' }), async () => {
        const ctx: ProductCheckContext = { cssText: '', markup: '', files: [file('a.css', 'css', '.a { transition: opacity 1s; }')] };
        const detail = await runValidatorForTest('polish-standard', ctx);
        if (!detail.runCoverage.measuredScope.includes('polished-motion-respect')) throw new Error('the covered rule scope must be measured');
        if (detail.runCoverage.measuredScope.includes('polished-press-feedback')) throw new Error('an inconclusive rule scope must not be measured');
        if (!detail.runCoverage.unverifiedScope.includes('polished-press-feedback')) throw new Error('the inconclusive rule scope must remain unverified');
      });
    });
  }

  // 5. a root collection failure -> validator status error + unreadable_input.
  {
    const detail = await runValidatorForTest('polish-standard', { projectPath: '/p4a2/definitely/missing/' + process.pid });
    if (detail.result.status !== 'error') throw new Error(`a root collection failure must be a validator-level error, got ${detail.result.status}`);
    if (detail.result.status === 'error' && detail.result.normalizedErrorCategory !== 'unreadable_input') throw new Error('root failure must normalize to unreadable_input');
  }
}

// Coverage-correctness regressions (Codex review): a compatible inspected file with
// an uncovered/unverifiable target must NOT be silently dropped into a false 'clean'.
async function coverageCorrectness() {
  // P1#1 repro (a): styles.css with `a:focus-visible` + a SEPARATE page.html holding an
  // uncovered <button>. The html is a compatible (partial) css-rule source we cannot
  // verify -> static-a11y must NOT be clean.
  {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'styles.css'), 'a:focus-visible { outline: 2px solid currentColor; }');
    fs.writeFileSync(path.join(dir, 'page.html'), '<main><button type="button">Go</button></main>');
    const res = await getValidatorRegistration('static-a11y')!.validateProduct!({ projectPath: dir });
    if (res.status === 'clean') throw new Error('static-a11y must not be clean: an uncovered <button> lives in an unstyled, compatible html file');
    if (res.status !== 'inconclusive') throw new Error(`expected inconclusive for the uncovered-button project, got ${res.status}`);
  }

  // P1#1 repro (b): clean token CSS + card.tsx (a compatible css-rule source we cannot
  // statically resolve) -> theming must NOT be clean.
  {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'theme.css'), ':root { --c-brand: #c0392b; --radius: 8px; } .btn { border-radius: var(--radius); } .btn:hover { color: var(--c-brand); }');
    fs.writeFileSync(path.join(dir, 'card.tsx'), 'export const Card = () => <div className="rounded-sm rounded-lg" />;');
    const res = await getValidatorRegistration('theming')!.validateProduct!({ projectPath: dir });
    if (res.status === 'clean') throw new Error('theming must not be clean: card.tsx is a compatible css-rule source that cannot be statically verified');
  }

  // P1#2: an unreadable directory subtree could harbor applicable files, so it is an
  // unknown gap for every required static rule -> the validator must NOT be clean.
  if (!(typeof process.getuid === 'function' && process.getuid() === 0)) {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'styles.css'), 'a:focus-visible { outline: 2px solid currentColor; }');
    const sub = path.join(dir, 'components');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'card.css'), '.x { color: red; }');
    fs.chmodSync(sub, 0o000);
    try {
      const res = await getValidatorRegistration('static-a11y')!.validateProduct!({ projectPath: dir });
      if (res.status === 'clean') throw new Error('static-a11y must not be clean with an unreadable subtree that could hold applicable files');
      if (res.status !== 'inconclusive') throw new Error(`unreadable subtree expected inconclusive, got ${res.status}`);
    } finally {
      fs.chmodSync(sub, 0o755);
    }
  }
}

function burn(ms: number): void { const end = Date.now() + ms; while (Date.now() < end) { /* spin to simulate a slow synchronous rule */ } }

// A deliberately slow multi-file validator must NOT block the event loop: it yields
// cooperatively between files/rules so a concurrent timer (the heartbeat) keeps firing,
// and it observes an AbortSignal promptly (mid-run) rather than only after finishing.
async function cooperativeAbort() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4b1-coop-'));
  for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(dir, `s${i}.css`), `.b${i} { transition: opacity 1s; }`);
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 1);
  const ac = new AbortController();
  const key = 'polish/reduced-motion-respect';
  const had = Object.prototype.hasOwnProperty.call(CHECKS, key);
  const prev = CHECKS[key];
  // DETERMINISTIC abort: the check itself aborts on its 2nd execution (no setTimeout race);
  // the next between-file/rule signal check then returns aborted mid-run. The burn keeps the
  // run long enough that the concurrent 1ms timer still fires (proving the yields).
  let checkCalls = 0;
  CHECKS[key] = (_ctx: ProductCheckContext): RuleVerdict => { if (++checkCalls === 2) ac.abort(); burn(4); return { status: 'pass', message: 'ok' }; };
  try {
    const res = await getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: dir }, ac.signal);
    if (res.status !== 'error' || res.normalizedErrorCategory !== 'aborted') throw new Error(`slow validator must abort on signal during the run, got ${res.status}/${(res as any).normalizedErrorCategory}`);
  } finally {
    if (had) CHECKS[key] = prev; else delete CHECKS[key];
    clearInterval(timer);
  }
  if (ticks === 0) throw new Error('a slow validator must yield to the event loop so the heartbeat timer can fire during the run');
}

async function browserPromotion() {
  // static-a11y also requires the STATIC rule a11y.focus-visible. Supply a clean
  // focus-visible CSS file so that required static rule PASSES (covered) - otherwise
  // it is inconclusive and evaluateCleanPolicy short-circuits to inconclusive BEFORE
  // counting the blocking browser-rule fails. With it clean, the two failing blocker
  // browser rules are what drive `findings`, which is exactly what this case verifies.
  const focusCss = 'a:focus-visible { outline: 2px solid currentColor; }';
  const detail = await runValidatorForTest('static-a11y', {
    cssText: focusCss, markup: '',
    files: [{ path: 'a11y.css', sourceKind: 'css', cssText: focusCss, markup: '', evidenceKindsPresent: ['css'] }],
    renderUrl: 'data:text/html,test',
  }, {
    collectBrowserEvidence: async (renderUrl) => ({
      available: true,
      evidence: {
        browserEvidence: { available: true, kinds: ['computed-style', 'dom', 'contrast'], renderUrl: renderUrl! },
        computedStyle: {},
        dom: {
          minHitArea: { checked: 1, failing: 1, smallestWidth: 20, smallestHeight: 20 },
        },
        contrast: { wcagAA: false, ratio: 1.2 },
      },
    }),
  });
  for (const id of ['a11y.min-hit-area', 'a11y.color-contrast']) {
    if (!detail.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: successful collector must promote browser rule`);
    const x = detail.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'fail' || !x.sufficientlyCovered) throw new Error(`${id}: promoted browser rule must fail with real coverage`);
  }
  if (detail.result.status !== 'findings') throw new Error(`blocking browser failures must yield findings, got ${detail.result.status}`);

  const polish = await runValidatorForTest('polish-standard', {
    cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test',
  }, {
    collectBrowserEvidence: async (renderUrl) => ({
      available: true,
      evidence: {
        browserEvidence: { available: true, kinds: ['computed-style', 'dom', 'contrast'], renderUrl: renderUrl! },
        computedStyle: {
          'concentric.checkedPairs': '1',
          'concentric.failingPairs': '0',
          'typography.checkedElements': '1',
          'typography.invalidLineHeightElements': '0',
        },
        dom: { minHitArea: { checked: 1, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
        contrast: { wcagAA: true, ratio: 7 },
      },
    }),
  });
  for (const id of ['polish.concentric-radius', 'polish.typography-rhythm']) {
    if (!polish.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: successful collector must promote browser rule`);
    const x = polish.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'pass' || !x.sufficientlyCovered) throw new Error(`${id}: promoted browser rule must pass with real coverage`);
  }
  const genericity = polish.executions.find((e) => e.result.ruleId === 'polish.anti-pattern-genericity');
  if (!genericity || genericity.result.status !== 'inconclusive') throw new Error('genericity must stay inconclusive with successful collector');
  if (polish.activePolicy.requiredRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must not be promoted');
}

async function run() {
  await basics();
  await executionCoverage();
  await coverageCorrectness();
  await cooperativeAbort();
  await browserPromotion();

  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4a2-empty-'));
  // (1) async contract: validateProduct returns a Promise now
  const pending = getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: emptyDir });
  if (typeof (pending as any).then !== 'function') throw new Error('validateProduct must be async (returns a Promise)');
  await pending;

  // (2) an already-aborted signal yields a validator-level error, category 'aborted'
  const ac = new AbortController();
  ac.abort();
  const aborted = await getValidatorRegistration('polish-standard')!.validateProduct!({ projectPath: emptyDir }, ac.signal);
  if (aborted.status !== 'error' || aborted.normalizedErrorCategory !== 'aborted') throw new Error('aborted signal must yield status error / category aborted');

  console.log('product-validator-pipeline: OK');
}
run();
