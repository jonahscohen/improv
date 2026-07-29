#!/usr/bin/env node
/**
 * ARM BUILDER for the sidecoach efficacy trial. FAIL-CLOSED.
 *
 * Assembles the three frozen prompts per brief (PREREGISTRATION.md section 2):
 *   C  control   = wrapper + brief
 *   P  placebo   = wrapper + brief + length-matched NON-DESIGN block (lib/placebo.mjs)
 *   S  sidecoach = wrapper + brief + the SHIPPED sidecoach-monitor `guidance` payload, verbatim
 *
 * The trial's central integrity claim is that the ONLY thing differing between arms is the
 * appended payload, and that I authored none of the sidecoach payload. This file is where that
 * claim is enforced rather than asserted: it byte-compares the wrapper block and the brief block
 * across all three arms and REFUSES to write anything if they differ.
 *
 * The sidecoach payload is obtained by running the installed `sidecoach-monitor` binary in a
 * per-brief working directory containing the mechanically derived PRODUCT.md. Its stdout JSON's
 * `guidance` array is joined and pasted with no edit of any kind.
 *
 * EXIT CODES (distinct per failure class; a nonzero exit NEVER means the arms were written)
 *   0  every arm written and every integrity check passed
 *   1  usage / bad args
 *   2  brief corpus missing, unparseable, or not the frozen population
 *   3  sidecoach-monitor missing, failed, or returned no guidance for some brief
 *   4  ARM INTEGRITY VIOLATION - wrapper or brief block differs across arms
 *   5  PRODUCT.md transform leaked a token that is not in the brief
 *   6  placebo could not be length-matched
 *   7  filesystem write/verify failure
 */
import { writeFileSync, mkdirSync, rmSync, readFileSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrialBriefs, sha256, TRIAL_ROOT } from './lib/briefs.mjs';
import { productMdFromBrief, authoredTokenLeak } from './lib/product-md.mjs';
import { buildPlacebo, countTokens, PLACEBO_HEADER } from './lib/placebo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARMS = path.join(TRIAL_ROOT, 'arms');
const WORKDIRS = path.join(TRIAL_ROOT, 'workdirs');

const EXIT = { OK: 0, USAGE: 1, CORPUS: 2, MONITOR: 3, ARM_INTEGRITY: 4, LEAK: 5, PLACEBO: 6, IO: 7 };
const die = (code, msg) => { console.error(`build-arms: ${msg}`); process.exit(code); };

// ---------------------------------------------------------------------------------------------
// THE TASK WRAPPER. Authored ONCE, byte-identical in all three arms, and deliberately free of
// design advice of any kind: it states the deliverable format and nothing else. Any sentence
// here about layout, colour, type, motion, accessibility or copy would be the trial author
// smuggling guidance into every arm, which would flatten the very effect being measured.
// ---------------------------------------------------------------------------------------------
const WRAPPER_HEAD = `You are building one web page.

OUTPUT CONTRACT (format only - it says nothing about how the page should be designed)
- Write the complete page to the absolute file path given at the end of this prompt.
- Exactly ONE file. All CSS in a <style> element and all JavaScript, if any, in a <script>
  element inside that same file.
- Fully self-contained and offline: no CDN links, no remote stylesheets, no remote fonts, no
  remote images, no fetch/XHR/WebSocket calls. Inline or omit every asset.
- Do not create, edit, or delete any other file anywhere.
- Do not print the page contents in your reply and do not add commentary inside the page.
- When the file is written, reply with the single word DONE and nothing else.

BRIEF
-----`;

const WRAPPER_TAIL = (outPath) => `
-----
Write the page to: ${outPath}`;

const PAYLOAD_HEADER = 'PROJECT GUIDANCE (ordered steps to execute)';

const PAYLOAD_MARKER = `\n${PAYLOAD_HEADER}\n-----\n`;

/**
 * Deterministic assembly. `payload` is null for arm C.
 *
 * The segment boundaries are chosen so the wrapper block and the brief block are byte-identical
 * across arms BY CONSTRUCTION, not by luck: the payload block is a suffix appended after a brief
 * block whose bytes do not depend on whether a payload follows.
 */
function assemble(brief, outPath, payload) {
  const briefBlock = `\n${brief.raw.trimEnd()}\n`;
  const payloadBlock = payload === null ? '' : `${PAYLOAD_MARKER}${payload.trimEnd()}\n-----`;
  return `${WRAPPER_HEAD}${briefBlock}${payloadBlock}${WRAPPER_TAIL(outPath)}`;
}

/**
 * Recover the wrapper and brief blocks out of the ASSEMBLED text (not from the inputs), so the
 * integrity check verifies what will actually be written rather than what was intended.
 */
function integrityBlocks(text, outPath) {
  const tail = WRAPPER_TAIL(outPath);
  if (!text.startsWith(WRAPPER_HEAD) || !text.endsWith(tail)) return null;
  const head = text.slice(0, WRAPPER_HEAD.length);
  const middle = text.slice(WRAPPER_HEAD.length, text.length - tail.length);
  const idx = middle.indexOf(PAYLOAD_MARKER);
  return { head, briefBlock: idx === -1 ? middle : middle.slice(0, idx) };
}

/**
 * Run the shipped monitor and return its parsed JSON.
 *
 * stdout is redirected to a FILE and read after the child exits, NOT captured through a pipe.
 * Reading through a pipe truncates: measured here at exactly 8178 of 188893 bytes for
 * `coverage-app-ui-corporate-dense-it-operations`. That is the same failure `eval/oracle-comparator.mjs`
 * documents in its header ("reading a pipe in chunks truncated output (observed: 8156 of 14045
 * bytes)") and for the same reason - the monitor spawns a Chrome grandchild that inherits the
 * stdio. A truncated payload would silently shrink the treatment, so this is a correctness fix,
 * not a convenience one.
 */
function runMonitor(cwd, utterance) {
  const dir = mkdtempSync(path.join(tmpdir(), 'efficacy-monitor-'));
  const outPath = path.join(dir, 'out.json');
  const fd = openSync(outPath, 'w');
  try {
    execFileSync('sidecoach-monitor', [utterance, '--json'], {
      cwd, stdio: ['ignore', fd, 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
  } finally { closeSync(fd); }
  const raw = readFileSync(outPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  if (!raw.trim()) throw new Error('monitor produced empty stdout');
  const parsed = JSON.parse(raw);
  const guidance = Array.isArray(parsed.guidance) ? parsed.guidance : [];
  return { guidance, detectedFlow: parsed.detectedFlow ? parsed.detectedFlow.flowId : null, bytes: raw.length };
}

function main() {
  if (process.argv.slice(2).some((a) => a === '-h' || a === '--help')) {
    console.log('Usage: node build-arms.mjs   (no options; the design is frozen by PREREGISTRATION.md)');
    process.exit(EXIT.OK);
  }
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);

  let briefs;
  try { briefs = loadTrialBriefs({ expect: 17 }); }
  catch (e) { die(EXIT.CORPUS, e.message); }

  rmSync(ARMS, { recursive: true, force: true });
  rmSync(WORKDIRS, { recursive: true, force: true });
  mkdirSync(ARMS, { recursive: true });
  mkdirSync(WORKDIRS, { recursive: true });

  const manifest = { builtAt: new Date().toISOString(), briefs: [] };

  for (const brief of briefs) {
    // 1. mechanical PRODUCT.md, guarded against authored-token leakage
    const productMd = productMdFromBrief(brief);
    const leak = authoredTokenLeak(brief, productMd);
    if (leak.length) die(EXIT.LEAK, `brief ${brief.id}: PRODUCT.md contains token(s) absent from the brief: ${leak.join(', ')}`);
    const wd = path.join(WORKDIRS, brief.id);
    mkdirSync(wd, { recursive: true });
    try { writeFileSync(path.join(wd, 'PRODUCT.md'), productMd); }
    catch (e) { die(EXIT.IO, `writing PRODUCT.md for ${brief.id}: ${e.message}`); }

    // 2. the SHIPPED engine's payload for this brief, verbatim
    let monitor;
    try { monitor = runMonitor(wd, `/sidecoach craft ${brief.title}`); }
    catch (e) { die(EXIT.MONITOR, `sidecoach-monitor failed for ${brief.id}: ${e.message}`); }
    if (monitor.guidance.length === 0) die(EXIT.MONITOR, `sidecoach-monitor returned an empty guidance array for ${brief.id} - there is no treatment to administer`);
    const scPayload = monitor.guidance.join('\n');

    // 3. placebo matched to that payload's shape
    let placebo;
    try {
      placebo = buildPlacebo({
        targetLines: scPayload.split('\n').length,
        targetChars: scPayload.length,
      });
    } catch (e) { die(EXIT.PLACEBO, `brief ${brief.id}: ${e.message}`); }
    if (placebo.header !== PAYLOAD_HEADER) die(EXIT.ARM_INTEGRITY, `placebo header "${placebo.header}" differs from the shared payload header "${PAYLOAD_HEADER}"`);

    // 4. assemble, with the output path identical in shape across arms
    const outFor = (arm) => path.join(TRIAL_ROOT, 'pages', arm, `${brief.id}.html`);
    const prompts = {
      C: assemble(brief, outFor('C'), null),
      P: assemble(brief, outFor('P'), placebo.body),
      S: assemble(brief, outFor('S'), scPayload),
    };

    // 5. ARM INTEGRITY: the wrapper and the brief block must be byte-identical across arms.
    const blocks = Object.fromEntries(Object.entries(prompts).map(([arm, t]) => [arm, integrityBlocks(t, outFor(arm))]));
    for (const [arm, b] of Object.entries(blocks)) {
      if (!b) die(EXIT.ARM_INTEGRITY, `brief ${brief.id} arm ${arm}: assembled prompt does not end with the expected wrapper tail`);
    }
    for (const arm of ['P', 'S']) {
      if (blocks[arm].head !== blocks.C.head) die(EXIT.ARM_INTEGRITY, `brief ${brief.id}: wrapper differs between arm ${arm} and arm C`);
      if (blocks[arm].briefBlock !== blocks.C.briefBlock) die(EXIT.ARM_INTEGRITY, `brief ${brief.id}: brief block differs between arm ${arm} and arm C`);
    }

    // 6. write and verify
    for (const [arm, text] of Object.entries(prompts)) {
      const f = path.join(ARMS, `${brief.id}.${arm}.txt`);
      try {
        writeFileSync(f, text);
        if (readFileSync(f, 'utf8') !== text) throw new Error('readback mismatch');
      } catch (e) { die(EXIT.IO, `writing ${f}: ${e.message}`); }
    }

    manifest.briefs.push({
      id: brief.id,
      register: brief.register,
      aestheticStyle: brief.aestheticStyle,
      briefSha256: brief.sha256,
      detectedFlow: monitor.detectedFlow,
      sidecoach: { lines: scPayload.split('\n').length, tokens: countTokens(scPayload), chars: scPayload.length, sha256: sha256(scPayload) },
      placebo: { lines: placebo.lines, tokens: placebo.tokens, chars: placebo.chars, sha256: sha256(placebo.body) },
      promptChars: Object.fromEntries(Object.entries(prompts).map(([a, t]) => [a, t.length])),
      promptSha256: Object.fromEntries(Object.entries(prompts).map(([a, t]) => [a, sha256(t)])),
    });
  }

  if (manifest.briefs.length !== 17) die(EXIT.CORPUS, `built ${manifest.briefs.length} briefs, expected 17`);
  manifest.wrapperSha256 = sha256(WRAPPER_HEAD);
  manifest.payloadHeader = PAYLOAD_HEADER;
  try { writeFileSync(path.join(ARMS, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`); }
  catch (e) { die(EXIT.IO, `writing manifest: ${e.message}`); }

  const distinct = new Set(manifest.briefs.map((b) => b.sidecoach.sha256));
  console.log(`build-arms: OK - 17 briefs x 3 arms = 51 prompts written to ${path.relative(process.cwd(), ARMS)}`);
  console.log(`  distinct sidecoach payloads across the 17 briefs: ${distinct.size}`);
  console.log(`  sidecoach payload lines: ${Math.min(...manifest.briefs.map((b) => b.sidecoach.lines))}-${Math.max(...manifest.briefs.map((b) => b.sidecoach.lines))}`);
  console.log(`  placebo/sidecoach char ratio: ${(manifest.briefs.map((b) => (b.placebo.chars / b.sidecoach.chars)).reduce((a, x) => a + x, 0) / 17).toFixed(4)}`);
  console.log(`  prompt chars C/P/S (mean): ${['C','P','S'].map((a) => Math.round(manifest.briefs.map((b) => b.promptChars[a]).reduce((x, y) => x + y, 0) / 17)).join(' / ')}`);
  process.exit(EXIT.OK);
}

main();
