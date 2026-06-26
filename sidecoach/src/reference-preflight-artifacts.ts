// Lane-start reference preflight bundle (deliverable B).
//
// gatherReferencePreflightArtifacts() queries ALL five reference systems at lane
// START (component patterns, font candidates, LIVE design-references matched to
// PRODUCT.md voice, motion easings, icon-source) and returns them as artifacts so a
// build/refinement lane surfaces reference grounding REGARDLESS of which verbs its
// chain happens to route. It reuses the existing ReferenceSystemPreFlight fallback
// getters (so each system soft-fails to cached/safe data independently), runs every
// probe under Promise.allSettled, and bounds the whole gather with a timeout so a
// slow/never-settling system can never hang lane start.
//
// This lives in a DEDICATED consumer module (not reference-system-preflight.ts) so the
// preflight health/fallback layer stays factory-injected and free of concrete
// composition imports (ReferenceSystemsFactoryImpl, context-loader, icon-source-
// reference) - removing any import-cycle hazard. (Codex review 2026-06-23, finding 3.)

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createReferenceSystemPreFlight } from './reference-system-preflight';
import { ReferenceSystemsFactoryImpl } from './reference-systems';
import { createIconSourceReference, buildIconSourceArtifactContent } from './icon-source-reference';
import { buildProjectContext } from './context-loader';
import type { Register } from './project-context';

export interface ReferencePreflightArtifact {
  kind: 'component' | 'fonts' | 'design-references' | 'motion' | 'icon-source' | 'visual-effects' | 'tilt-lab';
  title: string;
  content: string;
  source: string;
}

export interface ReferencePreflightBundle {
  artifacts: ReferencePreflightArtifact[];
  warnings: string[];
}

// Overall budget for the ASYNC portion of the gather. Deliberately LARGER than the
// inner per-system health-check timeout (5000ms in ReferenceSystemPreFlight) so a slow
// live system still has room to fall back to embedded data before this fires (Codex
// review 2026-06-23, finding 3). On expiry the already-settled artifacts are returned
// with a timeout warning - the lane never blocks. (Synchronous reads in the probes are
// separately bounded: skill reads are stat-capped; ReferenceDataService/buildProjectContext
// sync reads are the same ones a normal lane already performs.)
const PREFLIGHT_TIMEOUT_MS = 8000;

const STOPWORDS = new Set(['and', 'the', 'a', 'an', 'but', 'with', 'for', 'of', 'to', 'or', 'not']);
const COMPONENT_NOUNS = [
  'button', 'modal', 'dialog', 'drawer', 'dropdown', 'tooltip', 'popover', 'card',
  'hero', 'banner', 'carousel', 'navbar', 'sidebar', 'footer', 'menu', 'form',
  'table', 'tabs', 'accordion', 'toast', 'badge', 'avatar', 'breadcrumb',
];

function shortErr(e: unknown): string {
  return String(e instanceof Error ? e.message : e).substring(0, 120);
}

// Voice words from a free-form brandPersonality string ("clean, editorial, precise").
function voiceWordsFrom(brandPersonality?: string): string[] {
  if (!brandPersonality) return [];
  return [...new Set(
    brandPersonality
      .toLowerCase()
      .split(/[\s,;/|]+/)
      .map((w) => w.replace(/[^a-z-]/g, '').trim())
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )].slice(0, 8);
}

// Read a standalone Claude skill's SKILL.md (READ-ONLY) and turn it into a concise
// attached artifact. Strips YAML frontmatter, caps the body. Soft-fails to null when
// the skill is absent (e.g. an isolated test HOME). Constraint D: we only READ these
// skills, never modify them.
function readSkillArtifact(
  skillName: string,
  kind: ReferencePreflightArtifact['kind'],
  title: string,
  maxChars = 1800,
): ReferencePreflightArtifact | null {
  // Hard-coded skill names only (no caller-controlled traversal). Stat first and skip a
  // missing/non-file/pathologically-large SKILL.md so a synchronous read cannot stall
  // lane start (Codex review 2026-06-23, findings 1 + 5).
  const p = path.join(os.homedir(), '.claude', 'skills', skillName, 'SKILL.md');
  let raw: string;
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 256 * 1024) return null;
    raw = fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
  const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
  if (!body) return null;
  const content = body.length > maxChars ? `${body.slice(0, maxChars)}\n... [truncated; see ${skillName} skill]` : body;
  return { kind, title, source: `~/.claude/skills/${skillName}/SKILL.md (read-only)`, content };
}

// Most salient component noun in the lane target, default 'button' (the catalog's
// densest, always-populated type - a safe non-empty probe).
function componentHintFrom(target?: string): string {
  if (!target) return 'button';
  const lower = target.toLowerCase();
  for (const noun of COMPONENT_NOUNS) {
    if (new RegExp(`(?<![\\w-])${noun}s?(?![\\w-])`).test(lower)) return noun;
  }
  return 'button';
}

export async function gatherReferencePreflightArtifacts(opts: {
  projectPath: string;
  register?: Register;
  target?: string;
}): Promise<ReferencePreflightBundle> {
  const artifacts: ReferencePreflightArtifact[] = [];
  const warnings: string[] = [];

  // Resolve register + voice from PRODUCT.md (soft - never throws out).
  let register: Register = opts.register ?? 'product';
  let brandPersonality: string | undefined;
  try {
    const ctx = buildProjectContext(opts.projectPath);
    register = (opts.register ?? ctx.register ?? 'product') as Register;
    // Read both camelCase and snake_case product shapes (handlers support both).
    brandPersonality = ctx.product?.brandPersonality ?? (ctx.product as any)?.brand_personality;
  } catch (e) {
    warnings.push(`project-context: ${shortErr(e)}`);
  }

  const voice = voiceWordsFrom(brandPersonality);
  const voiceQuery = voice.join(' ') || (opts.target ?? 'modern');
  const componentHint = componentHintFrom(opts.target);
  const preflight = createReferenceSystemPreFlight(new ReferenceSystemsFactoryImpl());

  const probes: Promise<void>[] = [
    (async () => {
      const cg = await preflight.getComponentGalleryWithFallback();
      const patterns = await cg.getComponentPatterns(componentHint, register);
      if (patterns.length) {
        artifacts.push({
          kind: 'component', source: 'component.gallery',
          title: `Component patterns: ${componentHint}`,
          content: patterns.map((p) => `${p.name}: ${p.description}`).join('\n'),
        });
      } else {
        warnings.push(`component-gallery: no patterns for "${componentHint}"`);
      }
    })().catch((e) => void warnings.push(`component-gallery: ${shortErr(e)}`)),

    (async () => {
      const fonts = await preflight.getFontshareWithFallback();
      const candidates = await fonts.getFontCandidates('sans-serif', register);
      const pairing = await fonts.getPairingRules(brandPersonality || 'default');
      if (candidates.length || pairing.length) {
        artifacts.push({
          kind: 'fonts', source: 'fontshare.com',
          title: 'Font candidates + pairing rules',
          content: [
            ...candidates.map((c) => `${c.name} (${c.category}, weights ${c.weights.join(',')})`),
            '', 'Pairing rules:', ...pairing,
          ].join('\n'),
        });
      }
    })().catch((e) => void warnings.push(`fontshare: ${shortErr(e)}`)),

    (async () => {
      const dr = await preflight.getDesignReferencesWithFallback();
      // Query per individual voice token and merge/dedupe by title - searchReferences does
      // substring matching, so a joined phrase ("clean editorial precise") misses refs
      // tagged with only one word (Codex review 2026-06-23, finding 4).
      const tokens = voice.length ? voice : [voiceQuery];
      const byTitle = new Map<string, { title: string; category: string; sourceUrl?: string }>();
      for (const tok of tokens) {
        for (const r of await dr.searchReferences(tok, register, 5)) {
          if (!byTitle.has(r.title)) byTitle.set(r.title, r);
        }
        if (byTitle.size >= 5) break;
      }
      const refs = [...byTitle.values()].slice(0, 5);
      if (refs.length) {
        artifacts.push({
          kind: 'design-references', source: '~/.claude/design-references (live)',
          title: `Live design references matched to voice (${voice.join(', ') || voiceQuery})`,
          content: refs.map((r) => `${r.title} [${r.category}]${r.sourceUrl ? ' - ' + r.sourceUrl : ''}`).join('\n'),
        });
      } else {
        warnings.push(`design-references: no live catalog match for voice "${voiceQuery}"`);
      }
    })().catch((e) => void warnings.push(`design-references: ${shortErr(e)}`)),

    (async () => {
      const mr = await preflight.getMotionReferenceWithFallback();
      const intensity = register === 'brand' ? 'playful' : 'restrained';
      const easings = await mr.getEasingCurves(intensity as 'restrained' | 'playful' | 'ambitious');
      if (easings.length) {
        artifacts.push({
          kind: 'motion', source: 'motion-reference (GSAP/Lenis)',
          title: `Motion easings (${intensity})`,
          content: easings.map((e) => `${e.name}: ${e.easing} (${e.duration}ms, ${e.useCase})`).join('\n'),
        });
      }
    })().catch((e) => void warnings.push(`motion: ${shortErr(e)}`)),

    (async () => {
      const content = buildIconSourceArtifactContent(createIconSourceReference());
      if (content && content.trim()) {
        artifacts.push({
          kind: 'icon-source', source: 'icon-source (8 approved libraries)',
          title: 'Icon source libraries + selection protocol',
          content,
        });
      }
    })().catch((e) => void warnings.push(`icon-source: ${shortErr(e)}`)),

    // Deliverable C: reference-dependent skills attached as ADDITIONAL artifacts
    // (additive, soft-fail). Sourced read-only from the standalone skills so a hero/
    // section that wants a generative/shader background or a tuned tilt-lab export has
    // that grounding surfaced at lane start too.
    (async () => {
      const a = readSkillArtifact('visual-effects', 'visual-effects', 'Visual effects (generative shader backgrounds + transformative FX)');
      if (a) artifacts.push(a);
      else warnings.push('visual-effects: skill not found (optional, read-only)');
    })().catch((e) => void warnings.push(`visual-effects: ${shortErr(e)}`)),

    (async () => {
      const a = readSkillArtifact('tilt-lab', 'tilt-lab', 'tilt-lab (visual-effects workbench: audition + export shader backgrounds)');
      if (a) artifacts.push(a);
      else warnings.push('tilt-lab: skill not found (optional, read-only)');
    })().catch((e) => void warnings.push(`tilt-lab: ${shortErr(e)}`)),
  ];

  // Bound the gather: whichever of (all probes settled) / (timeout) wins, we return
  // the artifacts accumulated so far. Probes push into the shared arrays as they
  // resolve, so a timeout yields a partial-but-valid bundle - never a hang.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      warnings.push(`reference-preflight: timed out after ${PREFLIGHT_TIMEOUT_MS}ms - returning partial bundle`);
      resolve();
    }, PREFLIGHT_TIMEOUT_MS);
    if (typeof (timer as any)?.unref === 'function') (timer as any).unref();
  });
  await Promise.race([Promise.allSettled(probes).then(() => undefined), timeout]);
  if (timer) clearTimeout(timer);

  // Stable, predictable artifact order.
  const order: ReferencePreflightArtifact['kind'][] = ['component', 'fonts', 'design-references', 'motion', 'icon-source', 'visual-effects', 'tilt-lab'];
  artifacts.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  // Return CLONED snapshots so any probe that settles AFTER a timeout cannot mutate the
  // bundle the caller already received (Codex review 2026-06-23, finding 2).
  return { artifacts: [...artifacts], warnings: [...warnings] };
}
