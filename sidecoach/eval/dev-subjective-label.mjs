#!/usr/bin/env node
/**
 * Stage 1 ST0: SUBJECTIVE labeling of the frozen DEV CORPUS (the 22 self-contained captures under corpus/dev/).
 *
 * This is the DEV-corpus sibling of subjective-label-harness.mjs (which targets the frozen 90 / candidates.json).
 * Held-out discipline: the dev corpus is the DEV SIGNAL (disjoint from the frozen 90, fail-closed tested); labels
 * here set the subjective ground truth that ST1 detectors develop against. author != labeler: CODEX (independent
 * model via `codex exec`) produces every label; this script only renders the screenshot + builds the prompt +
 * records the verdict. Reuses subjective-label-harness's rubric + prompt builder + parser so the dev labels use
 * the IDENTICAL rubric/signal taxonomy as the frozen-90 pass.
 *
 * RENDER-BASIS PARITY (lead condition 6): the screenshot is rendered at the SAME hermetic settings the rendered
 * detectors read - viewport 1280x800, reducedMotion, deviceScaleFactor 1, scripts stripped, external aborted to
 * data:/about:, animations zeroed - so the image the labeler judges and the computed-style the detector reads come
 * from one capture at one render.
 *
 * SINK: corpus/dev-subjective-labels.json (NEVER candidates.json, NEVER dev-labels.json - the latter is the dev
 * corpus's OBJECTIVE referee GT and must not be clobbered).
 *
 * BOUNDED EXEC: every `codex exec` is wrapped with a hard per-page timeout (a raw codex exec wedged for 2h on
 * 2026-06-24; the lesson is bound it, not avoid it). A page whose codex call times out is recorded failed and
 * retried on --resume, never silently dropped.
 *
 * Usage: dev-subjective-label.mjs (--all | --page <id>) [--resume] [--dry-run] [--timeout-ms N]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rubricInfo, buildPrompt, parseVerdict } from './subjective-label-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CORPUS = path.join(HERE, 'corpus');
// Default = the DEV corpus. Overridable via --dir/--manifest/--sink so the IDENTICAL rubric/prompt/parser/render
// pipeline can label a SEPARATE held-out corpus into its own sink (lead-held; labeling stays Codex, author!=labeler).
let DEV = path.join(CORPUS, 'dev');
let MANIFEST = path.join(CORPUS, 'dev-manifest.json');
let SINK = path.join(CORPUS, 'dev-subjective-labels.json');
let SHOTS = path.join(CORPUS, '.shots'); // derived screenshots (gitignored; regenerated deterministically)

// Signal taxonomy MIRRORS subjective-label-harness.mjs (18 screenshot / 2 text / 2 motion). Kept in sync by hand;
// buildPrompt already encodes the same split into the prompt, this is only for the recorded `signal` field.
const VISUAL = new Set(['cream-palette', 'ai-color-palette', 'hero-eyebrow-chip', 'repeated-section-kickers', 'numbered-section-markers', 'icon-tile-stack', 'italic-serif-display', 'nested-cards', 'side-stripe-borders', 'glassmorphism-default', 'hero-metric-template', 'gradient-text', 'dark-glow', 'tiny-text', 'wide-tracking', 'all-caps-body', 'tight-leading', 'extreme-negative-tracking']);
const TEXTUAL = new Set(['marketing-buzzword', 'aphoristic-cadence']);
const signalOf = (cls) => VISUAL.has(cls) ? 'screenshot' : TEXTUAL.has(cls) ? 'text' : 'motion';

const ANIM_OFF = '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}';
function stripScripts(html) { return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, ''); }

/** Deterministic full-page screenshot of a dev capture at DETECTOR render parity (1280x800 hermetic). */
async function renderDevScreenshot(id) {
  const { chromium } = await import('playwright');
  const html = readFileSync(path.join(DEV, `${id}.html`), 'utf8');
  mkdirSync(SHOTS, { recursive: true });
  const out = path.join(SHOTS, `dev-${id}.png`);
  const b = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.addStyleTag({ content: ANIM_OFF });
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally { await b.close(); }
}

function loadSink() { return existsSync(SINK) ? JSON.parse(readFileSync(SINK, 'utf8')) : { generatedUtc: null, note: 'DEV-CORPUS SUBJECTIVE labels (Codex, author!=labeler). Render-basis parity 1280x800 hermetic. DEV SIGNAL, not the held-out bar.', labels: {} }; }
function saveSink(s) { s.generatedUtc = new Date().toISOString(); writeFileSync(SINK, JSON.stringify(s, null, 2) + '\n'); }

function recordDevLabels(sink, id, verdict, sha) {
  const labels = Object.entries(verdict).map(([cls, v]) => ({
    class: cls, present: !!v.present, confidence: v.confidence ?? null, note: v.note ?? null,
    labeledBy: 'codex', signal: signalOf(cls), rubricSha: sha, labeledUtc: new Date().toISOString(),
  }));
  if (labels.some((l) => l.labeledBy !== 'codex')) throw new Error('refused: dev labeler records labeledBy=codex only');
  sink.labels[id] = { status: 'labeled-codex', labels };
  return labels.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const all = args.includes('--all');
  const resume = args.includes('--resume');
  const pi = args.indexOf('--page');
  const ti = args.indexOf('--timeout-ms');
  const TIMEOUT_MS = ti >= 0 ? parseInt(args[ti + 1], 10) : 240000; // bounded exec (no 2h hangs)
  // Optional corpus override (label a separate held-out with the SAME pipeline). --dir is the html dir; --manifest
  // its page manifest; --sink the labels file. SHOTS derives from --dir's parent so screenshots stay separate.
  const di = args.indexOf('--dir'); const mi = args.indexOf('--manifest'); const si = args.indexOf('--sink');
  if (di >= 0) { DEV = path.resolve(args[di + 1]); SHOTS = path.join(path.dirname(DEV), '.shots'); }
  if (mi >= 0) MANIFEST = path.resolve(args[mi + 1]);
  if (si >= 0) SINK = path.resolve(args[si + 1]);
  const { sha, classes } = rubricInfo();
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const devIds = (manifest.pages || []).filter((p) => !p.failed).map((p) => p.id);
  const ids = all ? devIds : pi >= 0 ? [args[pi + 1]] : [];
  if (!ids.length) { console.error('usage: dev-subjective-label.mjs (--all | --page <id>) [--resume] [--dry-run] [--timeout-ms N]'); process.exit(2); }
  const sink = loadSink();
  console.error(`rubric SHA ${sha.slice(0, 12)} | ${classes.length} classes | ${ids.length} dev page(s) | ${dry ? 'DRY-RUN' : 'LIVE (Codex vision, ' + TIMEOUT_MS + 'ms/page)'}${resume ? ' | --resume' : ''}`);
  let labeled = 0, skipped = 0; const failed = [];
  for (const id of ids) {
    if (resume && sink.labels[id] && sink.labels[id].status === 'labeled-codex') { skipped++; console.error(`  skip ${id} (already labeled)`); continue; }
    try {
      const html = readFileSync(path.join(DEV, `${id}.html`), 'utf8');
      const shot = await renderDevScreenshot(id);
      const prompt = buildPrompt(id, html);
      if (dry) { console.log(`\n=== ${id} ===\nscreenshot: ${shot}\ninvocation: codex exec --sandbox read-only --skip-git-repo-check -i ${path.basename(shot)} (prompt ${prompt.length} chars, ${TIMEOUT_MS}ms bound)\nprompt head: ${prompt.slice(0, 160)}...`); continue; }
      const out = execSync(`codex exec --sandbox read-only --skip-git-repo-check -i ${JSON.stringify(shot)}`, { cwd: ROOT, input: prompt, encoding: 'utf8', maxBuffer: 1 << 24, timeout: TIMEOUT_MS });
      const n = recordDevLabels(sink, id, parseVerdict(out), sha);
      saveSink(sink); // persist after EACH page so a later hang never loses earlier labels
      labeled++; console.error(`  labeled ${id}: ${n} classes`);
    } catch (e) {
      failed.push(id); console.error(`  FAILED ${id}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    }
  }
  if (!dry) {
    console.error(`\nSUMMARY: labeled ${labeled} | skipped ${skipped} | failed ${failed.length}${failed.length ? ` [${failed.join(', ')}]` : ''}`);
    console.error(failed.length ? `re-run \`--all --resume\` to retry the ${failed.length} failure(s).` : 'all targeted dev pages labeled.');
  }
}
