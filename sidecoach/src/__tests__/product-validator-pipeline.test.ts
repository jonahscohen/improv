// sidecoach/src/__tests__/product-validator-pipeline.test.ts
import { getValidatorRegistration } from '../flow-validation-capabilities';
import { getRuleById } from '../product-rule-registry';
import { CHECKS } from '../validators/checks';
import type { CheckFn } from '../validators/checks';
import { runValidatorForTest } from '../validators/run-validator';
import type { ProductCheckContext, RuleVerdict } from '../validators/check-context';

const file = (p: string, sourceKind: string, cssText: string, markup = ''): ProductCheckContext['files'][number] =>
  ({ path: p, sourceKind, cssText, markup, evidenceKindsPresent: [sourceKind] });

// A context with CSS present but NO reduced-motion media query.
const cssNoReducedMotion = (css: string): ProductCheckContext => ({
  cssText: css, markup: '', files: [file('a.css', 'css', css)],
});
const emptyCtx: ProductCheckContext = { cssText: '', markup: '', files: [] };

function basics() {
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
  const res = getValidatorRegistration('polish-standard')!.validateProduct!(emptyCtx);
  if (res.status !== 'inconclusive') throw new Error(`empty project must yield validator status inconclusive, got ${res.status}`);
  if (!res.coverage || !Array.isArray(res.coverage.measuredScope)) throw new Error('coverage must be reproducible even when inconclusive');
  if (res.coverage.measuredScope.includes('polished-motion-respect')) throw new Error('inconclusive rule must not claim measured scope');
  if (!res.coverage.unverifiedScope.includes('polished-motion-respect')) throw new Error('unmeasured registry scope must remain unverified');
}

// Inject a CHECKS override around a body, then restore exactly.
function withCheck(key: string, fn: CheckFn, body: () => void) {
  const had = Object.prototype.hasOwnProperty.call(CHECKS, key);
  const prev = CHECKS[key];
  CHECKS[key] = fn;
  try { body(); }
  finally { if (had) CHECKS[key] = prev; else delete CHECKS[key]; }
}

function executionCoverage() {
  const RM = 'polish.reduced-motion-respect';
  const findExec = (validatorId: string, ctx: unknown, ruleId: string) => {
    const detail = runValidatorForTest(validatorId, ctx);
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
    withCheck('polish/reduced-motion-respect', spy, () => {
      const ctx: ProductCheckContext = {
        cssText: '', markup: '',
        files: [file('good.css', 'css', '.g { transition: opacity 1s; } /* GOODMOTION */'), file('bad.css', 'css', '.b { transition: opacity 1s; }')],
      };
      const { x } = findExec('polish-standard', ctx, RM);
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
    withCheck('polish/reduced-motion-respect', spy, () => {
      const ctx = {
        cssText: '', markup: '',
        files: [file('a.css', 'css', '.a { transition: opacity 1s; }')],
        discoveredFiles: [
          { path: 'a.css', sourceKind: 'css', outcome: 'inspected' as const },
          { path: 'big.css', sourceKind: 'css', outcome: 'oversized' as const, reason: 'over_2mb' },
        ],
      };
      const { detail, x } = findExec('polish-standard', ctx, RM);
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
    const detail = runValidatorForTest('polish-standard', ctx);
    if (detail.runCoverage.unsupportedSourceKinds.length === 0) throw new Error('unsupportedSourceKinds must be non-empty');
    if (!detail.runCoverage.unsupportedSourceKinds.includes('extension:.md')) throw new Error('unsupportedSourceKinds must contain the matrix-derived unsupported kind');
  }

  // 4. a conclusive covered rule and an inconclusive rule with different registry
  //    scopes -> only the covered scope is measured; the other stays unverified.
  {
    withCheck('polish/reduced-motion-respect', (): RuleVerdict => ({ status: 'pass', message: 'ok' }), () => {
      withCheck('polish/scale-on-press', (): RuleVerdict => ({ status: 'inconclusive', message: 'gap', normalizedErrorCategory: 'unreadable_input' }), () => {
        const ctx: ProductCheckContext = { cssText: '', markup: '', files: [file('a.css', 'css', '.a { transition: opacity 1s; }')] };
        const detail = runValidatorForTest('polish-standard', ctx);
        if (!detail.runCoverage.measuredScope.includes('polished-motion-respect')) throw new Error('the covered rule scope must be measured');
        if (detail.runCoverage.measuredScope.includes('polished-press-feedback')) throw new Error('an inconclusive rule scope must not be measured');
        if (!detail.runCoverage.unverifiedScope.includes('polished-press-feedback')) throw new Error('the inconclusive rule scope must remain unverified');
      });
    });
  }

  // 5. a root collection failure -> validator status error + unreadable_input.
  {
    const detail = runValidatorForTest('polish-standard', { projectPath: '/p4a2/definitely/missing/' + process.pid });
    if (detail.result.status !== 'error') throw new Error(`a root collection failure must be a validator-level error, got ${detail.result.status}`);
    if (detail.result.status === 'error' && detail.result.normalizedErrorCategory !== 'unreadable_input') throw new Error('root failure must normalize to unreadable_input');
  }
}

function run() {
  basics();
  executionCoverage();
  console.log('product-validator-pipeline: OK');
}
run();
