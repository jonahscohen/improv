/**
 * Sidecoach ASSET PRODUCTION LENS - the wiring that makes image generation part of doing design work.
 *
 * THE DEFECT THIS CLOSES. Sidecoach could generate a verified raster asset and no flow ever asked it to. The
 * generator was a sibling CLI: reachable by a human who already knew it existed, unreachable from the path a real
 * request travels. A capability that only the author can find is not a capability, and the measure of this file is
 * not that it works but that `/sidecoach craft <feature>` reaches it without being told to.
 *
 * WHAT A LENS IS HERE. The same shape as the token-drift lens in the audit flow: a flow calls it, it does one
 * bounded thing through a sibling bin, and it is FULLY CONTAINED. Any harness problem (no project path, missing
 * bin, spawn failure, timeout, unparseable output) returns a named outcome or null, and the flow carries on with
 * everything else it was doing. A build must never fail because an asset step could not run.
 *
 * THE FOUR PROPERTIES IT PRESERVES, each one a thing the wiring could have quietly dropped:
 *
 *   1. THE CONTRACT TRAVELS. The compiled brief carries the ink colour, the ink region, and the contrast floor,
 *      and every one of them is passed to the bin as a verification flag. This is the property most easily lost in
 *      wiring: generate through a flow, forget the contract, and the pixel checks silently stop running while the
 *      exit code still says zero. The whole point of the verifier is that it reads the region the prompt was told
 *      to protect, so the flags are assembled from the same compilation that wrote the prompt.
 *
 *   2. THREE-VALUED, FAIL-CLOSED. verified, failed, and unverified stay distinct, and only `verified` is offered
 *      downstream. A plate whose checks could not run is reported as unchecked, never rounded up.
 *
 *   3. IT CANNOT SPEND ON ITS OWN. The default provider is the offline deterministic renderer and the spend signal
 *      is never synthesised here. Going live is an operator decision expressed in the environment, and the bin
 *      remains the authority that enforces it: this lens passes through what the operator set and reports the
 *      bin's own refusal (exit 8) as its own named outcome rather than second-guessing the policy.
 *
 *   4. IT DOES NOT FIRE ON EVERYTHING. A brief that names no raster gets no asset and says so. A lens that
 *      produced a plate for every component would be noise, and noise is how a real capability gets muted.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { FlowExecutionContext } from './flow-handler';
import {
  compileImageBrief,
  summarizeCompilation,
  OPENAI_SIZES,
  type CompiledImageBrief,
  type ImageBrief,
  type SizePolicy,
} from './image-brief-compiler';
import { parseDesignMd, type DesignTokens } from './design-md-parser';

// ---------------------------------------------------------------------------
// Outcome
// ---------------------------------------------------------------------------

/**
 * Every way this step can end, named. `unavailable` is the only catch-all and it always carries a detail line, so
 * no state is reported as a shrug.
 */
export type AssetOutcomeStatus =
  | 'not-needed'
  | 'verified'
  | 'failed'
  | 'unverified'
  | 'needs-consent'
  | 'no-key'
  | 'budget'
  | 'unavailable';

export interface AssetProductionOutcome {
  status: AssetOutcomeStatus;
  /** Absolute path to the asset, present only when bytes were written. */
  path?: string;
  provider?: string;
  model?: string;
  /** Recorded cost in USD and how that figure was arrived at. Zero and `offline` on the default path. */
  costUsd?: number;
  costBasis?: string;
  /** The compilation, present whenever a raster was called for (so the caller can report what was asked). */
  compiled?: CompiledImageBrief;
  /** Per-check verdicts as the verifier reported them. */
  checks?: Array<{ id: string; status: string; detail: string }>;
  /**
   * Whether the bytes carry the offline synthetic marker. Read out of the PNG by the verifier, not taken from
   * what anyone claims, so it survives a rename and cannot be laundered. Drives gate severity below.
   */
  synthetic?: boolean;
  /**
   * The failure was the PROVIDER substituting format or geometry, not the asset being wrong.
   *
   * MEASURED, not theorised: a live Gemini call for a 1024x576 PNG returns a 1376x768 JPEG. It honours the aspect
   * ratio and picks its own pixel ladder, and it answers in JPEG whatever format was asked for. Both are real
   * contract violations and both are reported as failures, because they are. This flag exists so the diagnosis
   * names the cause instead of leaving an operator to conclude their prompt was bad, and so the consequence can be
   * stated plainly: this repository decodes PNG only, so a JPEG answer means the pixel checks, contrast included,
   * did not run at all. It NEVER softens the verdict.
   */
  providerSubstituted?: boolean;
  detail: string;
}

/** Only a verified asset may be handed to a build. Every other state is withheld. */
export function isOfferableAsset(outcome: AssetProductionOutcome | null): boolean {
  return outcome !== null && outcome.status === 'verified' && typeof outcome.path === 'string' && outcome.path.length > 0;
}

// ---------------------------------------------------------------------------
// Reading the project's own truth
// ---------------------------------------------------------------------------

/**
 * Harvest real hex values out of a PROSE DESIGN.md, the kind with no YAML frontmatter.
 *
 * WHY THIS IS NOT A SHORTCUT. Most real projects have a design document that a spec parser rejects: a markdown
 * body with lines like "- **Dark Teal**: `#1B4D4D` - section backgrounds". The palette is right there, authored by
 * a human, and refusing to read it because the file lacks frontmatter throws away real project truth and hands the
 * generator an adjective instead of a colour. This repo's own page directory is exactly that shape, which is how
 * the gap was found.
 *
 * THE HONESTY RULE IS UNCHANGED. Every value returned was read out of the project's file. The label and its
 * trailing description become the token path, so the compiled prompt and the verification contract can both cite
 * where the number came from and a reader can check it. Nothing is inferred and nothing is invented.
 *
 * Shaped as a DesignTokens so the compiler needs no second code path.
 */
export function harvestPaletteFromProse(markdown: string): DesignTokens | null {
  const colors: Record<string, string> = {};
  const lines = String(markdown).split(/\r?\n/);
  // A labelled colour line: some emphasis-wrapped or plain label, a colon, then a hex (often in backticks), with
  // an optional trailing description carrying the role words worth keeping. The separator class accepts a plain
  // hyphen and U+2013, which hand-written design docs use interchangeably.
  // The separator between the label and the hex may be a colon, an equals, OR a dash. Codex review 2026-07-29
  // finding 2, rated high: accepting only colon and equals rejected a perfectly ordinary line
  // ("- **Body text** - #2C2C2C - primary typography"), so the palette was reported absent and the contrast check
  // silently ran uncontracted. A separator character is not a reason to lose a real colour. The class covers the
  // plain hyphen plus U+2013 and U+2014, which hand-written design docs use interchangeably.
  const D = '\\-\\u2013\\u2014';
  const re = new RegExp(
    `^\\s*[-*]?\\s*(?:\\*\\*|__)?([A-Za-z][A-Za-z0-9 /&${D}]{1,40}?)(?:\\*\\*|__)?\\s*(?:[:=]|[${D}])\\s*\`?(#[0-9a-fA-F]{3,8})\`?\\s*(?:[${D}]\\s*(.{0,80}))?`,
  );
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const slug = [m[1], m[3] || '']
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (!slug) continue;
    if (!Object.prototype.hasOwnProperty.call(colors, slug)) colors[slug] = m[2].toLowerCase();
  }
  if (Object.keys(colors).length === 0) return null;
  return {
    colors,
    typography: {},
    rounded: {},
    spacing: {},
    shadow: {},
    motion: {},
    bodyLineNumbers: { frontmatterStart: 0, frontmatterEnd: 0, bodyStart: 1 },
    raw: { colors },
  };
}

/**
 * Load DESIGN.md tokens for the compiler: the Google-spec frontmatter first, the prose harvest as a fallback.
 *
 * Returns null only when there is no DESIGN.md, it cannot be read, or it contains no hex anywhere. A project with
 * no parseable colour gets a described palette and an honestly-uncontracted contrast check, which is a weaker
 * asset and an accurate report; it never gets an invented hex.
 */
/**
 * Prefer tokens the flow ALREADY HAS in memory over re-reading a file.
 *
 * Codex review 2026-07-29, finding 1, rated critical and correctly so. The lens read only
 * `<projectPath>/DESIGN.md`, while flow G already carries parsed tokens on its context and uses them for its own
 * guidance. When the real design file is page-local or non-standard at the root, the file read returns null, the
 * compiler drops the ink, and `buildImageArgv` omits `--ink/--ink-region/--min-contrast`. The overlay-contrast
 * check then SILENTLY STOPS RUNNING while the flow had the real text colour in memory the whole time. That is the
 * highest-severity class in this repository: not a wrong answer, a check that quietly does not happen.
 *
 * Order: parsed tokens on the context, then the raw `metadata.designTokens` shape flow G already passes around,
 * then the file. First source with a colour wins; a source with no colours is not a source.
 */
export function resolveDesignTokens(context: FlowExecutionContext): DesignTokens | null {
  const hasColours = (t: unknown): boolean =>
    !!t && typeof t === 'object' && Object.keys(((t as DesignTokens).colors as object) || {}).length > 0;

  const parsed = context.projectContext?.design?.parsedTokens;
  if (hasColours(parsed)) return parsed as DesignTokens;

  // flow G threads a bare token object through `metadata.designTokens`. Wrap it into the DesignTokens shape rather
  // than teaching the compiler a second input format.
  const meta = context.metadata?.designTokens as Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object' && Object.keys((meta.colors as object) || {}).length > 0) {
    return {
      colors: (meta.colors as Record<string, unknown>) || {},
      typography: (meta.typography as Record<string, unknown>) || {},
      rounded: (meta.rounded as Record<string, string>) || {},
      spacing: (meta.spacing as Record<string, unknown>) || {},
      shadow: (meta.shadow as Record<string, string>) || {},
      motion: (meta.motion as Record<string, unknown>) || {},
      bodyLineNumbers: { frontmatterStart: 0, frontmatterEnd: 0, bodyStart: 1 },
      raw: meta,
    } as DesignTokens;
  }

  const fromDisk = context.projectPath ? readDesignTokens(context.projectPath) : null;
  return hasColours(fromDisk) ? fromDisk : null;
}

export function readDesignTokens(projectPath: string): DesignTokens | null {
  for (const name of ['DESIGN.md', 'design.md']) {
    const file = path.join(projectPath, name);
    let src: string;
    try {
      if (!fs.existsSync(file)) continue;
      src = fs.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed = parseDesignMd(src);
      // Frontmatter can exist and still carry no colours; fall through to the prose body rather than reporting an
      // empty palette when the hexes are sitting in the markdown underneath.
      if (Object.keys(parsed.colors || {}).length > 0) return parsed;
    } catch {
      // No frontmatter. The prose harvest below is the whole point.
    }
    return harvestPaletteFromProse(src);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The environment contract
// ---------------------------------------------------------------------------

export interface AssetProductionEnv {
  SIDECOACH_IMAGE_PROVIDER?: string;
  SIDECOACH_IMAGE_ALLOW_SPEND?: string;
  SIDECOACH_IMAGE_BUDGET_USD?: string;
  SIDECOACH_IMAGE_ASSUME_COST_USD?: string;
  SIDECOACH_IMAGE_MODEL?: string;
  [key: string]: string | undefined;
}

const LIVE_PROVIDERS = new Set(['openai', 'nanobanana', 'auto']);

/**
 * What geometries the configured provider can actually serve.
 *
 * THE RULE: the size must be servable by EVERY provider this invocation might reach. Each branch below is that
 * rule applied, and the awkward one is `auto`, whose intersection really is a single square: OpenAI accepts only
 * three fixed geometries and the cheapest Gemini image model refuses anything that buckets above 1K, so 1024x1024
 * is the only size the whole chain can serve. Cost of getting this wrong, measured: an HTTP 400 that spends
 * nothing but produces nothing either, which a flow then reports as an unavailable asset.
 */
export function sizePolicyFor(provider: string): SizePolicy {
  switch (provider) {
    case 'openai':
      return { allowed: OPENAI_SIZES };
    case 'nanobanana':
      // Arbitrary geometry is accepted and bucketed by the longer edge; 1024 keeps every model on its 1K tier,
      // which is both the cheapest published rate and the only one the lite model supports.
      return { maxEdge: 1024 };
    case 'auto':
      return { allowed: ['1024x1024'] };
    default:
      // The offline renderer draws any geometry, so the staging's own aspect is honoured at a useful size.
      return { maxEdge: 1536 };
  }
}

/**
 * Assemble the bin argv from a compilation.
 *
 * Exported and pure so the argv can be asserted directly in a test. That matters for two properties that are
 * otherwise only observable by spending money: that every contract flag the compilation produced is present, and
 * that no spend signal appears unless the operator put one in the environment.
 */
export function buildImageArgv(
  bin: string,
  compiled: CompiledImageBrief,
  out: string,
  cacheDir: string,
  env: AssetProductionEnv,
): string[] {
  const provider = (env.SIDECOACH_IMAGE_PROVIDER || 'offline').trim() || 'offline';
  const argv = [
    bin,
    'generate',
    '--prompt',
    compiled.prompt,
    '--out',
    out,
    '--size',
    compiled.contract.size,
    '--format',
    compiled.contract.format,
    '--provider',
    provider,
    '--expect-size',
    compiled.contract.size,
    '--expect-format',
    compiled.contract.format,
    '--cache-dir',
    cacheDir,
    '--quiet',
  ];

  // The contract, carried through in full. Each of these is a check that stops running if the flag is dropped.
  if (compiled.contract.ink && compiled.contract.inkRegion) {
    const r = compiled.contract.inkRegion;
    argv.push('--ink', compiled.contract.ink, '--ink-region', `${r.x},${r.y},${r.w},${r.h}`);
    if (typeof compiled.contract.minContrast === 'number') {
      argv.push('--min-contrast', String(compiled.contract.minContrast));
    }
  }
  if (compiled.contract.alpha) argv.push('--alpha', compiled.contract.alpha);

  if (env.SIDECOACH_IMAGE_MODEL && env.SIDECOACH_IMAGE_MODEL.trim()) {
    argv.push('--model', env.SIDECOACH_IMAGE_MODEL.trim());
  }
  // Spend flags are pass-through only. Nothing here manufactures consent, and the bin refuses a live call without
  // it, which is where that policy belongs.
  if (LIVE_PROVIDERS.has(provider) && env.SIDECOACH_IMAGE_ALLOW_SPEND === '1') argv.push('--yes-spend');
  if (env.SIDECOACH_IMAGE_BUDGET_USD && Number.isFinite(Number(env.SIDECOACH_IMAGE_BUDGET_USD))) {
    argv.push('--budget-usd', String(Number(env.SIDECOACH_IMAGE_BUDGET_USD)));
  }
  if (env.SIDECOACH_IMAGE_ASSUME_COST_USD && Number.isFinite(Number(env.SIDECOACH_IMAGE_ASSUME_COST_USD))) {
    argv.push('--assume-cost-usd', String(Number(env.SIDECOACH_IMAGE_ASSUME_COST_USD)));
  }
  return argv;
}

// ---------------------------------------------------------------------------
// The lens
// ---------------------------------------------------------------------------

export interface AssetProductionOptions {
  /** Where the asset is written, relative to the project. Default `.sidecoach-cache/assets`. */
  outDirRel?: string;
  /** Overrides for the brief, when a flow knows more than the utterance does. */
  brief?: Partial<ImageBrief>;
  env?: AssetProductionEnv;
}

/**
 * Compile the flow's brief and produce the asset through bin/sidecoach-image.js.
 *
 * Returns null ONLY when there is no project to write into, which is the one condition under which there is
 * nothing meaningful to report. Every other path returns a named outcome.
 */
export function runAssetProductionLens(
  context: FlowExecutionContext,
  options: AssetProductionOptions = {},
): AssetProductionOutcome | null {
  const projectPath = context.projectPath;
  if (!projectPath) return null;
  try {
    if (!fs.statSync(projectPath).isDirectory()) return null;
  } catch {
    return null;
  }

  const env = options.env || (process.env as AssetProductionEnv);
  const utterance = String(context.utterance || '');
  const briefText = String(options.brief?.text ?? utterance);
  const provider = (env.SIDECOACH_IMAGE_PROVIDER || 'offline').trim() || 'offline';

  const compiled = compileImageBrief(
    { ...options.brief, text: briefText },
    {
      register: context.projectContext?.register,
      approach: context.projectContext?.design?.visual?.approach,
      productName:
        (context.projectContext?.product?.name as string | undefined) ||
        (context.projectContext?.product?.productName as string | undefined),
      // Tokens the flow already holds beat a fresh file read. See resolveDesignTokens.
      designTokens: resolveDesignTokens(context),
      antiReferences: context.projectContext?.product?.antiReferences,
      // Resolved against the provider that is actually going to be called, not against a hopeful default.
      sizePolicy: sizePolicyFor(provider),
    },
  );

  if (!compiled) {
    return {
      status: 'not-needed',
      detail: 'the brief names no raster asset (no backdrop, texture, plate, portrait, object, thumbnail, scene, or social card), so no image was generated',
    };
  }

  const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-image.js');
  if (!fs.existsSync(bin)) {
    return { status: 'unavailable', compiled, detail: `the image bin is not present at ${bin}` };
  }

  const outDir = path.join(projectPath, options.outDirRel || path.join('.sidecoach-cache', 'assets'));
  const out = path.join(outDir, `${compiled.role}-${compiled.composition.id}-${compiled.digest}.png`);
  const cacheDir = path.join(projectPath, '.sidecoach-cache', 'images');
  const argv = buildImageArgv(bin, compiled, out, cacheDir, env);
  // A live provider round-trip is minutes, not seconds. The offline renderer is local work and stays tight.
  const timeout = LIVE_PROVIDERS.has(provider) ? 240000 : 45000;

  let stdout = '';
  let code = 0;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    stdout = execFileSync(process.execPath, argv, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; signal?: string };
    code = typeof e.status === 'number' ? e.status : -1;
    stdout = typeof e.stdout === 'string' ? e.stdout : '';
    if (code === -1) {
      return {
        status: 'unavailable',
        compiled,
        detail: `the image step did not run to completion${e.signal ? ` (${e.signal})` : ''}; nothing was produced`,
      };
    }
  }

  let parsed: {
    verdict?: string;
    provider?: string;
    model?: string;
    synthetic?: boolean;
    cost?: { usd?: number; basis?: string };
    verification?: { checks?: Array<{ id: string; status: string; detail: string }> };
  } = {};
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      status: mapExitToStatus(code, 'unavailable'),
      compiled,
      detail: `the image step exited ${code} without a verdict; nothing is claimed about any bytes on disk`,
    };
  }

  const checks = parsed.verification?.checks || [];
  const base = {
    compiled,
    provider: parsed.provider || provider,
    model: parsed.model,
    costUsd: typeof parsed.cost?.usd === 'number' ? parsed.cost.usd : undefined,
    costBasis: parsed.cost?.basis,
    checks,
    synthetic: parsed.synthetic === true,
  };

  if (code === 0 && parsed.verdict === 'verified') {
    return {
      ...base,
      status: 'verified',
      path: out,
      detail: `${checks.filter((c) => c.status === 'pass').length} check(s) passed against the decoded bytes: ${summarizeCompilation(compiled)}`,
    };
  }
  if (parsed.verdict === 'failed') {
    const failed = checks.filter((c) => c.status === 'fail');
    // A substitution is a failure whose every failing check is the provider answering in a different format or
    // geometry than it was asked for. It stays a failure; it is only labelled so the diagnosis is not guesswork.
    const substitutionOnly =
      failed.length > 0 && failed.every((c) => c.id === 'format-matches' || c.id === 'dimensions-match');
    return {
      ...base,
      status: 'failed',
      // The bytes exist on disk even on a failure, and a human should be able to look at them. The path is
      // reported for inspection; `isOfferableAsset` still refuses to hand it to a build.
      path: out,
      providerSubstituted: substitutionOnly && !base.synthetic,
      detail: `the asset FAILED verification and is not offered: ${failed.map((c) => `${c.id} (${c.detail})`).join('; ') || 'unspecified check'}`,
    };
  }
  if (parsed.verdict === 'unverified') {
    const un = checks.filter((c) => c.status === 'unverified');
    return {
      ...base,
      status: 'unverified',
      path: out,
      detail: `the asset could NOT be fully checked and is not offered: ${un.map((c) => `${c.id} (${c.detail})`).join('; ') || 'unspecified check'}`,
    };
  }
  return {
    ...base,
    status: mapExitToStatus(code, 'unavailable'),
    detail: `no asset was produced (the image step exited ${code}, verdict ${String(parsed.verdict)})`,
  };
}

/** Map the bin's exit table onto the outcome names a flow reports. */
function mapExitToStatus(code: number, fallback: AssetOutcomeStatus): AssetOutcomeStatus {
  switch (code) {
    case 1:
      return 'failed';
    case 3:
      return 'unverified';
    case 4:
      return 'no-key';
    case 7:
      return 'budget';
    case 8:
      return 'needs-consent';
    default:
      return fallback;
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * The guidance lines a flow emits for the asset step, in EVERY state including the ones where nothing happened.
 *
 * Silence is the failure mode this replaces: a step that reports nothing when it did not run is indistinguishable
 * from a step that ran clean, and the reader cannot tell which they got.
 */
export function assetProductionGuidance(outcome: AssetProductionOutcome | null): string[] {
  if (!outcome) {
    return [
      'Asset production: not run (no project path in this context).',
      'Run one directly with: node bin/sidecoach-image.js generate --prompt "<brief>" --out <file.png>',
    ];
  }
  const head = `Asset production: ${outcome.status.toUpperCase()}.`;
  const lines = [head, outcome.detail];

  if (outcome.compiled) {
    const c = outcome.compiled;
    lines.push(
      `Compiled from a brief that supplied ${c.briefStrength.score}% of the ten resolvable dimensions; the concept and composition layer supplied the rest:`,
      ...c.briefStrength.supplied.map((s) => `  - ${s}`),
    );
    if (c.briefStrength.missing.length > 0) {
      lines.push('Gaps nothing could supply, each one weakening a named check:', ...c.briefStrength.missing.map((m) => `  - ${m}`));
    }
  }

  switch (outcome.status) {
    case 'verified':
      lines.push(
        `The asset is at ${outcome.path}`,
        `Produced by ${outcome.provider}${outcome.model ? ` (${outcome.model})` : ''} at ${
          typeof outcome.costUsd === 'number' ? outcome.costUsd.toFixed(4) : 'an unrecorded'
        } USD (${outcome.costBasis || 'basis unrecorded'}).`,
      );
      if (outcome.synthetic) {
        lines.push(
          'Its bytes carry the offline synthetic marker: this is a verified PNG and it is NOT art. Use it as a layout stand-in only, and set SIDECOACH_IMAGE_PROVIDER plus SIDECOACH_IMAGE_ALLOW_SPEND=1 for a live render.',
        );
      }
      break;
    case 'failed':
      if (outcome.path) lines.push(`The bytes were still written to ${outcome.path} so they can be looked at; they are NOT offered to the build.`);
      if (outcome.synthetic) {
        lines.push(
          'The failing bytes are the deterministic placeholder, whose colours come from the prompt hash, so this is not a verdict on the design and it does not block the build. Re-run with a live provider to measure the real asset.',
        );
      } else if (outcome.providerSubstituted) {
        lines.push(
          'Every failing check is the provider substituting what it was asked for: it answered in a different format or a different pixel geometry. The prompt is not the problem.',
          'The consequence is specific and it is not cosmetic: this repository decodes PNG only, so a JPEG answer means the pixel checks did not run, and the overlay-contrast measurement in particular produced no number at all.',
          'To get a fully verified asset, use a provider that returns PNG at the requested geometry. Until then this row stays open, which is the honest state rather than a pass.',
        );
      }
      break;
    case 'unverified':
      if (outcome.path) lines.push(`The bytes were still written to ${outcome.path} so they can be looked at; they are NOT offered to the build.`);
      break;
    case 'needs-consent':
      lines.push(
        'A live provider was configured with no spend signal. Set SIDECOACH_IMAGE_ALLOW_SPEND=1 to authorize the charge, or leave the provider unset to use the offline renderer.',
      );
      break;
    case 'no-key':
      lines.push('The configured live provider has no API key in the environment. Nothing was spent.');
      break;
    case 'budget':
      lines.push('The spend cap stopped this call, or a completed call landed above it. Check the ledger with: node bin/sidecoach-image.js budget');
      break;
    case 'not-needed':
      lines.push(
        'To ask for one explicitly, name the asset in the request ("with a full-bleed backdrop", "a tiling texture", "a thumbnail plate").',
      );
      break;
    default:
      break;
  }
  return lines;
}

/**
 * The checklist row for the asset step.
 *
 * SEVERITY IS PROVENANCE-AWARE, AND THE MEASUREMENT IS NOT. This is the one subtle rule here, so it is written
 * down rather than inferred:
 *
 *   - The contrast measurement always runs and is always reported verbatim, whatever produced the bytes.
 *   - A LIVE render that fails is REQUIRED and incomplete: a hard blocker. Those are the bytes that ship, and a
 *     hero whose headline is unreadable must stop the build.
 *   - A SYNTHETIC placeholder that fails is reported with the same number but does not block. Its colours are
 *     derived from a prompt hash, so its contrast is the stand-in's luck rather than a fact about the design, and
 *     blocking a build on it would block nothing real while training everyone to ignore this row. The guidance
 *     line names the placeholder and the next action.
 *
 * The distinction is drawn from the marker inside the PNG, not from what the caller claims, so it cannot be
 * gamed by renaming a file into the position of a real render.
 */
export function assetProductionChecklistItem(
  outcome: AssetProductionOutcome | null,
  /**
   * Whether the brief actually asked for a raster. Only consulted when the lens did not run at all.
   *
   * Codex review 2026-07-29, finding 4: a null outcome was rendered as completed, but null means the step never
   * ran. A raster request in a context with no project path therefore showed the asset row as DONE while nothing
   * had happened, which is precisely the false pass this row exists to prevent. Not-run is now only complete when
   * there was nothing to do.
   */
  wantedRaster = false,
): {
  id: string;
  label: string;
  required: boolean;
  description: string;
  completed: boolean;
} {
  const id = 'asset-production';
  const label = 'Raster assets produced and verified';
  if (!outcome) {
    return {
      id,
      label,
      required: wantedRaster,
      description: wantedRaster
        ? 'the brief asked for a raster and the asset step DID NOT RUN (no project path to write into), so nothing was produced and nothing is claimed'
        : 'not run (no project path), and the brief asked for no raster',
      completed: !wantedRaster,
    };
  }
  if (outcome.status === 'not-needed') {
    return { id, label, required: false, description: outcome.detail, completed: true };
  }
  const verified = outcome.status === 'verified';
  if (outcome.synthetic && !verified) {
    return {
      id,
      label,
      required: false,
      description: `${outcome.detail} This is the deterministic placeholder, whose colours come from the prompt hash, so this verdict does not block the build. A live render is required before the asset ships.`,
      completed: false,
    };
  }
  return { id, label, required: true, description: outcome.detail, completed: verified };
}
