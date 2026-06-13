// ===========================================================================
// Lane classifier (P1) - ENGINE copy.
//
// This is a DUPLICATE of the classifier core in
// sidecoach/mcp-server/src/keyword-resolver.ts and a behavioral MIRROR of the
// Python classifier in claude/hooks/sidecoach_lanes.py.
//
// WHY A DUPLICATE (not a shared import): the engine (sidecoach/src) and the MCP
// server (sidecoach/mcp-server/src) are separate TS packages, each with
// `rootDir: ./src`. An mcp-server file importing `../../src/lane-classifier`
// builds under ts-node but FAILS `tsc` with TS6059 (outside rootDir), which
// would break `npm run build` in mcp-server. So each package keeps its own
// copy. The shared parity corpus (sidecoach/parity/classifier-corpus.json) is
// run against ALL THREE copies (this engine module, the mcp-server module, and
// the Python module) so they cannot drift - see the *-parity tests.
//
// Keep the function bodies below IDENTICAL to keyword-resolver.ts's lane block.
// Pure regex, no LLM/network (model-router-guard).
// ===========================================================================

import * as fs from 'fs';

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
// Each stripped region becomes equal-length spaces so clause offsets stay valid.
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
// is_informational (sidecoach_lanes.py) - NOT the 9-frame hook isInformational.
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
