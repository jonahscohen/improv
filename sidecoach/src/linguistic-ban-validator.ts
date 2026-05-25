/**
 * Linguistic Ban Validator
 *
 * Detects AI-template-y language patterns in generated copy. This is the
 * validator that closes the largest forensic gap: yesterday's marketing site
 * shipped "Memory in layers. Not a feature, a discipline.", "Not a platform.
 * Not a framework. Not for everyone.", and "Stop describing the UI. Show it."
 * - all three are named templates the absorbed taste-skill content bans by
 * pattern, but no validator was checking for them.
 *
 * Two detection layers:
 *
 * 1. Slop word scan - exact-word matching against the ~30-entry taste-skill
 *    ban list (Elevate, Seamless, Unleash, Delve, Tapestry, Acme, Nexus, etc).
 *    Each hit is a P1 finding.
 *
 * 2. Rhetorical-template scan - regex-matched named templates from
 *    reference-loader.loadRhetoricalPatterns(). The 8 patterns currently cover:
 *    triplet-negation, negation-as-positioning, imperative-pair, world-of-opener,
 *    realm-of-opener, tapestry-prose, goes-without-saying, delve-into.
 *    Each match is a P0 finding (the templates are the loudest tells).
 *
 * Both layers operate on plain text - HTML/markdown formatting is stripped
 * before scanning. Code blocks and inline code are exempt (a slop word in a
 * code sample is documenting the ban, not committing it).
 *
 * Used by flowJ tactical-polish to scan generated copy before sign-off, and
 * available standalone for any flow that emits user-facing text.
 */

import { loadSlopWordList, loadRhetoricalPatterns } from './reference-loader';

export type LinguisticFindingSeverity = 'P0' | 'P1' | 'P2';

export interface LinguisticFinding {
  severity: LinguisticFindingSeverity;
  type: 'slop-word' | 'rhetorical-template';
  match: string;
  context: string;
  patternName?: string;
  remediation: string;
}

export interface LinguisticBanReport {
  scanned: number;
  findings: LinguisticFinding[];
  summary: string;
}

/**
 * Strip HTML tags, code blocks, and inline code from input. We do not want
 * to flag a slop word that appears inside a code sample (it's documentation,
 * not generated copy).
 */
function stripNonProseSegments(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`[^`\n]+`/g, ' ') // inline code
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, ' ') // <code>...</code>
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, ' ') // <pre>...</pre>
    .replace(/<[^>]+>/g, ' ') // any other HTML tags
    .replace(/\s+/g, ' ');
}

function getContext(prose: string, matchStart: number, matchLength: number, contextRadius: number = 40): string {
  const start = Math.max(0, matchStart - contextRadius);
  const end = Math.min(prose.length, matchStart + matchLength + contextRadius);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < prose.length ? '...' : '';
  return `${prefix}${prose.slice(start, end).trim()}${suffix}`;
}

/**
 * Scan input prose for slop words. Word boundary-aware so "elevate" inside
 * "elevateButton" is not flagged but "Elevate your workflow" is. Multi-word
 * phrases (e.g. "In the world of") are matched as substrings.
 */
function scanSlopWords(prose: string): LinguisticFinding[] {
  const slopList = loadSlopWordList();
  const findings: LinguisticFinding[] = [];
  for (const entry of slopList) {
    const isMultiword = /\s/.test(entry);
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = isMultiword
      ? new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'gi')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = Array.from(prose.matchAll(regex));
    for (const match of matches) {
      if (match.index === undefined) continue;
      findings.push({
        severity: 'P1',
        type: 'slop-word',
        match: match[0],
        context: getContext(prose, match.index, match[0].length),
        remediation: `Replace "${match[0]}" with a specific verb or noun rooted in the project's PRODUCT.md voice. The slop word list is the predictable training-data default - avoiding it forces concrete writing.`,
      });
    }
  }
  return findings;
}

/**
 * Scan input prose for rhetorical-template patterns. Each pattern is a named
 * regex from reference-loader. Hits are P0 because templates are the loudest
 * AI-template signal.
 */
function scanRhetoricalPatterns(prose: string): LinguisticFinding[] {
  const patterns = loadRhetoricalPatterns();
  const findings: LinguisticFinding[] = [];
  for (const pattern of patterns) {
    const flags = pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g';
    const regex = new RegExp(pattern.regex.source, flags);
    const matches = Array.from(prose.matchAll(regex));
    for (const match of matches) {
      if (match.index === undefined) continue;
      findings.push({
        severity: 'P0',
        type: 'rhetorical-template',
        match: match[0],
        context: getContext(prose, match.index, match[0].length, 60),
        patternName: pattern.name,
        remediation: `${pattern.why} Rewrite this sentence with a sentence-specific construction. The template form is the failure mode.`,
      });
    }
  }
  return findings;
}

/**
 * Run the full linguistic-ban scan on a piece of generated copy.
 * Accepts HTML, markdown, or plain text. Strips formatting before scanning.
 *
 * @param input - The copy to scan
 * @param label - Optional label for the source (e.g. "marketing-site/index.html hero")
 */
export function scanForLinguisticBans(input: string, label?: string): LinguisticBanReport {
  if (!input || typeof input !== 'string') {
    return {
      scanned: 0,
      findings: [],
      summary: 'No input provided to scan.',
    };
  }
  const prose = stripNonProseSegments(input);
  const slopFindings = scanSlopWords(prose);
  const rhetoricalFindings = scanRhetoricalPatterns(prose);
  const findings = [...rhetoricalFindings, ...slopFindings];
  const p0Count = findings.filter((f) => f.severity === 'P0').length;
  const p1Count = findings.filter((f) => f.severity === 'P1').length;
  const sourceLabel = label ? ` in ${label}` : '';
  const summary =
    findings.length === 0
      ? `Linguistic ban scan: 0 findings${sourceLabel}. Copy passes both slop-word and rhetorical-template checks.`
      : `Linguistic ban scan: ${findings.length} findings${sourceLabel} (P0: ${p0Count} rhetorical templates, P1: ${p1Count} slop words). Address P0 findings before sign-off; P1 are strong recommendations.`;
  return {
    scanned: prose.length,
    findings,
    summary,
  };
}

/**
 * Convenience function for flow handlers: returns ready-to-append guidance lines
 * describing the findings, suitable for FlowExecutionResult.guidance.
 */
export function findingsToGuidance(report: LinguisticBanReport): string[] {
  if (report.findings.length === 0) {
    return [report.summary];
  }
  const lines: string[] = [report.summary, ''];
  for (const finding of report.findings) {
    if (finding.type === 'rhetorical-template') {
      lines.push(`[${finding.severity}] Rhetorical template (${finding.patternName}): "${finding.match}"`);
      lines.push(`    Context: ${finding.context}`);
      lines.push(`    Fix: ${finding.remediation}`);
    } else {
      lines.push(`[${finding.severity}] Slop word "${finding.match}"`);
      lines.push(`    Context: ${finding.context}`);
      lines.push(`    Fix: ${finding.remediation}`);
    }
    lines.push('');
  }
  return lines;
}
