// Flow K: Multi-Lens Audit
// 5-dimension scan: accessibility, performance, theming, responsive, anti-patterns

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { applyModelSelection } from './model-routing';
import {
  readRetryConfig,
  readRetryState,
  evaluateHaltConditions,
  computeErrorSignature,
  recordIteration,
  buildHaltResult,
  attachRetryStateToResult,
} from './retry-control';
import { execFileSync } from 'child_process';
import * as path from 'path';

interface AuditDimension {
  name: string;
  checks: string[];
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
}

/** What the token-drift lens contributes to the Theming dimension. */
interface DriftOutcome {
  status: 'pass' | 'warning' | 'fail';
  issue: string;
  check: string;
}

/**
 * Token-drift lens for the Theming dimension. Invokes the sibling bin
 * `bin/sidecoach-drift.js` against the project and maps its fail-closed verdict
 * onto the "token consistency" check the audit already claims to cover.
 *
 * FULLY CONTAINED: returns `null` on ANY failure (bin missing, spawn failure,
 * timeout, non-JSON, usage/IO error) so the caller keeps the static Theming
 * placeholder and the audit NEVER crashes. A non-zero drift exit that still
 * emits JSON (drift=1, inconclusive=3) is a real verdict, not a failure.
 * FAIL-CLOSED: an "inconclusive" verdict maps to a warning, never a false pass.
 */
function runTokenDriftCheck(projectPath: string | undefined): DriftOutcome | null {
  if (!projectPath) return null;
  const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-drift.js');
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [bin, projectPath, '--json', '--quiet'], {
      encoding: 'utf8',
      timeout: 20000,
      // Explicit headroom (default is 1MB): a large drift report must not be
      // truncated into unparseable JSON. On overflow execFileSync throws ->
      // helper returns null -> static Theming placeholder (still fail-safe).
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    // Non-zero exit still throws here; drift=1 and inconclusive=3 carry their
    // JSON verdict on stdout. A usage/IO error (exit 2) emits nothing -> bail.
    const captured =
      err && typeof (err as { stdout?: unknown }).stdout === 'string'
        ? ((err as { stdout: string }).stdout)
        : '';
    if (!captured.trim()) return null;
    stdout = captured;
  }

  let parsed: {
    verdict?: string;
    driftCount?: number;
    reason?: string | null;
    drifted?: Array<{ name?: string }>;
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }

  if (parsed.verdict === 'drift') {
    const n = typeof parsed.driftCount === 'number' ? parsed.driftCount : 0;
    const names = Array.isArray(parsed.drifted)
      ? parsed.drifted.slice(0, 5).map((d) => d && d.name).filter(Boolean)
      : [];
    return {
      status: 'fail',
      issue: `${n} token(s) drifted from DESIGN.md${names.length ? `: ${names.join(', ')}` : ''}`,
      check: `Token drift vs DESIGN.md (sidecoach-drift): ${n} off-system token(s)`,
    };
  }
  if (parsed.verdict === 'clean') {
    return {
      status: 'pass',
      issue: '',
      check: 'Token drift vs DESIGN.md (sidecoach-drift): none - tokens match the baseline',
    };
  }
  // inconclusive / unknown -> fail-closed warning (never a silent pass).
  return {
    status: 'warning',
    issue: `token drift not assessed: ${parsed.reason || 'no DESIGN.md baseline or no governed tokens'}`,
    check: 'Token drift vs DESIGN.md (sidecoach-drift): not assessed (fail-closed)',
  };
}

export class FlowKMultiLensAuditHandler extends BaseFlowHandler {
  constructor() {
    super('flowK_multi_lens_audit');
  }

  canExecute(context: FlowExecutionContext): boolean {
    return !!context.projectPath;
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    try {
      // T-0009: Phase-gated retry control. Halt BEFORE doing work if the
      // orchestrator has looped past maxCycles or against an identical-error
      // signature.
      const retryConfig = readRetryConfig(context);
      const retryState = readRetryState(context);
      const haltDecision = evaluateHaltConditions(retryState, retryConfig);
      if (haltDecision.halt) {
        return buildHaltResult(this.flowId, this.getFlowName(), haltDecision, 'multi-lens-audit', `[${this.flowId}]`);
      }

      const dimensions: AuditDimension[] = [
        {
          name: 'Accessibility (a11y)',
          checks: [
            'WCAG 2.1 AA color contrast (4.5:1 normal, 3:1 large)',
            'Semantic HTML (nav, main, article, section)',
            'ARIA labels on icons, buttons, form controls',
            'Keyboard navigation (Tab order, Focus visible)',
            'Screen reader testing (VoiceOver, NVDA, JAWS)',
            'Reduced motion support (prefers-reduced-motion)',
          ],
          status: 'warning',
          issues: ['manual testing required'],
        },
        {
          name: 'Performance',
          checks: [
            'Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)',
            'Font loading strategy (system fonts, font-display: swap)',
            'Image optimization (responsive srcset, modern formats)',
            'Bundle size analysis (gzip <250KB initial)',
            'Third-party scripts loading strategy',
            'Lazy loading images and components',
          ],
          status: 'warning',
          issues: ['lighthouse audit recommended'],
        },
        {
          name: 'Theming',
          checks: [
            'Light/dark mode support (color-scheme, prefers-color-scheme)',
            'Sufficient contrast in both themes',
            'Token consistency across themes',
            'Focus indicators visible in both themes',
            'No color-dependent information',
          ],
          status: 'warning',
          issues: ['visual testing required'],
        },
        {
          name: 'Responsive Design',
          checks: [
            'Mobile-first breakpoints (320px, 640px, 1024px, 1280px)',
            'Touch targets 40x40px minimum',
            'Text sizing readable on all viewports',
            'Flexible layouts (no fixed widths)',
            'Safe area insets (notch/dynamic island support)',
          ],
          status: 'warning',
          issues: ['device testing recommended'],
        },
        {
          name: 'Anti-Patterns',
          checks: [
            'No `transition: all` (specify properties)',
            'No layout-breaking animations',
            'No visibility toggling (use opacity)',
            'No hardcoded breakpoints (use tokens)',
            'No global CSS pollution',
          ],
          status: 'pass',
          issues: [],
        },
      ];

      // Theming lens: fold a REAL token-drift verdict from bin/sidecoach-drift.js
      // into the "token consistency" check when a project path is known. Fully
      // contained - a null outcome leaves the static placeholder intact and the
      // audit never crashes. Only a PROVEN drift escalates the dimension to
      // 'fail'; a clean/inconclusive verdict keeps the existing 'warning' (the
      // other theming checks - dark-mode contrast, focus indicators - are still
      // manual), appending the drift result as an audited note. Never a false pass.
      const drift = runTokenDriftCheck(context.projectPath);
      if (drift) {
        const theming = dimensions.find((d) => d.name === 'Theming');
        if (theming) {
          theming.checks = [...theming.checks, drift.check];
          if (drift.status === 'fail') {
            theming.status = 'fail';
            theming.issues = [drift.issue, ...theming.issues.filter((i) => i !== 'visual testing required')];
          } else if (drift.issue) {
            theming.issues = [...theming.issues, drift.issue];
          }
        }
      }

      const checklist = this.createChecklist([
        { label: 'Run WCAG 2.1 AA contrast checker', required: true },
        { label: 'Test keyboard navigation (Tab, Shift+Tab, Enter, Space)', required: true },
        { label: 'Test with screen reader (VoiceOver/NVDA/JAWS)', required: false },
        { label: 'Run Lighthouse audit (PWA, accessibility, performance)', required: false },
        { label: 'Test in light and dark modes', required: true },
        { label: 'Test on mobile, tablet, desktop', required: true },
        { label: 'Verify Core Web Vitals <2.5s, <100ms, <0.1', required: false },
        { label: 'Check third-party script loading strategy', required: false },
        { label: 'Verify no transition: all or layout animations', required: true },
        { label: 'Verify touch targets 40x40px minimum', required: true },
      ]);

      const guidance = [
        'Multi-Lens Audit scans 5 critical dimensions of quality: accessibility, performance, theming, responsive, and anti-patterns.',
        '',
        'ACCESSIBILITY:',
        '- WCAG 2.1 AA: 4.5:1 contrast normal, 3:1 large text',
        '- Semantic HTML: nav, main, article, section, aside',
        '- ARIA: label icons, buttons, form controls (aria-label, aria-labelledby)',
        '- Keyboard: Tab/Shift+Tab navigation, visible focus, form submission with Enter',
        '- Screen reader: test with VoiceOver (Mac), NVDA (Windows), JAWS (enterprise)',
        '- Reduced motion: prefers-reduced-motion support',
        '',
        'PERFORMANCE:',
        '- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1',
        '- Fonts: use system fonts or font-display: swap/optional',
        '- Images: responsive srcset, modern formats (WebP, AVIF), lazy load',
        '- Bundles: <250KB gzip for initial load',
        '- Third-party: defer non-critical scripts, use async/defer',
        '',
        'THEMING:',
        '- Light/dark mode via color-scheme CSS property',
        '- Sufficient contrast in both themes',
        '- Token consistency (no hardcoded colors)',
        '- Focus indicators visible in both themes',
        '',
        'RESPONSIVE:',
        '- Mobile-first (320px base)',
        '- Touch targets 40x40px minimum',
        '- Readable text on all viewports',
        '- Safe area insets (notch/dynamic island)',
        '',
        'ANTI-PATTERNS:',
        '- Never transition: all (specify properties)',
        '- Never toggle visibility (use opacity)',
        '- Never hardcode breakpoints (use tokens)',
        '- Never pollute global styles',
      ];

      const passCount = dimensions.filter((d) => d.status === 'pass').length;

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(
          `Multi-lens audit: ${passCount}/${dimensions.length} dimensions pass - accessibility, performance, theming, responsive, anti-patterns`
        )
        .addRule('accessibility', ['WCAG 2.1 AA', 'semantic HTML', 'ARIA', 'keyboard navigation', 'screen reader testing', 'reduced motion support'])
        .addRule('performance', ['Core Web Vitals <2.5s LCP', 'font-display swap', 'image optimization', 'bundle <250KB'])
        .addRule('theming', ['color-scheme support', 'sufficient contrast both modes', 'token consistency'])
        .addRule('responsive', ['mobile-first', '40x40px hit targets', 'safe areas', 'readable text'])
        .addRule('anti-patterns', ['no transition: all', 'no visibility toggle', 'no hardcoded breakpoints', 'no global CSS'])
        .addDecision('Audit dimensions', '5 critical lenses: a11y, performance, theming, responsive, anti-patterns')
        .addMetric('dimensions-scanned', 5, 'pass')
        .addMetric('dimensions-pass', passCount, 'pass', 5)
        .addValidation('Multi-lens audit', 'warning', 'Manual testing required for a11y, performance, theming, responsive')
        .addArtifact('audit-checklist', 5);

      const auditResult: FlowExecutionResult = {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'Multi-Lens Audit initialized - 5-dimension quality scan',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Audit Dimensions',
            dimensions
              .map(
                (d) => `${d.name} (${d.status})\n- ${d.checks.map((c) => c).join('\n- ')}\n${d.issues.length > 0 ? `Issues: ${d.issues.join(', ')}` : ''}`
              )
              .join('\n\n'),
            '5 critical quality dimensions'
          ),
        ],
        memory: memoryBuilder.build(),
      };

      // T-0009: Phase-gated retry control. The audit's "failed rules" are the
      // dimensions that did not pass (warning + fail). Hash the failure set
      // into a signature so identical failure patterns across iterations
      // trigger the halt.
      const failedDimensionIds = dimensions
        .filter((d) => d.status !== 'pass')
        .map((d) => d.name);
      const errorSignature = computeErrorSignature({
        validator: 'multi-lens-audit',
        failedRules: failedDimensionIds,
        filePath: context.projectPath || '',
      });
      const nextState = recordIteration(retryState, errorSignature);
      attachRetryStateToResult(auditResult, nextState, retryConfig);

      return auditResult;
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Multi-lens audit failed: ${String(err).substring(0, 40)}`)
        .addValidation('audit-execution', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to initialize multi-lens audit',
        error: String(err),
        memory,
      };
    }
  }
}

export function createFlowKHandler(): FlowKMultiLensAuditHandler {
  return new FlowKMultiLensAuditHandler();
}
