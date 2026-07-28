import { createExecutionEngine } from '../sidecoach-orchestrator';
import { getVerbList } from '../verb-command-registry';

// RETARGETED 2026-07-28 (Jonah). This suite is NOT a stale-count repair like its siblings.
//
// It originally asserted that `/sidecoach list` emitted a phase-grouped taxonomy - literal
// "Research Phase" / "Implement Phase" / "Review Phase" / "Special Phase" headings plus at
// least four "(N flows)" counts. Measured against the shipped command, NONE of that exists:
// the list emits a "## Verb commands" section and states outright that phase words are
// retired back-compat aliases. There is no number here to correct, because the grouping the
// suite described was removed, not renumbered. It printed `Result: FAIL` and exited 0, so the
// gate counted it green from the day the list was reworked until the runner defect was fixed
// in scripts/run-tests.ts on 2026-07-28.
//
// Deleting it was the alternative. Retargeting keeps more, because there is one property the
// file's own title ("Rich Taxonomy") is about that NO gated suite currently checks: the green
// gated sprint8-list-and-help.test.ts pins that each verb NAME appears and that the "verb
// commands" heading exists, but nothing anywhere asserts that a listed verb carries a
// DESCRIPTION. A list that degraded to bare verb names would pass every other suite in the
// repo. That gap is what this file now covers, so it asserts something real instead of
// something retired.
//
// Fail-loud: the original exited 0 no matter what it printed, which is the same defect class
// the runner fix exists to catch. It now sets its exit code from its own verdict, so it can
// report a failure standalone rather than relying on the runner's transcript scan.

createExecutionEngine()
  .process('/sidecoach list')
  .then((result: any) => {
    const guidance: string[] = result.guidance || [];
    const checks: Array<[string, boolean]> = [];

    // The verb section must exist and be the labelled surface, per the shipped list format.
    const hasVerbHeading = guidance.some((g) => /^##\s*Verb commands/i.test(g));
    checks.push(['T1: list emits a "## Verb commands" section', hasVerbHeading]);

    // Every `/sidecoach <verb> - <text>` entry must carry a non-empty description after the
    // separator. This is the uncovered property: sprint8-list-and-help only checks the verb
    // NAME is present somewhere in the joined output.
    const verbLines = guidance.filter((g) => /^\s*\/sidecoach\s+[a-z]+\s+-\s/.test(g));

    // NON-VACUITY GUARD, tightened after Codex review 2026-07-28 (Medium). `verbLines.length > 0`
    // alone was too weak: a list that regressed to rendering ONE described verb would still have
    // satisfied "every rendered line has a description" and passed. The contract this file is
    // named for is the FULL taxonomy, so the rendered set is compared against the registry that
    // defines it rather than merely being non-empty. This is what stops the checks below from
    // passing for the wrong reason.
    const registryVerbs = getVerbList();
    const renderedVerbs = verbLines
      .map((g) => (g.match(/^\s*\/sidecoach\s+([a-z]+)\s+-\s/) || [])[1])
      .filter(Boolean) as string[];
    const missing = registryVerbs.filter((v) => !renderedVerbs.includes(v));
    checks.push([
      `T2: list renders every verb in VERB_REGISTRY (${renderedVerbs.length}/${registryVerbs.length}${missing.length ? `, missing: ${missing.join(', ')}` : ''})`,
      registryVerbs.length > 0 && missing.length === 0,
    ]);

    const described = verbLines.filter((g) => {
      const after = g.replace(/^\s*\/sidecoach\s+[a-z]+\s+-\s/, '').trim();
      return after.length > 0;
    });
    checks.push([
      `T3: every verb entry carries a description (${described.length}/${verbLines.length})`,
      verbLines.length > 0 && described.length === verbLines.length,
    ]);

    // The descriptions must be substantive, not a placeholder. 20 chars is well under the
    // shortest real entry and well over any stub, so it discriminates without being brittle.
    const substantive = described.filter((g) => g.replace(/^\s*\/sidecoach\s+[a-z]+\s+-\s/, '').trim().length >= 20);
    checks.push([
      `T4: every description is substantive, not a stub (${substantive.length}/${verbLines.length})`,
      verbLines.length > 0 && substantive.length === verbLines.length,
    ]);

    // The list must point at the per-verb help surface, which is what makes the taxonomy
    // navigable rather than a wall of text.
    checks.push(['T5: list points at /sidecoach help <verb>', guidance.some((g) => /\/sidecoach help\b/.test(g))]);

    let allPass = true;
    for (const [label, ok] of checks) {
      console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
      if (!ok) allPass = false;
    }
    console.log(allPass ? 'task8-list-command-taxonomy PASS' : 'task8-list-command-taxonomy FAIL');
    process.exit(allPass ? 0 : 1);
  })
  .catch((error: any) => {
    console.error('task8-list-command-taxonomy errored:', error);
    process.exit(1);
  });
