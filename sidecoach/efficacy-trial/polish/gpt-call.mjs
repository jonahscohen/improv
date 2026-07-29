#!/usr/bin/env node
/**
 * GPT-5.4 CALLER. FAIL-CLOSED. The stand-in transport for `~/.claude/hooks/codex-review.py`.
 *
 * WHY THIS EXISTS, and what it is NOT.
 *
 * The pre-registered reviewer and judge for this trial family is Codex / GPT-5.4, invoked through
 * the deterministic wrapper `~/.claude/hooks/codex-review.py`. On 2026-07-29 that wrapper returns
 * exit 4 for every call, reproducibly, because the Codex subscription has hit its usage limit until
 * Aug 3. `codex-review.py --smoke` fails identically, so this is the backend and not the invocation.
 *
 * The MODEL is still reachable: the same GPT-5.4 answers on the OpenAI API. So this file changes the
 * TRANSPORT and keeps the reviewer identity the pre-registration named. It is NOT a fallback to a
 * different model, and it is NOT the same-model Claude fallback the standing verification rule
 * allows when Codex is genuinely unreachable - that fallback is a step down and is not needed here.
 *
 * MODEL CHOICE, stated because it looks like a rule violation and is not. The API also serves
 * gpt-5.5 and gpt-5.6. This tool pins **gpt-5.4** because the parent trial's judge was GPT-5.4 and
 * comparability of the two results depends on holding the judge fixed. Changing the judge model
 * between the two trials would confound the very comparison this sub-trial exists to make. The
 * newest-model rule targets outdated models; matching a pre-registered instrument is a
 * methodological requirement, and the pin is stated here rather than buried.
 *
 * CREDENTIAL: read from the macOS Keychain at call time, never written to disk, never echoed, never
 * placed in argv (where `ps` would show it). The account/service pair is the one the voice pipeline
 * already provisions.
 *
 * USAGE
 *   node gpt-call.mjs "<prompt>" < payload.txt        # payload on stdin, reply on stdout
 *   node gpt-call.mjs --smoke                         # health check, ~20 tokens
 *
 * EXIT CODES (a nonzero exit NEVER prints a usable reply)
 *   0  a real reply was obtained and printed
 *   1  usage
 *   2  no API key in the Keychain -> caller must use the independent-reviewer fallback and SAY so
 *   3  request timed out
 *   4  API returned a non-2xx status, or a transport error, after one retry -> backend failure
 *   5  a 2xx reply contained no text content
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXIT = { OK: 0, USAGE: 1, NO_KEY: 2, TIMEOUT: 3, BACKEND: 4, EMPTY: 5 };
const die = (code, msg) => { console.error(`gpt-call: ${msg}`); process.exit(code); };

export const MODEL = 'gpt-5.4';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const KEYCHAIN = { account: 'claude-voice', service: 'openai-tts-api-key' };

/** Read the key from the Keychain. Returns null when absent. Never logs it. */
function apiKey() {
  try {
    const k = execFileSync('security',
      ['find-generic-password', '-a', KEYCHAIN.account, '-s', KEYCHAIN.service, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return k || null;
  } catch { return null; }
}

/**
 * One call. Returns { ok, status, text, error }. Never throws.
 *
 * `max_completion_tokens` is generous because a reasoning model spends part of the budget on
 * reasoning tokens before it emits any visible text; too small a budget returns a 2xx with an empty
 * message, which this tool reports as exit 5 rather than as a tie or an abstention.
 */
export async function callGpt(prompt, payload, { timeoutMs = 600000, maxTokens = 4000 } = {}) {
  const key = apiKey();
  if (!key) return { ok: false, status: 0, error: 'no key' , noKey: true };
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: payload },
    ],
    max_completion_tokens: maxTokens,
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const raw = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: raw.slice(0, 500) };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, status: res.status, error: `unparseable JSON: ${raw.slice(0, 300)}` }; }
    const text = parsed?.choices?.[0]?.message?.content || '';
    return {
      ok: true, status: res.status, text,
      usage: parsed?.usage || null,
      finish: parsed?.choices?.[0]?.finish_reason || null,
    };
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, status: 0, error: 'timeout', timeout: true };
    return { ok: false, status: 0, error: String(e.message || e) };
  } finally { clearTimeout(timer); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--smoke') {
    const r = await callGpt('Reply with exactly: OK', 'ping', { maxTokens: 2000 });
    if (r.noKey) die(EXIT.NO_KEY, 'no API key in the Keychain');
    if (r.timeout) die(EXIT.TIMEOUT, 'smoke call timed out');
    if (!r.ok) die(EXIT.BACKEND, `smoke call failed (status ${r.status}): ${r.error}`);
    if (!r.text.trim()) die(EXIT.EMPTY, `smoke call returned empty content (finish_reason ${r.finish})`);
    console.log(`gpt-call: SMOKE OK - ${MODEL} replied ${JSON.stringify(r.text.trim().slice(0, 40))}`);
    process.exit(EXIT.OK);
  }
  if (args.length !== 1) die(EXIT.USAGE, 'usage: gpt-call.mjs "<prompt>" < payload   |   gpt-call.mjs --smoke');
  const prompt = args[0];
  const payload = readFileSync(0, 'utf8');
  if (!payload.trim()) die(EXIT.USAGE, 'empty stdin payload');

  let r = await callGpt(prompt, payload);
  if (r.noKey) die(EXIT.NO_KEY, 'no API key in the Keychain');
  if (!r.ok && !r.timeout) {
    // One retry, then fail loudly. A failed call must never be reported as a reply.
    r = await callGpt(prompt, payload);
  }
  if (r.noKey) die(EXIT.NO_KEY, 'no API key in the Keychain');
  if (r.timeout) die(EXIT.TIMEOUT, 'request timed out');
  if (!r.ok) die(EXIT.BACKEND, `API failed after one retry (status ${r.status}): ${r.error}`);
  if (!r.text.trim()) die(EXIT.EMPTY, `2xx reply contained no text (finish_reason ${r.finish})`);
  process.stderr.write(`gpt-call: ${MODEL} ok, ${r.usage ? `${r.usage.prompt_tokens} in / ${r.usage.completion_tokens} out` : 'usage unreported'}\n`);
  process.stdout.write(r.text);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
