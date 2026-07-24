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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rubricInfo, buildPrompt, parseVerdict, validateVerdict, renderAndExtract, opaqueShotName, assertNoLeak, assertPromptClean, assertExtractionComplete, assertNoFamilyLeak, codexLabel, signalCounts, signalOfClass, LABEL_METHOD } from './subjective-label-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// NOTE: there is deliberately no ROOT here any more. `codex exec` used to run with cwd=<repo root>, which put
// the fixture dir, the manifests and the labels sink inside its read-only sandbox - the answer key, reachable
// by a labeler that was supposed to be independent. codexLabel() now stages the opaque screenshot into a
// throwaway dir outside the repo and runs there.
const CORPUS = path.join(HERE, 'corpus');
// Default = the DEV corpus. Overridable via --dir/--manifest/--sink so the IDENTICAL rubric/prompt/parser/render
// pipeline can label a SEPARATE held-out corpus into its own sink (lead-held; labeling stays Codex, author!=labeler).
let DEV = path.join(CORPUS, 'dev');
let MANIFEST = path.join(CORPUS, 'dev-manifest.json');
let SINK = path.join(CORPUS, 'dev-subjective-labels.json');
let SHOTS = path.join(CORPUS, '.shots'); // derived screenshots (gitignored; regenerated deterministically)

// Signal taxonomy is IMPORTED from subjective-label-harness.mjs (signalOfClass), not re-declared. The old
// hand-synced duplicate map was exactly how the 2026-07-24 declared-stack relabel recorded signal:'screenshot'
// while the prompt correctly used TYPEFACE - a duplicate that has to be "kept in sync by hand" eventually is not.
const signalOf = signalOfClass;

/**
 * Deterministic full-page screenshot + CSSOM typeface facts for a dev capture at DETECTOR render parity
 * (1280x800 hermetic), written under an OPAQUE filename.
 *
 * The filename used to be `dev-<id>.png`, and the id states the answer: the polarity prefix (p.. or n..) plus
 * a plain-English scenario ("webfont-declared-never-applied", "brand-mismatch-negative"). That name was passed
 * to `codex exec -i`, i.e. straight into the labeler's argv, so the "independent" label was produced by a
 * model that had been told the verdict. That is the leak that withdrew the A5a ship call.
 */
async function renderDevScreenshot(id) {
  const html = readFileSync(path.join(DEV, `${id}.html`), 'utf8');
  return renderAndExtract(html, path.join(SHOTS, opaqueShotName(id)), { width: 1280, height: 800 });
}
/** id <-> opaque-shot map, kept OUT of the labeler's sandbox but on disk so a run stays auditable. */
function writeShotMap(entries) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(path.join(SHOTS, 'opaque-shot-map.json'),
    JSON.stringify({ note: 'internal id -> opaque attachment map. NEVER staged into the labeler cwd.', generatedUtc: new Date().toISOString(), map: entries }, null, 2) + '\n');
}

function loadSink() { return existsSync(SINK) ? JSON.parse(readFileSync(SINK, 'utf8')) : { generatedUtc: null, note: 'DEV-CORPUS SUBJECTIVE labels (Codex, author!=labeler). Render-basis parity 1280x800 hermetic. DEV SIGNAL, not the held-out bar.', labels: {} }; }
function saveSink(s) { s.generatedUtc = new Date().toISOString(); writeFileSync(SINK, JSON.stringify(s, null, 2) + '\n'); }

function recordDevLabels(sink, id, verdict, sha, attachment, containment) {
  const labels = Object.entries(verdict).map(([cls, v]) => ({
    class: cls, present: !!v.present, confidence: v.confidence ?? null, note: v.note ?? null,
    labeledBy: 'codex', signal: signalOf(cls), method: LABEL_METHOD, attachment: attachment ?? null,
    containment: containment ?? null, rubricSha: sha, labeledUtc: new Date().toISOString(),
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
  console.error(`rubric SHA ${sha.slice(0, 12)} | ${classes.length} classes (${signalCounts()}) | ${ids.length} dev page(s) | ${dry ? 'DRY-RUN' : 'LIVE (Codex vision, ' + TIMEOUT_MS + 'ms/page)'}${resume ? ' | --resume' : ''}`);
  let labeled = 0, skipped = 0; const failed = []; const shotMap = {};
  for (const id of ids) {
    if (resume && sink.labels[id] && sink.labels[id].status === 'labeled-codex') { skipped++; console.error(`  skip ${id} (already labeled)`); continue; }
    try {
      const html = readFileSync(path.join(DEV, `${id}.html`), 'utf8');
      const { shot, facts } = await renderDevScreenshot(id);
      const attachment = assertNoLeak(id, shot);        // fail-loud if the attachment name carries id/polarity
      shotMap[id] = attachment;
      assertExtractionComplete(facts);                  // fail-loud if any stylesheet was unreadable/blocked
      assertNoFamilyLeak(facts);                        // fail-loud if a family name states the verdict
      const prompt = buildPrompt(id, html, facts);
      assertPromptClean(id, prompt);                    // fail-loud if the prompt body carries the slug/polarity
      if (dry) { console.log(`\n=== ${id} ===\nscreenshot: ${shot}\nattachment handed to codex: ${attachment}\ninvocation: codex exec --sandbox read-only --skip-git-repo-check -i ${JSON.stringify(attachment)} (cwd: isolated staging dir, prompt ${prompt.length} chars, ${TIMEOUT_MS}ms bound)\nprompt head: ${prompt.slice(0, 160)}...`); continue; }
      const { out, containment } = codexLabel(shot, prompt, { timeoutMs: TIMEOUT_MS });
      const n = recordDevLabels(sink, id, validateVerdict(parseVerdict(out), classes), sha, attachment, containment);
      saveSink(sink); // persist after EACH page so a later hang never loses earlier labels
      labeled++; console.error(`  labeled ${id}: ${n} classes (attachment ${attachment}, containment ${containment})`);
    } catch (e) {
      failed.push(id); console.error(`  FAILED ${id}: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    }
  }
  if (Object.keys(shotMap).length) writeShotMap(shotMap);
  if (!dry) {
    console.error(`\nSUMMARY: labeled ${labeled} | skipped ${skipped} | failed ${failed.length}${failed.length ? ` [${failed.join(', ')}]` : ''}`);
    // EXIT CONTRACT: a partial labeling pass must never read as success. A downstream gate that shells out to
    // this script and checks only the exit code would otherwise consume an incomplete label set as complete.
    //   5 = one or more pages failed to label (retry with --resume)
    //   0 = every targeted page labeled
    if (failed.length) {
      console.error(`FAIL (exit 5): ${failed.length} page(s) unlabeled - the label set is INCOMPLETE. Re-run \`--all --resume\` to retry.`);
      process.exit(5);
    }
    console.error('all targeted dev pages labeled.');
  }
}
