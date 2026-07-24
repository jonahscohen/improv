#!/usr/bin/env node
/**
 * Stage 1a - PROVIDER SAMPLING HARNESS (upgrade plan 2026-07-23, Stage 1a).
 *
 * Generates N UI pages per target model from the FIXED NEUTRAL HELD-OUT briefs, so Stage 1b can measure a
 * per-provider defect distribution with the SHIPPING rendered scanner. Provider adapters sit behind ONE
 * interface (`generate(brief, ctx) -> {html, usage}`): Claude via the existing `@anthropic-ai/sdk`, gpt via the
 * OpenAI REST surface, Gemini via the Google Generative Language REST surface. No new dependency is added -
 * gpt/gemini use global `fetch` (Node 18+).
 *
 * INDEPENDENCE: the brief pool is HELD-OUT ONLY. `kind: "calibration"` briefs are architect-authored (see
 * eval/corpus/briefs/_spec.md) and are excluded here with no flag to weaken it. This is eval-side code and
 * never imports product code except the published dist surface; product code must never import from eval/.
 *
 * FAIL-CLOSED, in this order, BEFORE any file or directory is created:
 *   - unknown/missing provider or bad N        -> exit 1  (usage)
 *   - live mode with no provider key present   -> exit 2  (writes NOTHING; never fabricates output)
 *   - live mode with no resolvable model id    -> exit 3  (refuses to guess or pin a stale id)
 *   - a generation call fails or returns empty -> exit 4  (loud; no partial success line)
 *   - manifest/file-count integrity mismatch   -> exit 5
 *   - brief corpus missing/unreadable          -> exit 6
 * There is no path that prints a success line unless every page was written and the integrity check passed.
 *
 * `--dry-run` proves the whole pipeline with a MOCKED generator: no key required, no network, zero cost. Its
 * manifest is stamped `mode:"dry-run"` and every page carries `synthetic:true`, so dry-run output can never be
 * mistaken for a measurement. Live runs are key-gated, periodic by design, and log token cost.
 *
 * Usage:
 *   node eval/provider-sample.mjs --provider claude --n 3 --dry-run
 *   node eval/provider-sample.mjs --provider claude --n 20 --repeats 1 --out eval/samples/2026-07-24
 *   node eval/provider-sample.mjs --provider claude --brief coverage-forms-minimal-medical-intake --repeats 10
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const CORPUS = path.join(HERE, 'corpus');
const BRIEF_DIR = path.join(CORPUS, 'briefs');

export const EXIT = { OK: 0, USAGE: 1, NO_KEY: 2, NO_MODEL: 3, GENERATION: 4, INTEGRITY: 5, CORPUS: 6 };

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const die = (code, msg) => { console.error(`provider-sample: ${msg}`); process.exit(code); };

// ---------------------------------------------------------------------------------------------------------
// Provider registry. modelEnv/modelDefault are the ONLY place a model id is decided.
//
// LATEST IDS ONLY (team hard rule: no legacy model versions).
//   claude - `claude-opus-4-8`, the current Claude Opus tier (source: bundled claude-api skill model table).
//   gpt    - `gpt-5.4`, the current OpenAI model named by the standing team rule.
//   gemini - NO DEFAULT ON PURPOSE. This repo carries no authoritative record of the current Gemini id, and a
//            guessed or stale id would silently violate the no-legacy-models rule. The adapter therefore
//            REQUIRES an explicit id via SIDECOACH_GEMINI_MODEL (or --model) and exits 3 otherwise. Refusing to
//            guess is the fail-closed behaviour; pinning a stale id would be the failure.
// Any provider's id can be overridden with --model or its env var, so an operator can pin or advance a tier
// without editing this file.
// ---------------------------------------------------------------------------------------------------------
export const PROVIDERS = {
  claude: {
    id: 'claude',
    keyEnv: ['ANTHROPIC_API_KEY'],
    modelEnv: 'SIDECOACH_CLAUDE_MODEL',
    modelDefault: 'claude-opus-4-8',
    // Published rate for the default tier, recorded in the manifest so the estimate is auditable.
    usd: { in: 5.0 / 1e6, out: 25.0 / 1e6 },
  },
  gpt: {
    id: 'gpt',
    keyEnv: ['OPENAI_API_KEY'],
    modelEnv: 'SIDECOACH_GPT_MODEL',
    modelDefault: 'gpt-5.4',
    usd: null, // no rate recorded here; tokens are logged instead of a fabricated dollar figure
  },
  gemini: {
    id: 'gemini',
    keyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    modelEnv: 'SIDECOACH_GEMINI_MODEL',
    modelDefault: null,
    usd: null,
  },
};

const PROMPT_SYSTEM =
  'You are a senior product designer and front-end engineer. You produce a single, complete, self-contained ' +
  'HTML document for the brief you are given.';

const PROMPT_RULES = [
  'Return ONE complete HTML document and nothing else. No prose before or after, no markdown fences.',
  'The document must be fully self-contained: all CSS in a single <style> block, no external stylesheets, no',
  'external fonts, no external images, no scripts, no network requests of any kind. Use inline SVG or CSS for',
  'any visual element. Use placeholder copy only - no real personal data.',
  'Design the page as you judge best for the brief. Do not ask questions; produce the page.',
].join(' ');

function briefPrompt(briefText) {
  return `${PROMPT_RULES}\n\nBRIEF\n-----\n${briefText}\n`;
}

// ---------------------------------------------------------------------------------------------------------
// Adapters. ONE interface: async (prompt, ctx) => { text, usage }
// A non-2xx response or an empty body throws; the caller turns that into exit 4 (never a silent empty page).
// ---------------------------------------------------------------------------------------------------------
async function generateClaude(prompt, ctx) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ctx.apiKey });
  // Streaming: max_tokens well above ~16k would risk an HTTP timeout on the non-streaming path. Adaptive
  // thinking must be set EXPLICITLY on this tier (omitting it runs without thinking); budget_tokens and the
  // sampling params (temperature/top_p/top_k) are rejected with a 400 on this tier and are therefore absent.
  const stream = client.messages.stream({
    model: ctx.modelId,
    max_tokens: 32000,
    system: PROMPT_SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    text,
    usage: { inputTokens: msg.usage?.input_tokens ?? null, outputTokens: msg.usage?.output_tokens ?? null },
  };
}

async function generateGpt(prompt, ctx) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.apiKey}` },
    body: JSON.stringify({
      model: ctx.modelId,
      messages: [{ role: 'system', content: PROMPT_SYSTEM }, { role: 'user', content: prompt }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`openai ${res.status}: ${body.slice(0, 400)}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error(`openai: unparseable body: ${body.slice(0, 200)}`); }
  const text = json?.choices?.[0]?.message?.content ?? '';
  return {
    text,
    usage: { inputTokens: json?.usage?.prompt_tokens ?? null, outputTokens: json?.usage?.completion_tokens ?? null },
  };
}

async function generateGemini(prompt, ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ctx.modelId)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': ctx.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`gemini ${res.status}: ${body.slice(0, 400)}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error(`gemini: unparseable body: ${body.slice(0, 200)}`); }
  const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return {
    text,
    usage: {
      inputTokens: json?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: json?.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
}

const ADAPTERS = { claude: generateClaude, gpt: generateGpt, gemini: generateGemini };

// ---------------------------------------------------------------------------------------------------------
// Mocked generator (--dry-run). Deterministic per (provider, briefId, repeat) so the pipeline is reproducible,
// but VARIED across those keys so Stage 1b and the sameness probe have non-degenerate input. It plants a small
// deterministic set of real defects so the distribution artifact is non-trivial. Costs nothing; touches no key.
// ---------------------------------------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedOf = (s) => parseInt(sha256(s).slice(0, 8), 16);

const MOCK_FACES = [
  '"Fraunces", Georgia, serif',
  '"Space Grotesk", "Helvetica Neue", sans-serif',
  'Georgia, "Times New Roman", serif',
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
];
const MOCK_PALETTES = [
  { bg: '#f4f1ea', fg: '#2b2118', accent: '#b4532a' },
  { bg: '#ffffff', fg: '#111318', accent: '#2f5bea' },
  { bg: '#0d1117', fg: '#e6edf3', accent: '#3fb950' },
  { bg: '#fbf7ff', fg: '#1c1430', accent: '#7a3ff2' },
];

function mockPage(provider, brief, repeat) {
  const rnd = mulberry32(seedOf(`${provider}|${brief.id}|${repeat}`));
  const face = MOCK_FACES[Math.floor(rnd() * MOCK_FACES.length)];
  const pal = MOCK_PALETTES[Math.floor(rnd() * MOCK_PALETTES.length)];
  const sections = 2 + Math.floor(rnd() * 4);
  // Deterministic planted defects, so the dry-run distribution exercises real scanner rules.
  const tiny = rnd() < 0.34;
  const justified = rnd() < 0.34;
  const skipped = rnd() < 0.34;
  const body = [];
  body.push(`<h1>${brief.title}</h1>`);
  body.push(`<p class="lede">A self-contained mock page generated for brief ${brief.id}.</p>`);
  for (let i = 0; i < sections; i += 1) {
    const h = skipped && i === 0 ? 'h3' : 'h2';
    body.push(`<section><${h}>Section ${i + 1}</${h}><p>${'Placeholder body copy for this section. '.repeat(6)}</p></section>`);
  }
  if (tiny) body.push(`<p class="fine">${'Fine print placeholder copy that is set far below a readable size. '.repeat(4)}</p>`);
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${brief.title}</title>`,
    '<style>',
    `  body { margin:0; padding:48px; background:${pal.bg}; color:${pal.fg}; font-family:${face}; font-size:17px; line-height:1.6; }`,
    `  h1 { font-size:44px; color:${pal.accent}; margin:0 0 16px; }`,
    '  h2, h3 { font-size:24px; margin:32px 0 8px; }',
    `  section p { max-width:62ch; ${justified ? 'text-align:justify;' : ''} }`,
    '  .lede { font-size:20px; }',
    '  .fine { font-size:9px; }',
    '</style></head><body>',
    body.join('\n'),
    '</body></html>',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------------------
// Brief pool - HELD-OUT ONLY.
// ---------------------------------------------------------------------------------------------------------
export function loadHeldoutBriefs() {
  let index;
  try { index = JSON.parse(readFileSync(path.join(CORPUS, 'briefs.json'), 'utf8')); }
  catch (e) { die(EXIT.CORPUS, `cannot read eval/corpus/briefs.json: ${e.message}`); }
  if (!Array.isArray(index) || index.length === 0) die(EXIT.CORPUS, 'eval/corpus/briefs.json is empty or not an array');

  const heldout = index.filter((b) => b.kind !== 'calibration').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (heldout.length === 0) die(EXIT.CORPUS, 'no held-out briefs (every brief is kind=calibration)');

  return heldout.map((b) => {
    const file = path.join(CORPUS, b.file);
    let text;
    try { text = readFileSync(file, 'utf8'); }
    catch (e) { die(EXIT.CORPUS, `brief ${b.id} references a missing file (${b.file}): ${e.message}`); }
    const m = /^title:\s*(.+)$/m.exec(text);
    return { id: b.id, kind: b.kind, register: b.register || null, file: b.file, text, title: m ? m[1].trim() : b.id };
  });
}

// ---------------------------------------------------------------------------------------------------------
// HTML extraction. A model may still wrap the document in a fence despite the instruction; strip it, then
// require the result to actually look like an HTML document. An unusable body is a LOUD failure, not a page.
// ---------------------------------------------------------------------------------------------------------
export function extractHtml(raw) {
  let s = String(raw || '').trim();
  const fence = /^```(?:html)?\s*\n([\s\S]*?)\n?```$/i.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.search(/<!doctype html|<html[\s>]/i);
  if (start > 0) s = s.slice(start).trim();
  if (!/<html[\s>]/i.test(s) || !/<\/html>/i.test(s)) return null;
  return s;
}

/**
 * Self-containment audit (Codex MAJOR). The prompt demands a self-contained document (no scripts, no external
 * subresources, no network). A model can ignore that and still return valid HTML. We do NOT hard-reject such a
 * page - it rendered, and the SHIPPING scanner is hermetic (it blocks every cross-origin subresource + all
 * WebSockets at scan time), so an external ref cannot invalidate the measurement, and scripts run under the
 * live scanner exactly as they would in the shipping audit. Discarding the page would turn a prompt-adherence
 * miss into a lost sample. Instead we RECORD the issues per page in the manifest and warn on stderr, so a
 * non-conforming page is auditable and never silently blessed as clean.
 */
export function selfContainmentIssues(html) {
  const issues = [];
  if (/<script[\s>]/i.test(html)) issues.push('script-tag');
  if (/<link\b[^>]*\bhref\s*=\s*["']?https?:/i.test(html)) issues.push('external-stylesheet');
  if (/<(?:img|source|iframe|video|audio|embed)\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html)) issues.push('external-media');
  if (/url\(\s*["']?https?:/i.test(html)) issues.push('external-css-url');
  if (/@import\s+(?:url\()?["']?https?:/i.test(html)) issues.push('external-import');
  return [...new Set(issues)];
}

// ---------------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { provider: null, n: null, repeats: 1, dryRun: false, out: null, model: null, brief: null };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => { const v = argv[i + 1]; i += 1; return v; };
    if (k === '--provider') a.provider = next();
    else if (k === '--n') a.n = Number(next());
    else if (k === '--repeats') a.repeats = Number(next());
    else if (k === '--out') a.out = next();
    else if (k === '--model') a.model = next();
    else if (k === '--brief') a.brief = next();
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else die(EXIT.USAGE, `unknown argument: ${k}`);
  }
  return a;
}

const HELP = `provider-sample.mjs - Stage 1a provider sampling harness

  --provider <claude|gpt|gemini>  required
  --n <int>                       number of held-out briefs to sample (default: all)
  --brief <id>                    pin one held-out brief (mutually exclusive with --n)
  --repeats <int>                 generations per brief (default 1); >1 is the sameness-probe input
  --model <id>                    override the provider's model id
  --out <dir>                     output directory (default eval/samples/<provider>-<utc>)
  --dry-run                       mocked generation: no key, no network, zero cost

exit codes: 0 ok | 1 usage | 2 no key | 3 no model id | 4 generation failed | 5 integrity | 6 corpus`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }

  // ---- preflight (NOTHING is written until every check below passes) ----
  if (!args.provider) die(EXIT.USAGE, 'missing --provider (claude|gpt|gemini)');
  const spec = PROVIDERS[args.provider];
  if (!spec) die(EXIT.USAGE, `unknown provider "${args.provider}" (expected one of: ${Object.keys(PROVIDERS).join(', ')})`);
  if (args.n !== null && (!Number.isInteger(args.n) || args.n < 1)) die(EXIT.USAGE, `--n must be a positive integer (got ${args.n})`);
  if (!Number.isInteger(args.repeats) || args.repeats < 1) die(EXIT.USAGE, `--repeats must be a positive integer (got ${args.repeats})`);
  if (args.brief && args.n !== null) die(EXIT.USAGE, '--brief and --n are mutually exclusive');

  const briefs = loadHeldoutBriefs();
  let selected;
  if (args.brief) {
    const one = briefs.find((b) => b.id === args.brief);
    if (!one) die(EXIT.USAGE, `--brief "${args.brief}" is not a held-out brief (held-out pool has ${briefs.length}: calibration briefs are excluded for independence)`);
    selected = [one];
  } else {
    const n = args.n === null ? briefs.length : args.n;
    if (n > briefs.length) die(EXIT.USAGE, `--n ${n} exceeds the held-out pool size (${briefs.length}); calibration briefs are excluded for independence`);
    selected = briefs.slice(0, n);
  }

  // Key + model gating happens ONLY for live mode. --dry-run is deliberately key-independent: its entire
  // purpose is proving the pipeline at zero cost on a machine with no provider credentials.
  let apiKey = null;
  let modelId = args.model || null;
  if (!args.dryRun) {
    const keyName = spec.keyEnv.find((k) => process.env[k]);
    if (!keyName) {
      die(EXIT.NO_KEY, `no key for provider "${spec.id}": set ${spec.keyEnv.join(' or ')}. Refusing to run and writing nothing (fail-closed). Use --dry-run to exercise the pipeline without a key.`);
    }
    apiKey = process.env[keyName];
    modelId = modelId || process.env[spec.modelEnv] || spec.modelDefault;
    if (!modelId) {
      die(EXIT.NO_MODEL, `no model id for provider "${spec.id}": set ${spec.modelEnv} (or pass --model). This harness refuses to guess or pin a model id it cannot verify is current.`);
    }
  } else {
    modelId = modelId || process.env[spec.modelEnv] || spec.modelDefault || `${spec.id}-dry-run-mock`;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(args.out || path.join(HERE, 'samples', `${spec.id}-${stamp}`));
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    die(EXIT.USAGE, `output directory is not empty: ${outDir} (refusing to mix runs)`);
  }

  // ---- generation ----
  const pages = [];
  const totals = { inputTokens: 0, outputTokens: 0, calls: 0, tokensKnown: true };
  const created = [];
  let dirCreated = false;
  const cleanup = () => { if (dirCreated) { try { rmSync(outDir, { recursive: true, force: true }); } catch { /* best effort */ } } };

  try {
    mkdirSync(outDir, { recursive: true });
    dirCreated = true;

    for (const brief of selected) {
      for (let r = 0; r < args.repeats; r += 1) {
        const captureUtc = new Date().toISOString();
        let html;
        let usage = { inputTokens: null, outputTokens: null };
        if (args.dryRun) {
          html = mockPage(spec.id, brief, r);
        } else {
          let out;
          try { out = await ADAPTERS[spec.id](briefPrompt(brief.text), { apiKey, modelId }); }
          catch (e) { throw new Error(`generation failed for ${spec.id}/${brief.id}#${r}: ${e.message}`); }
          usage = out.usage || usage;
          totals.calls += 1;
          if (usage.inputTokens == null || usage.outputTokens == null) totals.tokensKnown = false;
          totals.inputTokens += usage.inputTokens || 0;
          totals.outputTokens += usage.outputTokens || 0;
          html = extractHtml(out.text);
          if (!html) throw new Error(`generation returned no usable HTML document for ${spec.id}/${brief.id}#${r} (${String(out.text || '').length} chars returned)`);
        }

        const file = `${spec.id}__${brief.id}__r${r}.html`;
        writeFileSync(path.join(outDir, file), html);
        created.push(file);
        const scIssues = selfContainmentIssues(html);
        pages.push({
          provider: spec.id,
          briefId: brief.id,
          modelId,
          captureUtc,
          contentSha256: sha256(html),
          file,
          bytes: Buffer.byteLength(html),
          repeat: r,
          register: brief.register,
          synthetic: args.dryRun,
          selfContained: scIssues.length === 0,
          selfContainmentIssues: scIssues,
          usage,
        });
      }
    }

    const cost = {
      calls: totals.calls,
      inputTokens: args.dryRun ? 0 : totals.inputTokens,
      outputTokens: args.dryRun ? 0 : totals.outputTokens,
      tokensComplete: args.dryRun ? true : totals.tokensKnown,
      usdRate: spec.usd,
      estimatedUsd:
        args.dryRun ? 0
          : spec.usd && totals.tokensKnown
            ? Number((totals.inputTokens * spec.usd.in + totals.outputTokens * spec.usd.out).toFixed(4))
            : null,
    };

    const manifest = {
      schema: 'sidecoach-provider-sample/v1',
      generatedUtc: new Date().toISOString(),
      mode: args.dryRun ? 'dry-run' : 'live',
      provider: spec.id,
      modelId,
      briefPool: { name: 'heldout', selector: 'briefs.json kind !== "calibration"', poolSize: briefs.length, selected: selected.map((b) => b.id) },
      repeats: args.repeats,
      cost,
      pages,
    };
    writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    // ---- integrity gate: manifest rows MUST equal the HTML files on disk ----
    const onDisk = readdirSync(outDir).filter((f) => f.endsWith('.html'));
    if (onDisk.length !== manifest.pages.length) {
      throw Object.assign(new Error(`integrity: ${onDisk.length} html files on disk but manifest.pages.length=${manifest.pages.length}`), { integrity: true });
    }
    const manifestFiles = new Set(manifest.pages.map((p) => p.file));
    for (const f of onDisk) {
      if (!manifestFiles.has(f)) throw Object.assign(new Error(`integrity: ${f} on disk is absent from the manifest`), { integrity: true });
    }

    const notSelfContained = manifest.pages.filter((p) => !p.selfContained);
    console.log(`provider-sample: ${manifest.pages.length} pages (${spec.id} / ${modelId}) -> ${outDir}`);
    console.log(`  mode=${manifest.mode}  briefs=${selected.length}  repeats=${args.repeats}  pool=heldout(${briefs.length})`);
    if (notSelfContained.length) {
      console.error(`  WARNING: ${notSelfContained.length}/${manifest.pages.length} page(s) are NOT self-contained (recorded per-page as selfContainmentIssues; the scanner is hermetic so measurement is unaffected, but adherence to the brief's self-contained constraint is imperfect):`);
      for (const p of notSelfContained.slice(0, 5)) console.error(`    ${p.file}: ${p.selfContainmentIssues.join(', ')}`);
    }
    console.log(`  cost: calls=${cost.calls} inTok=${cost.inputTokens} outTok=${cost.outputTokens}` +
      `${cost.estimatedUsd !== null ? ` estUsd=$${cost.estimatedUsd}` : ' estUsd=n/a (no recorded rate)'}` +
      `${cost.tokensComplete ? '' : ' [token counts INCOMPLETE - provider did not report usage]'}`);
    console.log(`  manifest: ${path.join(outDir, 'manifest.json')}  (pages=${manifest.pages.length} == htmlFiles=${onDisk.length})`);
    process.exit(EXIT.OK);
  } catch (e) {
    cleanup();
    die(e && e.integrity ? EXIT.INTEGRITY : EXIT.GENERATION, e.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
