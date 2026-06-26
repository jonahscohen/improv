#!/usr/bin/env node
/**
 * Contract-6 SUBJECTIVE-LABELING HARNESS (Stage 0) - the PIPE for the lead-run Codex labeling pass.
 *
 * Division of labor (Jonah + lead): the architect builds this infra (the pipe) but does NOT produce labels.
 * The LEAD runs it; Codex (independent model, gpt-5.x via `codex exec`) sets the SUBJECTIVE ground truth for
 * the 22 held classes. Labels recorded labeledBy=codex with the finalized rubric's content-SHA + invocation,
 * so the pass is reproducible and the freeze gate (author!=labeler) can verify independence.
 *
 * SIGNAL per class (lead-finalized rubric "LABELING SIGNAL" section): ~18 classes are VISUAL gestalt -> the
 * RENDERED SCREENSHOT is the primary signal (judging from CSS text is the mentally-render unreliability the
 * objective labeler was rebuilt to avoid); 2 are TEXTUAL (page copy); 2 are MOTION (animation/transition
 * character in markup - a static image can't show motion). So the harness gives Codex: (a) a deterministic
 * full-page SCREENSHOT via `-i` (vision-verified: codex sees it + judged known cream/gradient cases right),
 * (b) the page's visible TEXT sample, (c) the page's MOTION declarations. Vision path = same independent
 * model family (codex/gpt) - satisfies Jonah's independent-model ruling AND the vision requirement.
 *
 * GUARDS: records labeledBy=codex ONLY (architect can't self-label); records rubricSha + model + utc +
 * screenshot. --dry-run renders the screenshot + prints the invocation WITHOUT calling Codex (architect
 * pipe-verification only - produces no labels). The LEAD runs the real pass.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CORPUS = path.join(HERE, 'corpus');
const CANDIDATES = path.join(CORPUS, 'candidates.json');
const RUBRIC = path.join(CORPUS, 'subjective-rubric.md');
const SHOTS = path.join(CORPUS, '.shots'); // derived screenshots (gitignored; regenerated deterministically)

const VISUAL = new Set(['cream-palette', 'ai-color-palette', 'hero-eyebrow-chip', 'repeated-section-kickers', 'numbered-section-markers', 'icon-tile-stack', 'italic-serif-display', 'nested-cards', 'side-stripe-borders', 'glassmorphism-default', 'hero-metric-template', 'gradient-text', 'dark-glow', 'tiny-text', 'wide-tracking', 'all-caps-body', 'tight-leading', 'extreme-negative-tracking']);
const TEXTUAL = new Set(['marketing-buzzword', 'aphoristic-cadence']);
const MOTION = new Set(['layout-transition', 'bounce-easing']);

export function rubricInfo() {
  const text = readFileSync(RUBRIC, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const classes = [...text.matchAll(/^-\s+([a-z][a-z0-9-]+):\s+(.+)$/gim)].map((m) => ({ class: m[1], desc: m[2].trim() }));
  // dedupe (the LABELING SIGNAL section re-lists class names in prose; keep only the definition bullets)
  const seen = new Set(); const defs = [];
  for (const c of classes) { if (!seen.has(c.class) && /[a-z]/.test(c.desc) && c.desc.length > 20) { seen.add(c.class); defs.push(c); } }
  return { sha, classes: defs, text };
}

const ANIM_OFF = '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}';
function stripScripts(html) { return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, ''); }

/** Deterministic full-page screenshot of the captured (script-stripped) page. Returns the PNG path. */
export async function renderScreenshot(pageId) {
  const { chromium } = await import('playwright');
  const html = readFileSync(path.join(CORPUS, 'candidates', `${pageId}.html`), 'utf8');
  mkdirSync(SHOTS, { recursive: true });
  const out = path.join(SHOTS, `${pageId}.png`);
  const b = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: ANIM_OFF });
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally { await b.close(); }
}

function visibleTextSample(html) {
  const body = (/(<body[\s\S]*<\/body>)/i.exec(html) || [html])[0];
  return body.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
}
function motionDeclarations(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const lines = [...css.matchAll(/[^{};]*(transition|animation|@keyframes|cubic-bezier|bounce|elastic)[^{};]*[;{]/gi)].map((m) => m[0].trim());
  return [...new Set(lines)].slice(0, 40).join('\n').slice(0, 1500) || '(no explicit motion declarations found)';
}

export function buildPrompt(pageId, html) {
  const { classes } = rubricInfo();
  const line = (c) => `- ${c.class} [${VISUAL.has(c.class) ? 'SCREENSHOT' : TEXTUAL.has(c.class) ? 'TEXT' : 'MOTION'}]: ${c.desc}`;
  return `You are an INDEPENDENT design labeler with no stake in any tool. Judge whether each design idiom is `
    + `PRESENT or ABSENT on THIS page, using ONLY the neutral descriptions below and the signal noted per class:\n`
    + `- [SCREENSHOT] classes: judge from the ATTACHED rendered screenshot (what the page LOOKS like). Do not parse CSS.\n`
    + `- [TEXT] classes: judge from the page COPY below.\n`
    + `- [MOTION] classes: judge from the MOTION declarations below (a static image can't show motion).\n`
    + `Do not infer which tool or author made the page. Output ONLY JSON keyed by class name, each value `
    + `{"present":true|false,"confidence":0..1,"note":"<=12 words"}. Include all ${classes.length} classes.\n\n`
    + `CLASSES:\n${classes.map(line).join('\n')}\n\nPAGE COPY (for TEXT classes):\n${visibleTextSample(html)}\n\n`
    + `MOTION DECLARATIONS (for MOTION classes):\n${motionDeclarations(html)}`;
}

export function parseVerdict(output) {
  const m = output.match(/\{[\s\S]*\}/g);
  if (!m) throw new Error('no JSON object in Codex output');
  return JSON.parse(m[m.length - 1]);
}

export function recordLabels(pageId, verdict, { sha, model = 'codex', shot }) {
  const man = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
  const c = man.find((x) => x.id === pageId);
  if (!c) throw new Error(`no page ${pageId}`);
  const labels = Object.entries(verdict).map(([cls, v]) => ({
    class: cls, present: !!v.present, confidence: v.confidence ?? null, note: v.note ?? null,
    labeledBy: 'codex', signal: VISUAL.has(cls) ? 'screenshot' : TEXTUAL.has(cls) ? 'text' : 'motion',
    method: 'screenshot-vision+text+motion', rubricSha: sha, model, screenshot: shot ? path.basename(shot) : null, labeledUtc: new Date().toISOString(),
  }));
  if (labels.some((l) => l.labeledBy !== 'codex')) throw new Error('refused: harness records labeledBy=codex only');
  c.subjectiveLabels = labels;
  c.subjectiveStatus = 'labeled-codex';
  writeFileSync(CANDIDATES, JSON.stringify(man, null, 2) + '\n');
  return labels.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const all = args.includes('--all');
  const resume = args.includes('--resume'); // skip pages already labeled-codex (don't re-pay)
  const pi = args.indexOf('--page');
  const { sha, classes } = rubricInfo();
  const man = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
  const byId = new Map(man.map((c) => [c.id, c]));
  const ids = all ? man.map((c) => c.id) : pi >= 0 ? [args[pi + 1]] : [];
  if (!ids.length) { console.error('usage: subjective-label-harness.mjs (--page <id> | --all) [--resume] [--dry-run]'); process.exit(2); }
  console.error(`rubric SHA ${sha.slice(0, 12)} | ${classes.length} classes (18 screenshot / 2 text / 2 motion) | ${ids.length} page(s) | ${dry ? 'DRY-RUN' : 'LIVE (Codex vision)'}${resume ? ' | --resume' : ''}`);
  let labeled = 0, skipped = 0; const failed = [];
  for (const id of ids) {
    const rec = byId.get(id);
    if (resume && rec && rec.subjectiveStatus === 'labeled-codex') { skipped++; console.error(`  skip ${id} (already labeled-codex)`); continue; }
    try {
      const html = readFileSync(path.join(CORPUS, 'candidates', `${id}.html`), 'utf8');
      const shot = await renderScreenshot(id);
      const prompt = buildPrompt(id, html);
      if (dry) { console.log(`\n=== ${id} ===\nscreenshot: ${shot}\ninvocation: echo <prompt ${prompt.length} chars> | codex exec --sandbox read-only --skip-git-repo-check -i ${path.basename(shot)}\nprompt head: ${prompt.slice(0, 200)}...`); continue; }
      // LEAD runs this branch: prompt via stdin, screenshot via -i (vision-verified).
      const out = execSync(`codex exec --sandbox read-only --skip-git-repo-check -i ${JSON.stringify(shot)}`, { cwd: ROOT, input: prompt, encoding: 'utf8', maxBuffer: 1 << 24 });
      const n = recordLabels(id, parseVerdict(out), { sha, shot });
      labeled++; console.error(`  labeled ${id}: ${n} classes (codex vision)`);
    } catch (e) {
      // CONTINUE-ON-ERROR: a transient codex/render failure on one page must not abort the run.
      failed.push(id); console.error(`  FAILED ${id}: ${e instanceof Error ? e.message.slice(0, 140) : e}`);
    }
  }
  if (!dry) {
    console.error(`\nSUMMARY: labeled ${labeled} | skipped(resume) ${skipped} | failed ${failed.length}${failed.length ? ` [${failed.join(', ')}]` : ''}`);
    console.error(failed.length ? `re-run \`--all --resume\` to retry the ${failed.length} failure(s) without re-paying completed pages.` : 'all targeted pages labeled.');
  }
}
