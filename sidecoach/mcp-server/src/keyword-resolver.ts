// Pure TypeScript port of the sanitize + word-boundary + informational-
// suppression logic that lives in `claude/hooks/sidecoach-keyword.sh`.
//
// The bash hook lives at hook-time (UserPromptSubmit). The MCP tool exposes
// the same logic so callers can resolve a phrase outside of the hook (e.g.
// from inside a Claude conversation, or a test harness). Behavior MUST match
// the hook 1:1 modulo regex flavor differences between Python and JS.
//
// The hook tests live at claude/hooks/test-sidecoach-keyword.sh and we want
// this port to remain compatible enough that the same fixtures pass.

import * as fs from 'fs';
import type { ModeEntry, VerbEntry } from './registries';

// ---------------------------------------------------------------------------
// Sanitization pipeline (5 stages, order matters)
// ---------------------------------------------------------------------------

/**
 * Strip non-intent regions from the prompt body before regex matching.
 * Mirrors the Python sanitize() in sidecoach-keyword.sh:
 *
 *   1. Fenced code blocks: ```...```
 *   2. Inline backticks: `code`
 *   3. URLs: http://, https://, file://, ftp://
 *   4. XML tag bodies and stray XML tags
 *   5. Transcript markers: [MAGIC KEYWORD: ...], [TURN N: ...]
 */
export function sanitize(text: string): string {
  let t = text;
  // 1. Fenced code blocks.
  t = t.replace(/```[\s\S]*?```/g, ' ');
  // 2. Inline backticks.
  t = t.replace(/`[^`\n]*`/g, ' ');
  // 3. URLs.
  t = t.replace(/\b(?:https?|file|ftp):\/\/\S+/gi, ' ');
  // 4. XML tag bodies.
  t = t.replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, ' ');
  // 5. Stray XML tags (open or self-closing).
  t = t.replace(/<[a-zA-Z!/][^>]*>/g, ' ');
  // 6. Transcript markers.
  t = t.replace(
    /\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi,
    ' ',
  );
  return t;
}

// ---------------------------------------------------------------------------
// Informational-framing suppression
// ---------------------------------------------------------------------------

/**
 * Return true if the pattern appears only inside an informational framing -
 * "what is X", "how to use X", "X is a Y", "explain X", "define X", etc.
 * In those cases the user is asking what something is rather than asking us
 * to run it. The bash hook blocks firing in those cases; we mirror that.
 */
export function isInformational(text: string, pattern: string): boolean {
  // JS regex doesn't have \b for hyphen-aware boundaries, so we mirror the
  // bash hook's (?<![\w-]) ... (?![\w-]) explicitly.
  const escaped = escapeRegex(pattern);
  const noWordBefore = `(?<![\\w-])`;
  const noWordAfter = `(?![\\w-])`;
  const frames: string[] = [
    `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
    `\\bwhat['’]s\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
    `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${escaped}${noWordAfter}`,
    `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${escaped}${noWordAfter}`,
    `\\btell\\s+me\\s+about\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
    `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${escaped}${noWordAfter}`,
    `\\bdefine\\s+${escaped}${noWordAfter}`,
    `${noWordBefore}${escaped}\\s+is\\s+(?:a|an|the)\\b`,
    `\\bwhat\\s+(?:the\\s+)?${escaped}\\s+(?:does|means|is)\\b`,
  ];
  for (const frame of frames) {
    if (new RegExp(frame, 'i').test(text)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Match registries
// ---------------------------------------------------------------------------

export type ResolutionKind = 'verb' | 'mode' | 'none';

export interface KeywordMatch {
  kind: ResolutionKind;
  name?: string;
  chain?: string[];
  reason?: string;
}

function wordBoundaryMatch(text: string, pattern: string): boolean {
  // Mirror Python's (?<![\w-])PATTERN(?![\w-]).
  const re = new RegExp(`(?<![\\w-])${escapeRegex(pattern)}(?![\\w-])`, 'i');
  return re.test(text);
}

function matchEntries<T extends { pattern: string }>(
  entries: T[],
  sanitized: string,
  nameOf: (e: T) => string,
): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    const pattern = entry.pattern || nameOf(entry);
    if (!pattern) continue;
    if (!wordBoundaryMatch(sanitized, pattern)) continue;
    if (isInformational(sanitized, pattern)) continue;
    out.push(entry);
  }
  return out;
}

/**
 * Resolve a raw user phrase against a verb registry and a mode registry.
 *
 * Behavior matches sidecoach-keyword.sh:
 *  - Modes take precedence over verbs (mode chains already name verbs).
 *  - Multi-match: tie-break to first entry in registry order.
 *  - Word-boundary match (`(?<![\\w-]) ... (?![\\w-])`) to avoid firing on
 *    "polished" / "audit-trail" / "extraction" etc.
 *  - Informational framings ("what is X", "X is a Y", etc.) suppress firing.
 */
export function resolveKeyword(
  phrase: string,
  registries: { verbs: VerbEntry[]; modes: ModeEntry[] },
): KeywordMatch {
  if (!phrase || !phrase.trim()) {
    return { kind: 'none', reason: 'empty phrase' };
  }

  const sanitized = sanitize(phrase);
  if (!sanitized.trim()) {
    return { kind: 'none', reason: 'phrase became empty after sanitization (all code/URLs/XML)' };
  }

  const matchedModes = matchEntries(registries.modes, sanitized, (m) => m.mode);
  const matchedVerbs = matchEntries(registries.verbs, sanitized, (v) => v.verb);

  if (matchedModes.length > 0) {
    const chosen = matchedModes[0];
    return {
      kind: 'mode',
      name: chosen.mode,
      chain: chosen.chain,
      reason:
        matchedModes.length > 1
          ? `multiple modes matched (${matchedModes.map((m) => m.mode).join(', ')}); tie-broken to first in registry order`
          : 'matched mode',
    };
  }

  if (matchedVerbs.length > 0) {
    const chosen = matchedVerbs[0];
    return {
      kind: 'verb',
      name: chosen.verb,
      reason:
        matchedVerbs.length > 1
          ? `multiple verbs matched (${matchedVerbs.map((v) => v.verb).join(', ')}); tie-broken to first in registry order`
          : 'matched verb',
    };
  }

  return { kind: 'none', reason: 'no verb or mode matched after sanitization + informational suppression' };
}

// ===========================================================================
// Lane classifier (P1) - the TypeScript MIRROR of the Python classifier in
// claude/hooks/sidecoach_lanes.py. It MUST produce DECISIONS IDENTICAL to the
// Python side on every fixture in sidecoach/parity/classifier-corpus.json
// (enforced by classifier-parity.test.ts + test_classifier_parity.py).
//
// Added ALONGSIDE resolveKeyword/sanitize/isInformational above (the MCP tool
// rename is P4). The lane copies of sanitize/isInformational are deliberately
// renamed laneSanitize / laneIsInformational because they MUST differ from the
// existing exports: laneSanitize is length-preserving (clause-span offsets must
// stay valid), and laneIsInformational uses the 7-frame set that mirrors the
// Python classifier (not the 9-frame hook set above). Pure regex, no LLM.
// ===========================================================================

export const SCHEMA_VERSION = 1;
const NEGATORS = ["don't", 'do not', 'never', 'not', 'stop'];
const ABBREVIATIONS = ['e.g.', 'i.e.', 'vs.', 'etc.', 'Dr.', 'Mr.', 'Ms.'];
const CONJUNCTION_BOUNDARIES = [', but', ', and', ', or', ', yet', ', so'];
// Comma-conjunction boundary = the conjunction WORD followed by a non-word char
// (or EOL), NOT a bare prefix - so ", butter" must NOT split while ", and " does.
// Built from CONJUNCTION_BOUNDARIES (single source of truth); sticky ('y') so
// .test() is anchored at the comma index, mirroring Python's
// _CONJUNCTION_RE.match(masked, i). 'i' = case-insensitive (= Python re.IGNORECASE).
const CONJUNCTION_RE = new RegExp(
  '(?:' + CONJUNCTION_BOUNDARIES.map(cb => cb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w])',
  'iy',
);
const TERMINATORS = new Set(['.', '!', '?', ';', '\n']);

export interface LaneScore { lane: string; label: string; score: number; scope: string; evidenceIds: string[]; }
export interface Decision { outcome: string; winningLane: string | null; verbMatch: string | null; diagnosticLane: string | null; laneScores: LaneScore[]; schemaVersion: number; }

export function loadRegistry(p: string): any {
  const reg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!reg || !Array.isArray(reg.lanes) || !reg.lanes.length) throw new Error('lane registry has no lanes');
  if (!reg.scope || !reg.scope.ui_evidence || !reg.scope.negative_filters) throw new Error('scope incomplete');
  for (const k of ['route_floor', 'route_margin', 'classify_floor']) if (!(k in (reg.scoring || {}))) throw new Error(`scoring missing ${k}`);
  return reg;
}

const blank = (m: string) => ' '.repeat(m.length);

// Length-preserving strip (mirrors Python sanitize() in sidecoach_lanes.py).
// Distinct from the single-space `sanitize` exported above; each stripped
// region becomes equal-length spaces so downstream clause offsets stay valid.
function laneSanitize(text: string): string {
  text = text.replace(/```[\s\S]*?```/g, blank);
  text = text.replace(/`[^`\n]*`/g, blank);
  text = text.replace(/\b(?:https?|file|ftp):\/\/\S+/gi, blank);
  text = text.replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, blank);
  text = text.replace(/<[a-zA-Z!/][^>]*>/g, blank);
  text = text.replace(/\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi, blank);
  return text;
}

const INFO_FRAMES = [
  /\bwhat(?:['’]s| is| are| was| were| does| did)\s+[^.!?;\n]*/gi,
  /\bhow\s+(?:to|do\s+(?:i|you|we))\s+[^.!?;\n]*/gi,
  /\btell\s+me\s+about\s+[^.!?;\n]*/gi,
  /\bexplain\s+[^.!?;\n]*/gi,
  /\bdefine\s+[^.!?;\n]*/gi,
];

export function blankInformational(text: string): string {
  for (const f of INFO_FRAMES) text = text.replace(f, blank);
  text = text.replace(/["“][^"”\n]{0,400}["”]/g, blank);
  return text;
}

export function segmentClauses(text: string): Array<[number, number]> {
  let masked = text;
  for (const a of ABBREVIATIONS) masked = masked.split(a).join(a.replace(/\./g, ' '));
  const cuts = new Set<number>([0, text.length]);
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (TERMINATORS.has(ch)) { if (i + 1 < text.length) cuts.add(i + 1); continue; }
    if (ch === ',') {
      // Anchor the conjunction-word match at this comma (sticky lastIndex = i);
      // the (?![\w]) lookahead sees the real following char/EOL, so ", butter"
      // does not split but ", and " does. Mirrors Python _CONJUNCTION_RE.match(masked, i).
      CONJUNCTION_RE.lastIndex = i;
      if (CONJUNCTION_RE.test(masked)) { if (i + 1 < text.length) cuts.add(i + 1); }
    }
  }
  const b = Array.from(cuts).sort((x, y) => x - y);
  const spans: Array<[number, number]> = [];
  for (let i = 0; i + 1 < b.length; i++) if (b[i + 1] > b[i]) spans.push([b[i], b[i + 1]]);
  return spans;
}

const wb = (p: string) => new RegExp(`(?<![\\w-])(?:${p})(?![\\w-])`, 'gi');
function compileAll(pats: string[]): RegExp[] { const o: RegExp[] = []; for (const p of pats) { try { o.push(wb(p)); } catch { /* isolate one bad regex */ } } return o; }
function clauseBounds(pos: number, spans: Array<[number, number]>): [number, number] { for (const [a, b] of spans) if (a <= pos && pos < b) return [a, b]; return spans.length ? spans[spans.length - 1] : [0, 0]; }
function hasNegator(prefix: string): boolean { return NEGATORS.some(n => new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(prefix)); }
const anyMatch = (res: RegExp[], s: string) => res.some(r => { r.lastIndex = 0; return r.test(s); });

export function evaluateLane(lane: any, prompt: string, reg: any): LaneScore {
  const text = blankInformational(laneSanitize(prompt));
  const spans = segmentClauses(text);
  const ui = compileAll(reg.scope.ui_evidence);
  const negs = compileAll(reg.scope.negative_filters);
  const groups: Record<string, number> = {}; const evIds: string[] = [];
  let nIn = 0, nUnknown = 0, nOos = 0;
  for (const entry of lane.lexicon) {
    let rx: RegExp; try { rx = wb(entry.pattern); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m.index === rx.lastIndex) rx.lastIndex++;
      const [a, b] = clauseBounds(m.index, spans);
      const clause = text.slice(a, b);
      if (hasNegator(text.slice(a, m.index))) continue;
      if (anyMatch(negs, clause)) { nOos++; continue; }
      if (anyMatch(ui, clause)) nIn++; else nUnknown++;
      const g = entry.group || entry.pattern;
      groups[g] = Math.max(groups[g] || 0, Number(entry.weight) || 1);
      evIds.push(entry.pattern);
    }
  }
  let score = Object.values(groups).reduce((s, w) => s + w, 0);
  let scope: string;
  if (nIn > 0) scope = 'IN_SCOPE';
  else if (nUnknown === 0 && nOos > 0) { scope = 'OUT_OF_SCOPE'; score = 0; }
  else scope = 'SCOPE_UNKNOWN';
  return { lane: lane.lane, label: lane.label, score, scope, evidenceIds: evIds.slice(0, 3) };
}

// 7-frame informational set that MIRRORS the Python classifier's
// is_informational (sidecoach_lanes.py) - NOT the 9-frame hook isInformational
// exported above. Renamed to avoid the export collision and the behavioral drift.
function laneIsInformational(text: string, pattern: string): boolean {
  const frames = [
    `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bwhat['’]s\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${pattern}(?![\\w-])`,
    `\\bdefine\\s+${pattern}(?![\\w-])`,
    `(?<![\\w-])${pattern}\\s+is\\s+(?:a|an|the)\\b`,
  ];
  return frames.some(f => new RegExp(f, 'i').test(text));
}

export function detectVerb(text: string, verbs: any[]): string | null {
  for (const v of verbs) {
    const name = typeof v === 'string' ? v : v.verb;
    const patt = typeof v === 'string' ? v : (v.pattern || v.verb);
    if (!name || !patt) continue;
    let rx: RegExp; try { rx = new RegExp(`(?<![\\w-])(?:${patt})(?![\\w-])`, 'i'); } catch { continue; }
    if (rx.test(text) && !laneIsInformational(text, patt)) return name;
  }
  return null;
}

export function classifyIntent(prompt: string, reg: any, verbs: any[], opts?: { intentEligible?: boolean }): Decision {
  const res: Decision = { outcome: 'SILENT', winningLane: null, verbMatch: null, diagnosticLane: null, laneScores: [], schemaVersion: SCHEMA_VERSION };
  if (!prompt || !prompt.trim()) return res;
  if (/^\s*\/sidecoach\b/i.test(prompt)) return res;
  const text = blankInformational(laneSanitize(prompt));
  const scores = reg.lanes.map((l: any) => evaluateLane(l, prompt, reg));
  res.laneScores = scores;
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]; const second = ranked[1] ? ranked[1].score : 0;
  const verb = detectVerb(text, verbs); res.verbMatch = verb;
  const { route_floor: rf, route_margin: rm, classify_floor: cf } = reg.scoring;
  const routeGrade = top.scope === 'IN_SCOPE' && top.score >= rf && (top.score - second) >= rm;
  if (verb) {
    if (routeGrade) { res.outcome = 'CLASSIFY'; res.winningLane = top.lane; }
    else { res.outcome = 'VERB'; const diag = ranked.find(r => r.score > 0); res.diagnosticLane = diag ? diag.lane : null; }
    return res;
  }
  if (top.scope === 'IN_SCOPE' && top.score > 0) {
    res.winningLane = top.lane;
    res.outcome = routeGrade ? 'ROUTE' : (top.score >= cf ? 'CLASSIFY' : 'SILENT');
    if (res.outcome !== 'SILENT') return res;
  }
  const unknown = ranked.find(r => r.scope === 'SCOPE_UNKNOWN' && r.score > 0);
  if (unknown) { res.outcome = 'CONTEXT_CHECK'; res.winningLane = unknown.lane; return res; }
  const oos = scores.some((r: LaneScore) => r.scope === 'OUT_OF_SCOPE');
  if (opts && opts.intentEligible) { res.outcome = 'NUDGE_ELIGIBLE'; return res; }
  res.outcome = oos ? 'OUT_OF_SCOPE' : 'SILENT';
  return res;
}

function hookEligibilitySanitize(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\b(?:https?|file|ftp):\/\/\S+/gi, ' ')
    .replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, ' ')
    .replace(/<[a-zA-Z!/][^>]*>/g, ' ')
    .replace(/\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi, ' ');
}

function hookEligibilityIsInformational(text: string, pattern: string): boolean {
  const frames = [
    `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bwhat['\\u2019]s\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\btell\\s+me\\s+about\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${pattern}(?![\\w-])`,
    `\\bdefine\\s+${pattern}(?![\\w-])`,
    `(?<![\\w-])${pattern}\\s+is\\s+(?:a|an|the)\\b`,
    `\\bwhat\\s+(?:the\\s+)?${pattern}\\s+(?:does|means|is)\\b`,
  ];
  return frames.some((frame) => new RegExp(frame, 'i').test(text));
}

export function intentEligible(prompt: string, intentReg: any): boolean {
  if (!intentReg) return false;
  const sanitized = hookEligibilitySanitize(prompt);
  const arr = (k: string): string[] => (Array.isArray(intentReg[k]) ? intentReg[k] : []);
  const actions = arr('actions');
  const targets = arr('substantive_targets');
  const standalone = arr('standalone');
  const exempt = arr('exempt');
  const newBuild = arr('new_build');

  const mlist = (pats: string[]): string[] => {
    const out: string[] = [];
    for (const p of pats) {
      if (typeof p !== 'string' || !p) continue;
      let rx: RegExp;
      try { rx = new RegExp(`(?<![\\w-])${p}(?![\\w-])`, 'i'); } catch { continue; }
      if (rx.test(sanitized)) out.push(p);
    }
    return out;
  };
  const subst = (pats: string[]): string[] =>
    mlist(pats).filter((p) => !hookEligibilityIsInformational(sanitized, p));

  const hasAction = mlist(actions).length > 0;
  const hasTarget = subst(targets).length > 0;
  const hasStandalone = subst(standalone).length > 0;
  const hasExempt = mlist(exempt).length > 0;
  const hasNewBuild = mlist(newBuild).length > 0;

  let fires = hasStandalone || (hasAction && hasTarget);
  if (hasExempt && !hasNewBuild && !hasStandalone) fires = false;
  return fires;
}
