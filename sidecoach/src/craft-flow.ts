// Flow glue: turn a flow's domain into a craft brief plus its enumerated findings.
//
// WHY THIS IS ONE HELPER AND NOT TWENTY COPIES.
//
// `flow-handler-tactical-polish.ts` wired the reference brief by hand: collect, validate, map failing
// rules to subjects, render, splice into `guidance`. That was right for the first one and wrong to
// repeat twenty times - twenty copies of the selection policy drift apart, and the cap, the
// ordering, the header wording and the findings format stop matching between verbs. A reader who
// learns to read one payload should be able to read all of them.
//
// So the policy lives here once and each handler contributes only its DOMAIN: which registry rules
// are its business, which law domains it teaches, and what to call itself in the header.
//
// THE TWO SHAPES, AND WHY BOTH ARE HONEST.
//
// Sidecoach verbs split cleanly in two, and they need different briefs:
//
//   CHECK flows (audit, critique, a11y, responsive, the QA pipeline) run against something that
//   already exists. Their brief is FINDINGS-driven: selected from the rules that actually failed,
//   hardest-first, capped, cap disclosed. A clean project gets no brief, which is the point - a
//   constant block appended to every run teaches nothing and is the defect this replaces.
//
//   PRODUCE flows (craft, shape, animate, colorize, tokens, copy) run to make something, often
//   before the artifact exists. "Nothing failed" is not a useful payload for a flow whose whole job
//   is to make something good in the first place, so their brief is the up-front STANDARD - and it
//   says so, in its own second line, rather than implying a measurement that did not happen. When
//   the project does have failures in their domain, those are enumerated as well: a producer about
//   to add a component to a page with three failing a11y rules should be told.
//
// WHAT THIS NEVER DOES. It does not change any verdict, suppress any finding, or weaken any
// detector. It reads the probe and produces lines. The findings it enumerates are UNCAPPED - the cap
// applies only to how many notes are TAUGHT, so the brief withholds an explanation, never a finding.

import {
  probeProject, failedInClasses, failedInKeys, inconclusiveInClasses, inconclusiveInKeys,
  ProbedRule, CraftProbe,
} from './craft-probe';
import { craftBriefLines, resolveCraftNote, MAX_BRIEF_NOTES } from './craft-corpus';
import { lawKeysForDomains } from './craft-laws';

/** What a flow declares about its own domain. */
export interface FlowCraftSpec {
  /**
   * `check` - teach what failed; teach nothing when clean.
   * `produce` - teach the up-front standard, and additionally enumerate any failures in scope.
   */
  shape: 'check' | 'produce';
  /** Registry finding classes this flow owns: polish, a11y, theming, anti-pattern. Empty means all. */
  findingClasses?: string[];
  /** An explicit canonical-rule allowlist, used instead of findingClasses when the flow is narrower. */
  ruleKeys?: string[];
  /** Law domains this flow teaches when running in `produce` shape. See craft-laws.lawDomains(). */
  lawDomains?: string[];
  /** Phrase for the header, e.g. "responsive behaviour". */
  domainLabel?: string;
  /** Note cap override. Defaults to MAX_BRIEF_NOTES. */
  limit?: number;
}

export interface FlowCraftResult {
  /** The brief lines, ready to splice above a FINDINGS boundary. [] when there is nothing to teach. */
  brief: string[];
  /**
   * Which shape of brief was produced.
   *
   * `clean` means every in-scope rule was actually DECIDED and passed. `inconclusive` means nothing
   * failed but some in-scope rule could not be decided from static source - a distinction the first
   * version of this file collapsed into `clean`, which made a payload claim "every checked rule in
   * this domain passed" for an accessibility domain whose contrast and hit-area rules had never been
   * evaluated. Cross-model review 2026-07-29 (High). A guidance payload may report what it measured
   * and may report that it could not measure; it may not report the second as the first.
   */
  mode: 'findings' | 'standard' | 'clean' | 'inconclusive' | 'unmeasured';
  /** Every failing rule in scope, named with its measured message and a fix. UNCAPPED. */
  findingLines: string[];
  /** The failing rules in scope, for a caller that wants the raw list. */
  failed: ProbedRule[];
  /**
   * The in-scope rules that could NOT be decided from static source. Carried so a caller can never
   * present an undecided domain as a passing one; `craftGuidanceBlock` names the count.
   */
  undecided: ProbedRule[];
  /** True when at least one source file was actually inspected. */
  measured: boolean;
  inspectedFiles: number;
  /** One line stating what was and was not checked, so a payload never implies more than it did. */
  scopeLine: string;
}

/** The failing rules in this flow's scope, honouring ruleKeys over findingClasses. */
function inScope(probe: CraftProbe, spec: FlowCraftSpec): ProbedRule[] {
  if (spec.ruleKeys && spec.ruleKeys.length > 0) return failedInKeys(probe, spec.ruleKeys);
  return failedInClasses(probe, spec.findingClasses ?? []);
}

/** The UNDECIDED rules in this flow's scope, by the same precedence. */
function undecidedInScope(probe: CraftProbe, spec: FlowCraftSpec): ProbedRule[] {
  if (spec.ruleKeys && spec.ruleKeys.length > 0) return inconclusiveInKeys(probe, spec.ruleKeys);
  return inconclusiveInClasses(probe, spec.findingClasses ?? []);
}

/**
 * Name every failing rule with the validator's own measured message and a concrete fix.
 *
 * The measured remediation wins over the corpus, because it was produced against this project's
 * actual evidence. Where neither resolves, the line SAYS so rather than trailing off - a payload
 * that promises every failure arrives with a fix has to keep that promise visibly.
 */
export function findingLinesFor(failed: ProbedRule[]): string[] {
  return failed.map((r) => {
    const fix = r.remediation || resolveCraftNote(r.canonicalRuleKey)?.fix ||
      'no remediation recorded for this rule';
    const where = r.evidenceLocations.length ? ` (${r.evidenceLocations.slice(0, 3).join(', ')})` : '';
    return `- [${r.severity}] [${r.canonicalRuleKey}] ${r.message}${where} -> ${fix}`;
  });
}

/**
 * Build the craft payload for a flow.
 *
 * Never throws: an unreadable project yields `unmeasured` with the standard brief for a produce flow
 * and an explicit scope line either way. A guidance build must not crash because a directory could
 * not be walked, and it must not silently present an unwalked directory as clean.
 */
export async function flowCraft(
  projectPath: string | undefined,
  spec: FlowCraftSpec,
): Promise<FlowCraftResult> {
  const limit = spec.limit ?? MAX_BRIEF_NOTES;
  const lawSubjects = lawKeysForDomains(spec.lawDomains ?? []);

  // No project to read: a produce flow still has its standard to teach; a check flow has nothing.
  if (!projectPath) {
    const brief = spec.shape === 'produce'
      ? craftBriefLines(lawSubjects, { mode: 'standard', limit, domainLabel: spec.domainLabel })
      : [];
    return {
      brief,
      mode: spec.shape === 'produce' ? 'standard' : 'unmeasured',
      findingLines: [],
      failed: [],
      undecided: [],
      measured: false,
      inspectedFiles: 0,
      scopeLine: 'SCOPE: no project path was supplied, so nothing on disk was checked.',
    };
  }

  const probe = await probeProject(projectPath);
  const failed = inScope(probe, spec);
  const findingLines = findingLinesFor(failed);
  const scopeParts: string[] = [];
  if (!probe.measured) {
    scopeParts.push(
      probe.error
        ? `SCOPE: the project could not be read (${probe.error}), so nothing was checked - this is not a clean result.`
        : 'SCOPE: no CSS or markup source was found to inspect, so nothing was checked - this is not a clean result.',
    );
  } else {
    const classes = spec.ruleKeys?.length
      ? `${spec.ruleKeys.length} named rules`
      : `the ${(spec.findingClasses ?? []).join(', ') || 'all'} rule classes`;
    scopeParts.push(
      `SCOPE: ${probe.inspectedFiles} source file(s) inspected against ${classes} from static source only. ` +
      `${probe.inconclusive.length} rule(s) need a live render and are reported as inconclusive, not as passing.`,
    );
  }
  const scopeLine = scopeParts.join(' ');

  if (spec.shape === 'produce') {
    // The standard is the deliverable here; failures in the same domain are additional context.
    const brief = craftBriefLines(lawSubjects, {
      mode: 'standard',
      limit,
      domainLabel: spec.domainLabel,
      measuredNote: failed.length
        ? `${failed.length} rule(s) in this domain already fail on the current project and are listed under the brief.`
        : undefined,
    });
    return {
      brief,
      mode: probe.measured ? 'standard' : 'unmeasured',
      findingLines,
      failed,
      undecided: undecidedInScope(probe, spec),
      measured: probe.measured,
      inspectedFiles: probe.inspectedFiles,
      scopeLine,
    };
  }

  // check shape: teach what failed, nothing when clean.
  //
  // `clean` requires that every in-scope rule was actually DECIDED. Cross-model review 2026-07-29
  // (High): this branch previously returned `clean` on `failed.length === 0` alone, so an
  // accessibility check over static source - where contrast, hit-area and the rendered rules are all
  // inconclusive without a live render - emitted "every checked rule in this domain passed" about
  // rules it had never evaluated. Nothing failing is not the same as everything passing, and the
  // difference is the whole credibility of a clean result.
  if (failed.length === 0) {
    const undecided = undecidedInScope(probe, spec);
    return {
      brief: [],
      mode: probe.measured ? (undecided.length > 0 ? 'inconclusive' : 'clean') : 'unmeasured',
      findingLines,
      failed,
      undecided,
      measured: probe.measured,
      inspectedFiles: probe.inspectedFiles,
      scopeLine,
    };
  }
  const brief = craftBriefLines(failed.map((r) => r.canonicalRuleKey), {
    mode: 'findings',
    limit,
    domainLabel: spec.domainLabel,
  });
  return {
    brief,
    mode: 'findings',
    findingLines,
    failed,
    undecided: undecidedInScope(probe, spec),
    measured: probe.measured,
    inspectedFiles: probe.inspectedFiles,
    scopeLine,
  };
}

/**
 * The complete TEACH-then-CHECK block for a flow payload.
 *
 * Returns the brief, the boundary, the scope line, and the enumerated findings, in that order, ready
 * to splice into `guidance` above whatever the handler already emitted. Handlers call this rather
 * than assembling the order themselves, so TEACH always precedes CHECK in every verb.
 */
export function craftGuidanceBlock(result: FlowCraftResult, cleanMessage: string): string[] {
  const out: string[] = [];
  if (result.brief.length) {
    out.push(...result.brief);
  } else if (result.mode === 'clean') {
    out.push('CRAFT BRIEF: nothing to teach - every rule in this domain was evaluated and passed on this project.', '');
  } else if (result.mode === 'inconclusive') {
    // Cross-model review 2026-07-29 (High): this case used to fall into the `clean` message above and
    // claim "every checked rule in this domain passed" about rules that were never evaluated. Name the
    // undecided count and what would decide it instead, so the reader knows the difference between a
    // domain that passed and a domain nobody looked at.
    const n = result.undecided.length;
    out.push(
      `CRAFT BRIEF: nothing to teach - no rule in this domain FAILED. This is not a clean bill: ` +
      `${n} rule${n === 1 ? '' : 's'} could not be decided from static source and ${n === 1 ? 'was' : 'were'} ` +
      `not evaluated (${result.undecided.slice(0, 4).map((r) => r.canonicalRuleKey).join(', ')}` +
      `${n > 4 ? `, +${n - 4} more` : ''}). Those need a live render - run the audit against a served URL to decide them.`,
      '');
  } else {
    out.push(`CRAFT BRIEF: ${cleanMessage}`, '');
  }
  out.push('FINDINGS - what was actually measured on this project.');
  out.push(result.scopeLine);
  out.push('');
  if (result.findingLines.length) {
    out.push(`${result.findingLines.length} failing rule(s) in this flow's scope, each with its measured message and fix:`);
    out.push(...result.findingLines);
  } else if (result.measured) {
    out.push('No failing rules in this flow\'s scope.');
  }
  out.push('');
  return out;
}
