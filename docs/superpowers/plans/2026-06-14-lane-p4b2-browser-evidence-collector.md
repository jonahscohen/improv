# Lane P4b-2 - Browser Evidence Collector - v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Every task is failing-test-first, then real implementation, then exact verification commands, then a commit. Do not batch tasks. Do not weaken a test to make it pass.

## Goal

Add an engine-owned Playwright collector that navigates to an already-running render URL, gathers only the evidence required by four well-defined browser-dependent product rules, and promotes those rules into the active clean policy only for a target whose browser evidence was collected successfully.

The four rules are:

- `polish.concentric-radius`, evidence `computed-style`, severity `minor`
- `polish.typography-rhythm`, evidence `computed-style`, severity `minor`
- `a11y.min-hit-area`, evidence `dom`, severity `blocker`
- `a11y.color-contrast`, evidence `contrast`, severity `blocker`

When no render URL exists, Chromium is unavailable, navigation fails, or collection fails, all four rules remain visible as `inconclusive`, stay non-required for that run, and never throw or fail the lane. Existing static rules and their clean-policy behavior remain unchanged.

`polish.anti-pattern-genericity` is explicitly excluded from P4b-2 by team-lead decision. Leave its registry entry and check semantics exactly as they are today: it remains owned, non-required, and `inconclusive`, including when the collector succeeds for a valid render URL.

## Architecture

`browser-evidence-collector.ts` owns Playwright. It accepts one render URL, launches headless Chromium through Playwright's normal shared-cache lookup, creates a reduced-motion browser context, blocks cross-origin subresource requests, navigates to the supplied URL, and returns a typed evidence bundle. It never starts a server, builds the reviewed project, or runs `playwright install`.

`ProductCheckContext` gains additive `dom`, `browserEvidence`, and `renderUrl` fields. The existing `computedStyle` and `contrast` slots remain in use. `browserEvidence` is the trust marker: check bodies accept browser-shaped fields only when this marker says collection succeeded and names the evidence kind. This preserves the P4a rule that arbitrary caller-provided browser-shaped fields cannot create a false verdict.

Generated validator entries gain `browserRuleIds` and `browserCoverageByScope` for an explicit four-rule browser-backed allowlist. The checked-in generated artifact remains the registry-derived source of truth. At runtime, `run-validator.ts` starts with the generated static `cleanPolicy`, collects browser evidence once, and creates an active per-target policy:

- Successful collection promotes only rules whose browser evidence requirements are present.
- Failed or absent collection promotes no browser rule.
- Browser rule execution always occurs, so unavailable evidence still surfaces as `inconclusive`.
- Browser coverage uses one synthetic inspected target identity, the render URL, with evidence kinds `computed-style`, `dom`, and `contrast`.

The collector reports bounded, deterministic facts:

- Concentric radius: count nested visible rounded parent-child pairs and count pairs that violate `outer radius = inner radius + parent padding`, with a 1px tolerance.
- Typography rhythm: count visible text-bearing elements and count elements whose computed `line-height` is `normal` or invalid.
- Minimum hit area: inspect visible interactive elements; buttons require 44x44, other interactive targets require 40x40.
- Contrast: compute the worst visible direct-text foreground/background contrast ratio and whether every inspected text element meets its WCAG AA threshold.

## Tech Stack

TypeScript, CommonJS, Node.js, Playwright `chromium`, real headless Chromium from `~/Library/Caches/ms-playwright`, the existing registry generator, `ts-node` script tests, and the existing `npm run build && npm test` verification path.

## Critical Context

- Start from `main` on branch `lane-p4b2`.
- The current aggregate engine runner has 47 required suites. This plan adds three suites, so the final expected count is `run-tests: 50 suite(s) passed`. The browser suite itself exits successfully after printing a clear skip message when Chromium cannot launch.
- The shared cache already contains Chromium and headless shell revisions. Playwright must discover them through its normal cache lookup. Do not set a repo-local browser path and do not run `npx playwright install`.
- Install the npm dependency with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --save`.
- The current `npm run build` generates lanes but does not generate validators. This plan updates it to generate validators, run validator `--check`, then compile.
- Browser evidence is per target and per run. Do not persist it in lane checkpoints and do not cache it across runs.
- The lane runner currently passes `{ projectPath, target }` to validators. A URL-shaped `target` is mapped to `renderUrl`. Direct validator callers may pass `renderUrl` explicitly.
- `data:` and `file:` URLs are allowed for hermetic tests. Production normally supplies `http:` or `https:` URLs.
- The collector may load the supplied document and same-origin resources only. It blocks cross-origin subresources.
- `AbortSignal` must be honored before launch, during navigation, and while collecting. Abort maps through the existing validator abort path.
- The four browser-backed checks must trust only `browserEvidence.kinds`. Ad hoc `computedStyle`, `dom`, or `contrast` without that marker remain inconclusive.
- `polish.anti-pattern-genericity` does not faithfully fit the render-URL model because its DOM-based meaning was never defined. Do not collect a genericity signal, change its `checkProduct`, change its registry entry, or promote it into active browser policy.
- Do not touch `sidecoach/mcp-server`, hooks, or spec out-of-scope systems.
- Do not run or mention the separate mcp-server `python_repl` OOM test.
- Every source and plan edit must remain ASCII. Do not introduce Unicode dash code points.
- The worktree contains unrelated dirty `dist` output. Never use `git add dist/`, `git add .`, or `git add -A`.

## File Structure

**Create:**

- `sidecoach/src/validators/browser-evidence-collector.ts` - Playwright launch, navigation, collection, degradation result, and URL helpers.
- `sidecoach/src/__tests__/browser-evidence-rules.test.ts` - four browser-backed rules: trusted evidence pass/fail and absent evidence inconclusive; genericity remains inconclusive even with trusted collected DOM evidence.
- `sidecoach/src/__tests__/browser-evidence-collector.test.ts` - hermetic real-Chromium `data:` fixture, with skip-on-unavailable behavior.
- `sidecoach/src/__tests__/browser-evidence-degradation.test.ts` - no URL and collector failure stay non-required, inconclusive, and non-throwing.

**Modify:**

- `sidecoach/package.json` and `sidecoach/package-lock.json` - add `playwright`; make build generate and check validators.
- `sidecoach/src/validators/check-context.ts` - add typed DOM evidence, trust metadata, and render URL.
- `sidecoach/src/validators/checks/polish-checks.ts` - real trusted-browser verdicts for concentric radius and typography rhythm only; do not change genericity.
- `sidecoach/src/validators/checks/a11y-checks.ts` - real trusted-browser verdicts for two rules.
- `sidecoach/src/validator-generation.ts` - derive browser rule ids and browser coverage separately from static clean policy.
- `sidecoach/scripts/generate-validators.ts` - render the additive generated fields.
- `sidecoach/src/validators.generated.ts` - regenerate.
- `sidecoach/src/validators/run-validator.ts` - collect once, build active policy, execute browser rules with real browser coverage.
- `sidecoach/src/lane-runner.ts` - pass URL-shaped lane targets as `renderUrl`.
- `sidecoach/src/__tests__/generate-validators.test.ts` - assert generated static/browser split.
- `sidecoach/src/__tests__/product-validator-pipeline.test.ts` - assert runtime promotion and browser coverage.
- `sidecoach/src/__tests__/polish-checks.test.ts` and `sidecoach/src/__tests__/a11y-checks.test.ts` - replace P4a ad hoc-only expectations with trusted-evidence coverage while preserving ad hoc rejection.
- `sidecoach/scripts/run-tests.ts` - register three suites.

**Generated dist to commit with an explicit allowlist in the final task:**

- `sidecoach/dist/product-rule-types.{js,js.map,d.ts,d.ts.map}` only if changed by compiler output
- `sidecoach/dist/validator-generation.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators.generated.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators/check-context.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators/browser-evidence-collector.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators/checks/polish-checks.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators/checks/a11y-checks.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/validators/run-validator.{js,js.map,d.ts,d.ts.map}`
- `sidecoach/dist/lane-runner.{js,js.map,d.ts,d.ts.map}`

## Setup

- [ ] **Step 1: Branch from main**

Run:

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main
git checkout -b lane-p4b2
git branch --show-current
```

Expected:

```text
Switched to a new branch 'lane-p4b2'
lane-p4b2
```

- [ ] **Step 2: Record the dirty baseline and establish green**

Run:

```bash
cd /Users/spare3/Documents/Github/improv
git status --porcelain | sort > /tmp/lane-p4b2-preexisting-dirty.txt
cd sidecoach
npm run build
npx ts-node scripts/generate-validators.ts --check
npm test
```

Expected: build exits 0, validator check prints `generate-validators --check: OK (registry valid, manifest present, no drift)`, and the final test line is `run-tests: 47 suite(s) passed`. If baseline verification is red, stop and report it before editing.

- [ ] **Step 3: Install Playwright without downloading browsers**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --save
npm ls playwright
test -d "$HOME/Library/Caches/ms-playwright"
```

Expected: npm exits 0, `npm ls playwright` shows one installed `playwright` version, and the cache check exits 0. Do not run `npx playwright install`.

- [ ] **Step 4: Make validator generation part of build**

Replace the `build` script in `sidecoach/package.json` with:

```json
"build": "ts-node scripts/generate-lanes.ts && ts-node scripts/generate-validators.ts && ts-node scripts/generate-validators.ts --check && tsc"
```

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
```

Expected: output includes `generate-validators: wrote src/validators.generated.ts`, then `generate-validators --check: OK (registry valid, manifest present, no drift)`, and exits 0.

Do not commit setup yet. Task 1 includes the first green commit.

## Task 1: Typed trusted browser evidence and real verdicts for four rules

**Files:** Modify `src/validators/check-context.ts`, `src/validators/checks/polish-checks.ts`, `src/validators/checks/a11y-checks.ts`, `src/__tests__/polish-checks.test.ts`, `src/__tests__/a11y-checks.test.ts`; Create `src/__tests__/browser-evidence-rules.test.ts`; Modify `scripts/run-tests.ts`, `package.json`, `package-lock.json`.

- [ ] **Step 1.1: Write the failing four-rule test**

Create `sidecoach/src/__tests__/browser-evidence-rules.test.ts`:

```ts
import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { EvidenceKind } from '../product-rule-types';
import type { ProductCheckContext } from '../validators/check-context';

const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };
const trusted = (kinds: EvidenceKind[], over: Partial<ProductCheckContext>): ProductCheckContext => ({
  ...empty,
  ...over,
  browserEvidence: { available: true, kinds, renderUrl: 'data:text/html,test' },
});
const status = (key: string, ctx: ProductCheckContext) => {
  const fn = POLISH_CHECKS[key] || A11Y_CHECKS[key];
  if (!fn) throw new Error(`missing check ${key}`);
  return fn(ctx).status;
};

function run() {
  const keys = [
    'polish/concentric-radius',
    'polish/typography-rhythm',
    'a11y/min-hit-area',
    'a11y/color-contrast',
  ];
  for (const key of keys) {
    if (status(key, empty) !== 'inconclusive') throw new Error(`${key}: absent browser evidence must be inconclusive`);
  }

  if (status('polish/concentric-radius', trusted(['computed-style'], {
    computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '0' },
  })) !== 'pass') throw new Error('concentric trusted pass missing');
  if (status('polish/concentric-radius', trusted(['computed-style'], {
    computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '1' },
  })) !== 'fail') throw new Error('concentric trusted fail missing');

  if (status('polish/typography-rhythm', trusted(['computed-style'], {
    computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '0' },
  })) !== 'pass') throw new Error('typography trusted pass missing');
  if (status('polish/typography-rhythm', trusted(['computed-style'], {
    computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '1' },
  })) !== 'fail') throw new Error('typography trusted fail missing');

  if (status('a11y/min-hit-area', trusted(['dom'], {
    dom: { minHitArea: { checked: 2, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
  })) !== 'pass') throw new Error('hit-area trusted pass missing');
  if (status('a11y/min-hit-area', trusted(['dom'], {
    dom: { minHitArea: { checked: 2, failing: 1, smallestWidth: 20, smallestHeight: 20 } },
  })) !== 'fail') throw new Error('hit-area trusted fail missing');

  if (status('a11y/color-contrast', trusted(['contrast'], {
    contrast: { wcagAA: true, ratio: 7 },
  })) !== 'pass') throw new Error('contrast trusted pass missing');
  if (status('a11y/color-contrast', trusted(['contrast'], {
    contrast: { wcagAA: false, ratio: 1.2 },
  })) !== 'fail') throw new Error('contrast trusted fail missing');

  if (status('a11y/color-contrast', { ...empty, contrast: { wcagAA: true, ratio: 7 } }) !== 'inconclusive') {
    throw new Error('ad hoc browser-shaped fields must remain untrusted');
  }
  if (status('polish/anti-pattern-genericity', trusted(['dom'], {
    dom: { minHitArea: { checked: 1, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
  })) !== 'inconclusive') {
    throw new Error('genericity must remain inconclusive when trusted collector DOM evidence is present');
  }
  console.log('browser-evidence-rules: OK');
}
run();
```

- [ ] **Step 1.2: Run it to confirm failure**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-rules.test.ts
```

Expected: TypeScript fails because `browserEvidence` and `dom` do not exist on `ProductCheckContext`.

- [ ] **Step 1.3: Add the evidence contract and trust helpers**

In `sidecoach/src/validators/check-context.ts`, add these interfaces immediately before `ProductCheckContext`:

```ts
export interface BrowserDomEvidence {
  minHitArea: {
    checked: number;
    failing: number;
    smallestWidth: number;
    smallestHeight: number;
  };
}

export interface BrowserEvidenceMeta {
  available: true;
  kinds: EvidenceKind[];
  renderUrl: string;
}
```

Add these fields to `ProductCheckContext`:

```ts
  renderUrl?: string;
  browserEvidence?: BrowserEvidenceMeta;
  dom?: BrowserDomEvidence;
```

Add these helpers after `hasMarkup`:

```ts
export const hasTrustedBrowserEvidence = (ctx: ProductCheckContext, kind: EvidenceKind): boolean =>
  ctx.browserEvidence?.available === true && ctx.browserEvidence.kinds.includes(kind);

export const browserNumber = (ctx: ProductCheckContext, key: string): number | undefined => {
  const raw = ctx.computedStyle?.[key];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};
```

- [ ] **Step 1.4: Replace only the two in-scope P4a Polish browser-only checks**

In `sidecoach/src/validators/checks/polish-checks.ts`, add `browserNumber` and `hasTrustedBrowserEvidence` to the `check-context` import. Replace only `checkConcentricRadius` and `checkTypographyRhythm` with:

```ts
export const checkConcentricRadius = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasTrustedBrowserEvidence(ctx, 'computed-style')) {
    return inconclusive('concentric radius needs trusted computed-style evidence', 'unsupported_runtime');
  }
  const checked = browserNumber(ctx, 'concentric.checkedPairs');
  const failing = browserNumber(ctx, 'concentric.failingPairs');
  if (checked === undefined || failing === undefined) return inconclusive('concentric radius evidence is incomplete', 'unreadable_input');
  if (checked === 0) return notApplicable('no visible nested rounded pair found');
  return failing === 0
    ? pass(`${checked} concentric radius pair(s) satisfy outer = inner + padding`)
    : fail(`${failing}/${checked} concentric radius pair(s) violate outer = inner + padding`, [], 'Set outer radius to inner radius plus parent padding');
};

export const checkTypographyRhythm = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasTrustedBrowserEvidence(ctx, 'computed-style')) {
    return inconclusive('typography rhythm needs trusted computed-style evidence', 'unsupported_runtime');
  }
  const checked = browserNumber(ctx, 'typography.checkedElements');
  const invalid = browserNumber(ctx, 'typography.invalidLineHeightElements');
  if (checked === undefined || invalid === undefined) return inconclusive('typography rhythm evidence is incomplete', 'unreadable_input');
  if (checked === 0) return notApplicable('no visible text-bearing element found');
  return invalid === 0
    ? pass(`${checked} visible text element(s) have resolved line-height`)
    : fail(`${invalid}/${checked} visible text element(s) have invalid line-height`, [], 'Set an explicit usable line-height on visible text');
};

```

Leave `checkGenericity` exactly as it is today. Do not change its registry entry or add any trusted-browser verdict path.

- [ ] **Step 1.5: Replace the two P4a accessibility browser-only checks**

In `sidecoach/src/validators/checks/a11y-checks.ts`, add `hasTrustedBrowserEvidence` to the `check-context` import. Replace the two P4a browser-only functions with:

```ts
export const checkMinHitArea = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasTrustedBrowserEvidence(ctx, 'dom') || !ctx.dom) {
    return inconclusive('hit-area geometry needs trusted DOM evidence', 'unsupported_runtime');
  }
  const hit = ctx.dom.minHitArea;
  if (hit.checked === 0) return notApplicable('no visible interactive element found');
  return hit.failing === 0
    ? pass(`${hit.checked} visible interactive target(s) meet minimum hit area`)
    : fail(`${hit.failing}/${hit.checked} interactive target(s) miss minimum hit area; smallest is ${Math.round(hit.smallestWidth)}x${Math.round(hit.smallestHeight)}px`, [], 'Increase interactive target padding or dimensions to at least 40x40px, and buttons to 44x44px');
};

export const checkColorContrast = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasTrustedBrowserEvidence(ctx, 'contrast') || !ctx.contrast) {
    return inconclusive('contrast ratio needs trusted measured contrast evidence', 'unsupported_runtime');
  }
  return ctx.contrast.wcagAA
    ? pass(`worst measured text contrast is ${ctx.contrast.ratio.toFixed(2)}:1`)
    : fail(`worst measured text contrast is ${ctx.contrast.ratio.toFixed(2)}:1`, [], 'Increase foreground/background contrast to meet WCAG AA');
};
```

- [ ] **Step 1.6: Update existing check tests and register the new suite**

In `polish-checks.test.ts` and `a11y-checks.test.ts`, keep the existing absent-evidence and ad hoc evidence assertions. Remove only assertions for the four in-scope rules that say trusted browser evidence must always remain inconclusive. Keep or add an assertion that `polish.anti-pattern-genericity` remains inconclusive. The new `browser-evidence-rules.test.ts` is the complete evidence-present matrix for the four browser-backed rules and the intentional genericity exclusion.

Add this exact entry after `a11y-checks.test.ts` in `sidecoach/scripts/run-tests.ts`:

```ts
  { rel: 'src/__tests__/browser-evidence-rules.test.ts', required: true },
```

- [ ] **Step 1.7: Verify and commit**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-rules.test.ts
npx ts-node src/__tests__/polish-checks.test.ts
npx ts-node src/__tests__/a11y-checks.test.ts
npm run build && npm test
```

Expected: the three direct suites print `OK`; build exits 0; final aggregate line is `run-tests: 48 suite(s) passed`.

Commit with an explicit source allowlist:

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/package.json sidecoach/package-lock.json \
  sidecoach/src/validators/check-context.ts \
  sidecoach/src/validators/checks/polish-checks.ts \
  sidecoach/src/validators/checks/a11y-checks.ts \
  sidecoach/src/__tests__/browser-evidence-rules.test.ts \
  sidecoach/src/__tests__/polish-checks.test.ts \
  sidecoach/src/__tests__/a11y-checks.test.ts \
  sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4b2): add trusted browser evidence rule verdicts"
```

## Task 2: Hermetic Playwright browser evidence collector

**Files:** Create `src/validators/browser-evidence-collector.ts`, `src/__tests__/browser-evidence-collector.test.ts`; Modify `scripts/run-tests.ts`.

- [ ] **Step 2.1: Write the failing real-browser test**

Create `sidecoach/src/__tests__/browser-evidence-collector.test.ts`:

```ts
import { collectBrowserEvidence } from '../validators/browser-evidence-collector';
import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { ProductCheckContext } from '../validators/check-context';

const html = `<!doctype html>
<style>
  body { color: #111; background: #fff; font-family: sans-serif; line-height: 20px; }
  .outer { border-radius: 12px; padding: 4px; }
  .inner { border-radius: 8px; }
  button { width: 20px; height: 20px; padding: 0; }
  .low { color: #aaa; background: #fff; }
</style>
<main>
  <div class="outer"><div class="inner">Nested text</div></div>
  <button>Go</button>
  <p class="low">Low contrast</p>
</main>`;

async function run() {
  const renderUrl = `data:text/html,${encodeURIComponent(html)}`;
  const result = await collectBrowserEvidence(renderUrl);
  if (!result.available) {
    console.log(`browser-evidence-collector: SKIP (${result.reason})`);
    return;
  }
  const e = result.evidence;
  for (const kind of ['computed-style', 'dom', 'contrast'] as const) {
    if (!e.browserEvidence.kinds.includes(kind)) throw new Error(`collector missing ${kind}`);
  }
  if (Number(e.computedStyle['concentric.checkedPairs']) < 1) throw new Error('no concentric pair collected');
  if (e.dom.minHitArea.failing < 1) throw new Error('small button must fail hit area');
  if (e.contrast.wcagAA) throw new Error('low contrast text must fail WCAG AA');

  const ctx: ProductCheckContext = { cssText: '', markup: '', files: [], renderUrl, ...e };
  if (POLISH_CHECKS['polish/concentric-radius'](ctx).status !== 'pass') throw new Error('concentric rule must reach real pass');
  if (POLISH_CHECKS['polish/anti-pattern-genericity'](ctx).status !== 'inconclusive') throw new Error('genericity must remain inconclusive with collector evidence');
  if (A11Y_CHECKS['a11y/min-hit-area'](ctx).status !== 'fail') throw new Error('hit-area rule must reach real fail');
  if (A11Y_CHECKS['a11y/color-contrast'](ctx).status !== 'fail') throw new Error('contrast rule must reach real fail');
  console.log('browser-evidence-collector: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2.2: Run it to confirm failure**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-collector.test.ts
```

Expected: TypeScript fails because `browser-evidence-collector.ts` does not exist.

- [ ] **Step 2.3: Implement the collector**

Create `sidecoach/src/validators/browser-evidence-collector.ts`:

```ts
import { chromium } from 'playwright';
import type { EvidenceKind } from '../product-rule-types';
import type { BrowserDomEvidence, BrowserEvidenceMeta } from './check-context';

export interface CollectedBrowserEvidence {
  browserEvidence: BrowserEvidenceMeta;
  computedStyle: Record<string, string>;
  dom: BrowserDomEvidence;
  contrast: { wcagAA: boolean; ratio: number };
}

export type BrowserEvidenceCollection =
  | { available: true; evidence: CollectedBrowserEvidence }
  | { available: false; reason: string };

export function renderUrlFromContext(raw: unknown): string | undefined {
  const r = raw as { renderUrl?: unknown; target?: unknown };
  const candidate = typeof r?.renderUrl === 'string' ? r.renderUrl : typeof r?.target === 'string' ? r.target : undefined;
  if (!candidate) return undefined;
  try {
    const u = new URL(candidate);
    return ['http:', 'https:', 'file:', 'data:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const errorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);

export async function collectBrowserEvidence(renderUrl: string | undefined, signal?: AbortSignal): Promise<BrowserEvidenceCollection> {
  if (!renderUrl) return { available: false, reason: 'no render URL in validation context' };
  if (signal?.aborted) return { available: false, reason: 'browser evidence collection aborted before launch' };

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const supplied = new URL(renderUrl);
    await page.route('**/*', async (route) => {
      const requested = new URL(route.request().url());
      const allowed = supplied.protocol === 'data:' || supplied.protocol === 'file:'
        ? requested.protocol === supplied.protocol || requested.protocol === 'data:'
        : requested.origin === supplied.origin || requested.protocol === 'data:';
      if (allowed) await route.continue();
      else await route.abort('blockedbyclient');
    });
    await page.goto(renderUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    if (signal?.aborted) return { available: false, reason: 'browser evidence collection aborted during navigation' };

    const raw = await page.evaluate(() => {
      const visible = (el: Element): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
      };
      const px = (value: string): number => {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : 0;
      };
      const radius = (s: CSSStyleDeclaration): number =>
        Math.max(px(s.borderTopLeftRadius), px(s.borderTopRightRadius), px(s.borderBottomLeftRadius), px(s.borderBottomRightRadius));
      const padding = (s: CSSStyleDeclaration): number =>
        Math.max(px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft));

      let concentricChecked = 0;
      let concentricFailing = 0;
      for (const parent of Array.from(document.querySelectorAll('body *')).filter(visible)) {
        const child = Array.from(parent.children).find(visible);
        if (!child) continue;
        const outer = radius(getComputedStyle(parent));
        const inner = radius(getComputedStyle(child));
        const pad = padding(getComputedStyle(parent));
        if (outer <= 0 || inner <= 0 || pad <= 0) continue;
        concentricChecked++;
        if (Math.abs(outer - (inner + pad)) > 1) concentricFailing++;
      }

      const textElements = Array.from(document.querySelectorAll('body *')).filter((el): el is HTMLElement =>
        visible(el) && Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()));
      const invalidLineHeight = textElements.filter((el) => {
        const line = getComputedStyle(el).lineHeight;
        return line === 'normal' || !Number.isFinite(Number.parseFloat(line)) || Number.parseFloat(line) <= 0;
      }).length;

      const interactive = Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [tabindex]')).filter(visible);
      let hitFailing = 0;
      let smallestWidth = Number.POSITIVE_INFINITY;
      let smallestHeight = Number.POSITIVE_INFINITY;
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        const min = el.tagName === 'BUTTON' ? 44 : 40;
        smallestWidth = Math.min(smallestWidth, r.width);
        smallestHeight = Math.min(smallestHeight, r.height);
        if (r.width < min || r.height < min) hitFailing++;
      }

      const parseColor = (rawColor: string): [number, number, number, number] | undefined => {
        const m = rawColor.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : undefined;
      };
      const blend = (fg: [number, number, number, number], bg: [number, number, number, number]): [number, number, number, number] => {
        const a = fg[3] + bg[3] * (1 - fg[3]);
        if (a === 0) return [255, 255, 255, 1];
        return [
          (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
          (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
          (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
          a,
        ];
      };
      const backgroundFor = (el: HTMLElement): [number, number, number, number] => {
        let bg: [number, number, number, number] = [255, 255, 255, 1];
        const chain: HTMLElement[] = [];
        for (let cur: HTMLElement | null = el; cur; cur = cur.parentElement) chain.unshift(cur);
        for (const cur of chain) {
          const parsed = parseColor(getComputedStyle(cur).backgroundColor);
          if (parsed) bg = blend(parsed, bg);
        }
        return bg;
      };
      const linear = (n: number): number => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const luminance = (c: [number, number, number, number]): number => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
      const ratio = (a: [number, number, number, number], b: [number, number, number, number]): number => {
        const l1 = luminance(a);
        const l2 = luminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      let worstRatio = Number.POSITIVE_INFINITY;
      let allAA = true;
      for (const el of textElements) {
        const style = getComputedStyle(el);
        const fgRaw = parseColor(style.color);
        if (!fgRaw) continue;
        const measured = ratio(blend(fgRaw, backgroundFor(el)), backgroundFor(el));
        const size = px(style.fontSize);
        const weight = Number.parseInt(style.fontWeight, 10) || 400;
        const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        worstRatio = Math.min(worstRatio, measured);
        if (measured < threshold) allAA = false;
      }
      if (!Number.isFinite(worstRatio)) worstRatio = 21;

      return {
        computedStyle: {
          'concentric.checkedPairs': String(concentricChecked),
          'concentric.failingPairs': String(concentricFailing),
          'typography.checkedElements': String(textElements.length),
          'typography.invalidLineHeightElements': String(invalidLineHeight),
        },
        dom: {
          minHitArea: {
            checked: interactive.length,
            failing: hitFailing,
            smallestWidth: Number.isFinite(smallestWidth) ? smallestWidth : 0,
            smallestHeight: Number.isFinite(smallestHeight) ? smallestHeight : 0,
          },
        },
        contrast: { wcagAA: allAA, ratio: worstRatio },
      };
    });

    return {
      available: true,
      evidence: {
        browserEvidence: { available: true, kinds: ['computed-style', 'dom', 'contrast'] as EvidenceKind[], renderUrl },
        computedStyle: raw.computedStyle,
        dom: raw.dom,
        contrast: raw.contrast,
      },
    };
  } catch (e) {
    return { available: false, reason: `browser evidence unavailable: ${errorMessage(e)}` };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
```

- [ ] **Step 2.4: Register the browser suite as required**

Add this exact entry after `browser-evidence-rules.test.ts`:

```ts
  { rel: 'src/__tests__/browser-evidence-collector.test.ts', required: true },
```

The suite is required because its own unavailable-browser branch exits 0 with a clear skip message. Do not make the suite entry optional.

- [ ] **Step 2.5: Verify and commit**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-collector.test.ts
npm run build && npm test
```

Expected on a machine with the shared cache: `browser-evidence-collector: OK`, then final aggregate line `run-tests: 49 suite(s) passed`.

Expected on a machine without launchable Chromium: a line beginning `browser-evidence-collector: SKIP (browser evidence unavailable:`, exit 0, then final aggregate line `run-tests: 49 suite(s) passed`.

Commit:

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/validators/browser-evidence-collector.ts \
  sidecoach/src/__tests__/browser-evidence-collector.test.ts \
  sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4b2): collect hermetic browser evidence with Playwright"
```

## Task 3: Generate browser-policy metadata and keep validator `--check` authoritative

**Files:** Modify `src/validator-generation.ts`, `scripts/generate-validators.ts`, `src/__tests__/generate-validators.test.ts`; Regenerate `src/validators.generated.ts`.

- [ ] **Step 3.1: Add failing generator assertions**

In `sidecoach/src/__tests__/generate-validators.test.ts`, add these assertions after the existing static DOM-only assertions:

```ts
  if (!a11y.browserRuleIds.includes('a11y.min-hit-area')) throw new Error('DOM rule must be generated as a browser rule');
  if (!a11y.browserRuleIds.includes('a11y.color-contrast')) throw new Error('contrast rule must be generated as a browser rule');
  if (a11y.browserCoverageByScope.find((c: any) => c.ruleId === 'a11y.min-hit-area')?.evidenceAlternativesByRequirement[0][0] !== 'dom') {
    throw new Error('DOM browser coverage must use the dom evidence kind');
  }
  if (pol.browserRuleIds.sort().join(',') !== [
    'polish.concentric-radius',
    'polish.typography-rhythm',
  ].sort().join(',')) throw new Error('polish browser rule split drifted');
  if (!pol.ownedRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must remain owned');
  if (pol.browserRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must remain excluded from browser policy');
  if (pol.cleanPolicy.requiredRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must remain non-required');
```

- [ ] **Step 3.2: Run it to confirm failure**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/generate-validators.test.ts
```

Expected: TypeScript or runtime failure because generated validators have no `browserRuleIds` or `browserCoverageByScope`.

- [ ] **Step 3.3: Extend pure generation**

In `sidecoach/src/validator-generation.ts`, extend `GeneratedValidator`:

```ts
  browserRuleIds: string[];
  browserCoverageByScope: RequiredCoverageRecord[];
```

Add this explicit P4b-2 allowlist near `BLOCKING`:

```ts
export const BROWSER_BACKED_RULE_IDS = new Set([
  'a11y.min-hit-area',
  'a11y.color-contrast',
  'polish.concentric-radius',
  'polish.typography-rhythm',
]);
```

Add this function after `coverageRecord`:

```ts
function browserCoverageRecord(r: ProductRuleDefinition): RequiredCoverageRecord {
  return {
    ruleId: r.ruleId,
    scope: r.scope,
    evidenceAlternativesByRequirement: r.evidenceRequirements.map((e) => [e]),
    requireAllDiscoveredApplicableFiles: deriveRequireAll(r),
  };
}
```

In `deriveValidator`, add:

```ts
  const browserRequired = owned.filter((r) => BROWSER_BACKED_RULE_IDS.has(r.ruleId));
```

Add these properties to the returned object:

```ts
    browserRuleIds: browserRequired.map((r) => r.ruleId),
    browserCoverageByScope: browserRequired.map(browserCoverageRecord),
```

Do not add browser rules to generated `cleanPolicy.requiredRuleIds`. That static policy remains the safe absent-browser baseline. Do not infer browser satisfiability from every non-static evidence requirement: genericity also declares `dom`, but it is deliberately not in `BROWSER_BACKED_RULE_IDS`.

Extend `validateRegistry` with an optional browser-backed rule-id argument, defaulting to empty for existing isolated negative fixtures. Make `scripts/generate-validators.ts` pass `BROWSER_BACKED_RULE_IDS` into real-registry validation so `--check` rejects a missing allowlisted browser rule, an allowlisted rule that is statically satisfiable, or an allowlisted rule whose declared evidence is not one of the collector-produced kinds. Add focused negative fixtures that pass a small browser allowlist explicitly and prove each rejection. Do not reject non-static owned rules merely because they are excluded from the allowlist. This keeps untouched `polish.anti-pattern-genericity` valid as owned, non-required, and inconclusive.

- [ ] **Step 3.4: Extend the generator renderer**

In `sidecoach/scripts/generate-validators.ts`, replace the generated interface string with:

```ts
    `export interface GeneratedValidator { validatorId: string; ownedRuleIds: string[]; registryScope: string[]; supportedSourceKinds: SourceKindSupport[]; browserRuleIds: string[]; browserCoverageByScope: import('./product-rule-types').RequiredCoverageRecord[]; cleanPolicy: CleanPolicy; }\n` +
```

- [ ] **Step 3.5: Regenerate and prove check consistency**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node scripts/generate-validators.ts
npx ts-node scripts/generate-validators.ts --check
npx ts-node src/__tests__/generate-validators.test.ts
npm run build && npm test
```

Expected: generator writes `src/validators.generated.ts`; `--check` prints OK with the untouched genericity registry entry; generator suite prints `generate-validators: OK`; final aggregate line is `run-tests: 49 suite(s) passed`.

Commit:

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/validator-generation.ts \
  sidecoach/scripts/generate-validators.ts \
  sidecoach/src/validators.generated.ts \
  sidecoach/src/__tests__/generate-validators.test.ts
git commit -m "feat(lane-p4b2): generate conditional browser rule policy metadata"
```

## Task 4: Invoke the collector, promote browser rules per target, and degrade cleanly

**Files:** Modify `src/validators/run-validator.ts`, `src/lane-runner.ts`, `src/__tests__/product-validator-pipeline.test.ts`; Create `src/__tests__/browser-evidence-degradation.test.ts`; Modify `scripts/run-tests.ts`.

- [ ] **Step 4.1: Write the failing degradation and promotion suite**

Create `sidecoach/src/__tests__/browser-evidence-degradation.test.ts`:

```ts
import { runValidatorForTest } from '../validators/run-validator';
import type { BrowserEvidenceCollection } from '../validators/browser-evidence-collector';

const failedCollector = async (): Promise<BrowserEvidenceCollection> => ({ available: false, reason: 'injected no browser' });

async function run() {
  const noUrl = await runValidatorForTest('static-a11y', { cssText: '', markup: '', files: [] });
  for (const id of ['a11y.min-hit-area', 'a11y.color-contrast']) {
    const x = noUrl.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'inconclusive') throw new Error(`${id}: no URL must surface inconclusive`);
    if (noUrl.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: no URL must not promote browser rule`);
  }

  const failed = await runValidatorForTest(
    'static-a11y',
    { cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test' },
    { collectBrowserEvidence: failedCollector },
  );
  for (const id of ['a11y.min-hit-area', 'a11y.color-contrast']) {
    const x = failed.executions.find((e) => e.result.ruleId === id);
    if (!x || x.result.status !== 'inconclusive') throw new Error(`${id}: collector failure must surface inconclusive`);
    if (failed.activePolicy.requiredRuleIds.includes(id)) throw new Error(`${id}: collector failure must not promote browser rule`);
  }
  if (failed.result.status === 'error') throw new Error('collector failure must never become validator error');

  const withCollector = await runValidatorForTest(
    'polish-standard',
    { cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test' },
    {
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
    },
  );
  const genericity = withCollector.executions.find((e) => e.result.ruleId === 'polish.anti-pattern-genericity');
  if (!genericity || genericity.result.status !== 'inconclusive') throw new Error('genericity must stay inconclusive with collector and valid URL');
  if (withCollector.activePolicy.requiredRuleIds.includes('polish.anti-pattern-genericity')) throw new Error('genericity must stay non-required with collector');

  console.log('browser-evidence-degradation: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

In `product-validator-pipeline.test.ts`, add this function before `run()`:

```ts
async function browserPromotion() {
  const detail = await runValidatorForTest('static-a11y', {
    cssText: '', markup: '', files: [], renderUrl: 'data:text/html,test',
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
```

Call `await browserPromotion();` inside `run()`.

- [ ] **Step 4.2: Run to confirm failure**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-degradation.test.ts
npx ts-node src/__tests__/product-validator-pipeline.test.ts
```

Expected: TypeScript fails because `runValidatorForTest` has no collector dependency argument and `ValidatorRunDetail` has no `activePolicy`.

- [ ] **Step 4.3: Add runtime collector dependencies and active policy**

In `sidecoach/src/validators/run-validator.ts`, add imports:

```ts
import type { CleanPolicy, EvidenceKind } from '../product-rule-types';
import { collectBrowserEvidence, renderUrlFromContext } from './browser-evidence-collector';
import type { BrowserEvidenceCollection } from './browser-evidence-collector';
```

Remove `CleanPolicy` from that line if it is already imported elsewhere. Add:

```ts
export interface ValidatorRuntimeDeps {
  collectBrowserEvidence?: (renderUrl: string | undefined, signal?: AbortSignal) => Promise<BrowserEvidenceCollection>;
}

function activateBrowserPolicy(
  base: CleanPolicy,
  gen: typeof GENERATED_VALIDATORS[number],
  kinds: EvidenceKind[],
): CleanPolicy {
  const present = new Set(kinds);
  const promoted = gen.browserRuleIds.filter((id) => {
    const def = getRuleById(id);
    return !!def && def.evidenceRequirements.every((kind) => present.has(kind));
  });
  return {
    ...base,
    requiredRuleIds: [...base.requiredRuleIds, ...promoted],
    requiredCoverageByScope: [
      ...base.requiredCoverageByScope,
      ...gen.browserCoverageByScope.filter((c) => promoted.includes(c.ruleId)),
    ],
  };
}
```

Replace `toCheckContext` with:

```ts
function toCheckContext(c: Collected, raw: unknown, browser?: BrowserEvidenceCollection): ProductCheckContext {
  const r = raw as Partial<ProductCheckContext>;
  const e = browser?.available ? browser.evidence : undefined;
  return {
    cssText: c.cssText, markup: c.markup, files: c.files, discoveredFiles: c.discovered,
    renderUrl: renderUrlFromContext(raw),
    browserEvidence: e?.browserEvidence,
    computedStyle: e?.computedStyle ?? r?.computedStyle,
    dom: e?.dom ?? r?.dom,
    contrast: e?.contrast ?? r?.contrast,
    designTokens: r?.designTokens, tasteOptions: r?.tasteOptions,
  };
}
```

Add a `browser` parameter to `executeRule`. Replace its browser-only branch with:

```ts
  if (!isStaticallySatisfiable(def.evidenceRequirements)) {
    const result = def.checkProduct!(toCheckContext(collected, raw, browser)) as ProductRuleResult;
    const renderUrl = renderUrlFromContext(raw);
    const kinds = browser?.available ? browser.evidence.browserEvidence.kinds : [];
    const discoveredApplicableFiles = renderUrl ? [{ file: renderUrl, evidenceKindsPresent: kinds }] : [];
    const inspectedApplicableFiles = browser?.available && renderUrl ? [renderUrl] : [];
    const exec: RuleExecution = { result, discoveredApplicableFiles, inspectedApplicableFiles, sufficientlyCovered: false };
    exec.sufficientlyCovered = result.status !== 'inconclusive' && isCoverageSatisfied(record, observationFor(exec));
    return exec;
  }
```

Extend `ValidatorRunDetail`:

```ts
  activePolicy: CleanPolicy;
```

Change the `runDetailed` signature to:

```ts
async function runDetailed(
  validatorId: string,
  context: unknown,
  signal?: AbortSignal,
  deps: ValidatorRuntimeDeps = {},
): Promise<ValidatorRunDetail> {
```

Immediately after static collection succeeds, add:

```ts
  const renderUrl = renderUrlFromContext(context);
  const browser = await (deps.collectBrowserEvidence ?? collectBrowserEvidence)(renderUrl, signal);
  if (signal?.aborted) return abortedDetail(validatorId);
  const activePolicy = activateBrowserPolicy(policy, gen, browser.available ? browser.evidence.browserEvidence.kinds : []);
```

Use `activePolicy` instead of `policy` for `recordById`, `coverageObservations`, and the final `evaluateCleanPolicy` call. Pass `browser` into every `executeRule` call. Return `activePolicy` on the detail.

For early error and aborted detail returns, use the generated static policy when available, otherwise the existing empty policy. Change `abortedDetail` to accept an optional policy and include `activePolicy`.

Replace the test seam with:

```ts
export function runValidatorForTest(validatorId: string, context: unknown, deps: ValidatorRuntimeDeps = {}): Promise<ValidatorRunDetail> {
  return runDetailed(validatorId, context, undefined, deps);
}
```

Keep `makeProductValidator` production behavior using default dependencies:

```ts
    return (await runDetailed(validatorId, context, signal)).result;
```

- [ ] **Step 4.4: Pass URL-shaped lane targets as render URLs**

In `sidecoach/src/lane-runner.ts`, import:

```ts
import { renderUrlFromContext } from './validators/browser-evidence-collector';
```

Extend both validator context type annotations from `{ projectPath: string; target: string }` to:

```ts
{ projectPath: string; target: string; renderUrl?: string }
```

At each `runStepValidators` and `runBoundaryValidators` call site, pass:

```ts
{ projectPath, target: cp.target, renderUrl: renderUrlFromContext({ target: cp.target }) }
```

This makes a URL-shaped lane target browser-verifiable without changing checkpoint schema. A non-URL target degrades normally.

- [ ] **Step 4.5: Register the always-running degradation suite**

Add:

```ts
  { rel: 'src/__tests__/browser-evidence-degradation.test.ts', required: true },
```

after `browser-evidence-collector.test.ts` in `scripts/run-tests.ts`.

- [ ] **Step 4.6: Verify and commit**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-degradation.test.ts
npx ts-node src/__tests__/product-validator-pipeline.test.ts
npm run build
npx ts-node scripts/generate-validators.ts --check
npm test
```

Expected: degradation suite prints `browser-evidence-degradation: OK`; pipeline prints `product-validator-pipeline: OK`; validator check prints OK; final aggregate line is `run-tests: 50 suite(s) passed`. Browser launch may print its clear skip line, but the suite remains green.

Commit:

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/validators/run-validator.ts \
  sidecoach/src/lane-runner.ts \
  sidecoach/src/__tests__/browser-evidence-degradation.test.ts \
  sidecoach/src/__tests__/product-validator-pipeline.test.ts \
  sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4b2): promote browser rules only with collected evidence"
```

## Task 5: Final integration verification and explicit generated dist commit

**Files:** Generated `sidecoach/dist` allowlist only. No source behavior changes in this task.

- [ ] **Step 5.1: Run the focused evidence matrix**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node src/__tests__/browser-evidence-rules.test.ts
npx ts-node src/__tests__/browser-evidence-collector.test.ts
npx ts-node src/__tests__/browser-evidence-degradation.test.ts
npx ts-node src/__tests__/generate-validators.test.ts
npx ts-node src/__tests__/product-validator-pipeline.test.ts
```

Expected: every suite exits 0. The collector suite prints either `browser-evidence-collector: OK` or a clear line beginning `browser-evidence-collector: SKIP (`.

- [ ] **Step 5.2: Regenerate, check, build, and run the full engine suite**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npx ts-node scripts/generate-validators.ts
npx ts-node scripts/generate-validators.ts --check
npm run build
npx ts-node scripts/generate-validators.ts --check
npm test
```

Expected: both validator checks print OK, build exits 0, and final aggregate line is `run-tests: 50 suite(s) passed`.

- [ ] **Step 5.3: Prove no fresh browser download and no forbidden scope**

Run:

```bash
cd /Users/spare3/Documents/Github/improv
git diff --name-only main...HEAD | sort
git diff --name-only | sort
git diff --exit-code main...HEAD -- sidecoach/src/product-rule-registry.ts
git status --short | rg 'sidecoach/(mcp-server|hooks)/' && exit 1 || true
git status --short | rg 'playwright-report|test-results|\\.cache' && exit 1 || true
```

Expected: the registry diff command is silent, proving the genericity entry is untouched; there are no `sidecoach/mcp-server` or hook paths, no Playwright report/cache artifacts, and no collector-created server/build files.

- [ ] **Step 5.4: Run the ASCII and control-byte guard**

Run:

```bash
cd /Users/spare3/Documents/Github/improv
python3 - <<'PY'
from pathlib import Path
paths = [
    Path('docs/superpowers/plans/2026-06-14-lane-p4b2-browser-evidence-collector.md'),
    Path('sidecoach/src/validators/browser-evidence-collector.ts'),
    Path('sidecoach/src/__tests__/browser-evidence-rules.test.ts'),
    Path('sidecoach/src/__tests__/browser-evidence-collector.test.ts'),
    Path('sidecoach/src/__tests__/browser-evidence-degradation.test.ts'),
]
bad_dash = {'\u2012', '\u2013', '\u2014', '\u2015', '\u2212'}
for path in paths:
    data = path.read_bytes()
    text = data.decode('ascii')
    bad_controls = [b for b in data if (b < 32 and b not in (9, 10, 13)) or b == 127]
    if bad_controls:
        raise SystemExit(f'control byte found: {path}')
    if any(ch in text for ch in bad_dash):
        raise SystemExit(f'Unicode dash found: {path}')
print('ascii-control-guard: OK')
PY
```

Expected: `ascii-control-guard: OK`.

- [ ] **Step 5.5: Stage generated dist with an explicit per-file allowlist**

First inspect exactly which allowlisted files exist:

```bash
cd /Users/spare3/Documents/Github/improv
for stem in \
  sidecoach/dist/product-rule-types \
  sidecoach/dist/validator-generation \
  sidecoach/dist/validators.generated \
  sidecoach/dist/validators/check-context \
  sidecoach/dist/validators/browser-evidence-collector \
  sidecoach/dist/validators/checks/polish-checks \
  sidecoach/dist/validators/checks/a11y-checks \
  sidecoach/dist/validators/run-validator \
  sidecoach/dist/lane-runner
do
  for suffix in js js.map d.ts d.ts.map; do
    test -f "$stem.$suffix" && printf '%s\n' "$stem.$suffix"
  done
done
```

Expected: only the named generated modules print. Stage exactly those printed files, never a directory:

```bash
cd /Users/spare3/Documents/Github/improv
git add \
  sidecoach/dist/product-rule-types.js \
  sidecoach/dist/product-rule-types.js.map \
  sidecoach/dist/product-rule-types.d.ts \
  sidecoach/dist/product-rule-types.d.ts.map \
  sidecoach/dist/validator-generation.js \
  sidecoach/dist/validator-generation.js.map \
  sidecoach/dist/validator-generation.d.ts \
  sidecoach/dist/validator-generation.d.ts.map \
  sidecoach/dist/validators.generated.js \
  sidecoach/dist/validators.generated.js.map \
  sidecoach/dist/validators.generated.d.ts \
  sidecoach/dist/validators.generated.d.ts.map \
  sidecoach/dist/validators/check-context.js \
  sidecoach/dist/validators/check-context.js.map \
  sidecoach/dist/validators/check-context.d.ts \
  sidecoach/dist/validators/check-context.d.ts.map \
  sidecoach/dist/validators/browser-evidence-collector.js \
  sidecoach/dist/validators/browser-evidence-collector.js.map \
  sidecoach/dist/validators/browser-evidence-collector.d.ts \
  sidecoach/dist/validators/browser-evidence-collector.d.ts.map \
  sidecoach/dist/validators/checks/polish-checks.js \
  sidecoach/dist/validators/checks/polish-checks.js.map \
  sidecoach/dist/validators/checks/polish-checks.d.ts \
  sidecoach/dist/validators/checks/polish-checks.d.ts.map \
  sidecoach/dist/validators/checks/a11y-checks.js \
  sidecoach/dist/validators/checks/a11y-checks.js.map \
  sidecoach/dist/validators/checks/a11y-checks.d.ts \
  sidecoach/dist/validators/checks/a11y-checks.d.ts.map \
  sidecoach/dist/validators/run-validator.js \
  sidecoach/dist/validators/run-validator.js.map \
  sidecoach/dist/validators/run-validator.d.ts \
  sidecoach/dist/validators/run-validator.d.ts.map \
  sidecoach/dist/lane-runner.js \
  sidecoach/dist/lane-runner.js.map \
  sidecoach/dist/lane-runner.d.ts \
  sidecoach/dist/lane-runner.d.ts.map
git diff --cached --name-only | sort
```

Expected: the cached diff contains only the explicit generated dist allowlist. If an allowlisted file was not produced, omit that exact file rather than broadening the add command.

- [ ] **Step 5.6: Final green check and dist commit**

Run:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build && npm test
cd /Users/spare3/Documents/Github/improv
git diff --cached --check
git commit -m "build(lane-p4b2): commit browser evidence collector dist"
```

Expected: build exits 0, final aggregate line is `run-tests: 50 suite(s) passed`, `git diff --cached --check` is silent, and the commit succeeds.

## Self-Review

- [ ] All four in-scope rules have trusted evidence-present pass and fail paths in `browser-evidence-rules.test.ts`.
- [ ] All four in-scope rules remain inconclusive without trusted evidence.
- [ ] `polish.anti-pattern-genericity` is explicitly out of scope, its registry entry and check semantics are untouched, and an always-running test proves it stays non-required and inconclusive with a valid URL and successful collector.
- [ ] The real Chromium fixture collects computed style, DOM facts, and contrast without real network access.
- [ ] The real Chromium fixture proves at least one real pass and one real fail instead of inconclusive.
- [ ] Browser launch failure, navigation failure, collector failure, and no URL do not throw and do not promote browser rules.
- [ ] Static rules and generated static `cleanPolicy.requiredRuleIds` are unchanged.
- [ ] Exactly the four allowlisted browser rules become active required rules only after successful evidence collection for that target.
- [ ] Generated browser policy metadata is checked in, regenerated by build, and guarded by `--check`; genericity remains valid as owned, non-required, and inconclusive.
- [ ] Playwright uses the shared `~/Library/Caches/ms-playwright` cache and no plan step runs `playwright install`.
- [ ] The collector starts no server, builds no project, and blocks cross-origin subresources.
- [ ] Browser tests use a self-contained `data:` URL and skip clearly when Chromium cannot launch.
- [ ] The degradation suite always runs and is registered `required: true`.
- [ ] Test HOME isolation remains owned by the existing aggregate runner; no test writes to real `~/.claude`.
- [ ] Engine-only scope is preserved.
- [ ] Dist is staged only through the explicit per-file allowlist.
- [ ] The plan and new files pass the ASCII and control-byte guard.
- [ ] There are no placeholders, TODOs, omitted implementation bodies, Unicode dashes, or broad staging commands.

## v1 Notes

- `polish.anti-pattern-genericity` is deferred by team-lead decision. Its DOM-based meaning was never defined for the render-URL model, and P4b-2 does not invent a repetition score or any other product semantics. The rule remains exactly as it is today: owned, non-required, and inconclusive.
- The contrast slot remains the already-declared single `{ wcagAA, ratio }` shape. v1 defines it as the worst measured visible direct-text contrast ratio and an all-inspected-text AA boolean.
- The computed-style slot remains the already-declared flat `Record<string,string>`. v1 uses stable aggregate keys rather than expanding the public shape.
- Browser evidence is intentionally collected per validator run. Cross-validator browser-session reuse is deferred because it introduces lifecycle, freshness, and cancellation coupling that is outside P4b-2.
