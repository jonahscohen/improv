'use strict';

/**
 * Sidecoach presentation renderer.
 *
 * Turns an engine result (from sidecoach-orchestrator process()) into a
 * designed, low-noise terminal view that makes Sidecoach visibly PRESENT -
 * so a routed session no longer reads like vanilla Claude output. Pure
 * data-in / string-out: no side effects, no engine deps. ANSI truecolor,
 * honors NO_COLOR.
 *
 * Used by: bin/sidecoach-monitor.js  (the `--render` flag)
 * The marketing demo replays this same shape in the browser.
 */

const ON = !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const wrap = (s, code) => (ON ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = {
  orange: (s) => wrap(s, '38;2;217;121;78'),  // Sidecoach brand mark + accents
  green:  (s) => wrap(s, '38;2;143;181;115'),  // pass
  fg:     (s) => wrap(s, '38;2;231;228;223'),  // primary
  dim:    (s) => wrap(s, '38;2;140;137;132'),  // labels / secondary
  faint:  (s) => wrap(s, '38;2;92;90;86'),     // rules / de-emphasis
  bold:   (s) => wrap(s, '1'),
};

const GLYPH = { mark: '◆', phase: '◇', ok: '✓', no: '✗', skip: '-', arrow: '›', dot: '·' };
const WIDTH = 60;

// strip "flowK_multi_lens_audit" / "flowI_accessibility" -> "multi-lens audit"
function humanize(id) {
  if (!id) return '';
  return String(id).replace(/^flow[A-Z0-9]+_/, '').replace(/_/g, ' ').trim();
}
function progressBar(frac, width) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const filled = Math.round(f * width);
  // distinct glyphs (not just color) so the bar still reads under NO_COLOR
  return c.orange('▰'.repeat(filled)) + c.faint('▱'.repeat(width - filled));
}
function rule() { return c.faint('  ' + '─'.repeat(WIDTH)); }
function label(s) { return c.dim((s + '          ').slice(0, 10)); }
function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
// Text columns left after a visible prefix, capped so the line never exceeds the rule
// (WIDTH + 2 indent). Keeps staged-lens reasons and the `next` line within 60 cols + indent,
// including under NO_COLOR where there are no escape codes to hide the overflow.
function fit(prefixLen) { return Math.max(8, WIDTH + 2 - prefixLen); }

// Plain-English description per rule, so the report explains the finding, not just names it.
const RULE_DESC = {
  'low-contrast': 'contrast under 4.5:1',
  'gray-on-color': 'gray text on a colored background',
  'broken-image': 'image fails to load',
  'skipped-heading': 'heading level skipped',
  'justified-text': 'justified body text',
  'tiny-text': 'text under 12px',
  'nested-cards': 'a card nested inside a card',
  'marketing-buzzword': 'vague marketing copy',
};
function ruleDesc(rule) { return RULE_DESC[rule] || humanize(rule); }
// Spaces to right-flush `right` against the rule width, given a plain `left` of known length.
function gapTo(leftLen, rightLen) { return Math.max(2, WIDTH - leftLen - rightLen); }
// Turn a raw render error into a plain-English reason.
function cleanReason(r) {
  r = String(r || '');
  if (/ERR_CONNECTION_REFUSED/.test(r)) return 'connection refused';
  if (/ERR_NAME_NOT_RESOLVED/.test(r)) return 'host not found';
  if (/ERR_CONNECTION_TIMED_OUT|Timeout|timed out/i.test(r)) return 'connection timed out';
  const m = r.match(/ERR_[A-Z_]+/);
  if (m) return m[0].toLowerCase().replace(/^err_/, '').replace(/_/g, ' ');
  return r.split('\n')[0];
}

// --- SELF-CHECK SUPPRESSION, SHARED BY EVERY HUMAN SURFACE -------------------------------
// A ValidationResult declares what it measured. `artifact` means it inspected the USER'S work
// and its findings are real. Anything else - including an undeclared validator - inspected the
// FLOW'S OWN output ("does my guidance mention optimize?") and must never reach a human as a
// gate, a grade, or a failed rule.
//
// SAFE BY DEFAULT IN ONE DIRECTION (Codex review 2026-07-28). The predicate is an allowlist on
// an explicit 'artifact', not a denylist on 'flow-output', because the discriminator used to be
// unsafe in BOTH directions: the createDomainValidator factory defaulted to 'flow-output' (so a
// factory-built validator that forgot the flag was silently suppressed) while hand-built results
// left it undefined (so those still reported). What an undeclared validator got depended on how
// it happened to be constructed. Now a validator reaches the user only by saying so.
function measuresArtifact(v) {
  return !!v && v.measures === 'artifact';
}

/**
 * Strip flow-output self-checks out of a result before it is serialized to a human.
 * Used by bin/sidecoach-monitor.js --json, which previously emitted the raw result including
 * `failedRules: ['has_optimization_guidance']` - the same leak the panel had, on the machine-
 * readable surface. Returns a shallow copy; the input is never mutated.
 */
function stripFlowOutputSelfChecks(result) {
  if (!result || typeof result !== 'object') return result;
  const clean = (list) => (Array.isArray(list) ? list.filter(measuresArtifact) : list);
  const scrubFlow = (f) => {
    if (!f || typeof f !== 'object') return f;
    const out = { ...f };
    if (Array.isArray(f.validationResults)) out.validationResults = clean(f.validationResults);
    if (Array.isArray(f.domainValidationResults)) out.domainValidationResults = clean(f.domainValidationResults);
    return out;
  };
  const out = { ...result };
  if (Array.isArray(result.flowResults)) out.flowResults = result.flowResults.map(scrubFlow);
  if (Array.isArray(result.validationResults)) out.validationResults = clean(result.validationResults);
  return out;
}

// A FINAL audit REPORT (not a process view): verdict headline, findings grouped by category
// + rule with counts and plain-English descriptions, then concrete priority fixes with the
// full selector and the metric (never truncated mid-fact). Reads as a conclusion.
function renderAuditReport(a) {
  a = a || {};
  const L = [];
  const lenses = a.lenses || { objective: { available: false, findings: 0 }, subjective: { available: false, findings: 0 } };
  const vt = a.verdict || 'inconclusive';

  // INCONCLUSIVE: the audit could not certify the page - say so, why, and the fix. No findings.
  if (vt === 'inconclusive') {
    const partial = !!a.rendered; // a lens DID run, just not all of them
    L.push('  ' + c.dim('? ') + c.dim('inconclusive') + '      ' + c.faint('the audit could not run'));
    L.push('');
    const reasons = [];
    [lenses.objective, lenses.subjective].forEach((x) => {
      if (x && !x.available && x.reason) { const r = cleanReason(x.reason); if (r && !reasons.includes(r)) reasons.push(r); }
    });
    const lead = partial ? 'a detection lens did not run' : 'the page did not render';
    L.push('    ' + c.faint(lead + (reasons.length ? '  ·  ' + trunc(reasons[0], fit(37)) : '')));
    L.push('');
    const host = trunc(String(a.renderUrl || 'the URL').replace(/^https?:\/\//, ''), fit(38));
    L.push('    ' + c.dim('verify ') + c.fg(host) + c.dim(' is reachable, then re-run.'));
    L.push('    ' + c.faint('this is not a clean result.'));
    return L;
  }

  // VERDICT headline.
  const vmark = vt === 'clean' ? c.green(GLYPH.ok) : c.orange(GLYPH.no);
  const vcol = vt === 'clean' ? c.green(vt) : c.orange(vt);
  const n = a.totalFindings || 0;
  let head = '  ' + vmark + ' ' + vcol;
  if (a.grade) head += '       ' + c.dim('grade ') + c.fg(a.grade);
  head += '       ' + c.dim(n + ' finding' + (n === 1 ? '' : 's'));
  L.push(head);
  L.push('');

  // PARTIAL coverage caveat: a lens failed but the other found things - never let a partial
  // scan read as a full clean/blocked report (Codex P1).
  if (a.unavailableReasons && a.unavailableReasons.length) {
    L.push('  ' + c.orange('! ') + c.fg('partial scan') + c.faint('  ·  coverage incomplete, a lens did not run'));
    L.push('');
  }

  if (n === 0) { L.push('  ' + c.green('no accessibility or taste defects found.')); return L; }

  // CATEGORIES: accessibility (objective) + taste (subjective), each with its rule breakdown.
  [['accessibility', 'objective'], ['taste', 'subjective']].forEach(([catName, lens]) => {
    const total = (lenses[lens] && lenses[lens].findings) || 0;
    const tStr = String(total);
    L.push('  ' + c.fg(catName) + ' '.repeat(gapTo(catName.length, tStr.length)) + (total ? c.orange(tStr) : c.faint(tStr)));
    if (total === 0) { L.push('  ' + c.faint('  clean')); return; }
    (a.byRule || []).filter((r) => r.lens === lens).sort((x, y) => y.count - x.count).forEach((r) => {
      const rn = trunc(String(r.rule || ''), 18).padEnd(18);
      const cnt = trunc('×' + r.count, 5).padEnd(5);
      L.push('  ' + c.dim('  ' + rn) + ' ' + c.orange(cnt) + c.faint(trunc(ruleDesc(r.rule), fit(28))));
    });
  });
  L.push('');

  // PRIORITY FIXES: full selector + metric, right-aligned, never truncated mid-fact.
  const fixes = (a.topFixes || []).filter((f) => f.selector || f.metric);
  if (fixes.length) {
    L.push('  ' + c.dim('priority fixes'));
    fixes.forEach((f) => {
      const metric = trunc(f.metric || '', 12);
      let sel = f.selector || ('(' + f.rule + ')');
      const avail = WIDTH - 2 - metric.length - 2;
      if (sel.length > avail) sel = sel.slice(0, avail - 1) + '…';
      const gap = Math.max(2, WIDTH - 2 - sel.length - metric.length);
      L.push('  ' + '  ' + c.fg(sel) + ' '.repeat(gap) + c.orange(metric));
    });
  }
  return L;
}

/**
 * @param {object} result  engine result object
 * @param {string} utterance  the original request
 * @returns {string} designed multi-line presentation
 */
function render(result, utterance) {
  result = result || {};
  const L = [];
  const report = result.buildReport || {};
  const flow = result.detectedFlow || {};
  const flows = Array.isArray(result.flowResults) ? result.flowResults : [];
  const isAudit = !!result.audit;
  const verb = isAudit
    ? ('audit ' + trunc(String(result.audit.renderUrl).replace(/^https?:\/\//, ''), fit(23)))
    : (report.composite || humanize(flow.flowId) || 'flow');

  L.push('');
  L.push(rule());
  L.push('  ' + c.orange(GLYPH.mark) + ' ' + c.bold(c.fg('sidecoach')) + '  ' + c.dim(GLYPH.dot + ' ' + verb));
  if (utterance && !isAudit) L.push('  ' + c.faint('“') + c.dim(utterance) + c.faint('”'));
  L.push(rule());
  L.push('');

  // routing - the one beat that is unmistakably Sidecoach (suppressed for the audit REPORT,
  // which is a conclusion, not a process trace - no route/flow/conf machinery).
  if (!isAudit && (flow.flowName || flow.flowId)) {
    const conf = typeof flow.confidence === 'number' ? flow.confidence.toFixed(2) : '--';
    L.push('  ' + label('route') + c.fg(flow.flowName || humanize(flow.flowId)) +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim(String(flow.flowId || '').replace(/_.*/, '')) +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim('conf ') + c.orange(conf));
  }
  if (isAudit) {
    // the self-contained FINAL REPORT (verdict + grouped findings + concrete fixes) replaces
    // the generic flow phases/checklist/gates AND the generic verdict/next block below.
    renderAuditReport(result.audit).forEach((line) => L.push(line));
    L.push('');
  } else {
    if (flows.length) {
      const chain = flows.map((f) => humanize(f.flowId)).join('  ' + c.faint(GLYPH.arrow) + '  ');
      L.push('  ' + label('flow') + c.dim(chain));
    }
    L.push('');

    // phases - where each flow begins, and its status
    flows.forEach((f) => {
      const st = f.status === 'success' || f.status === 'completed'
        ? c.green('done')
        : f.status === 'skipped' ? c.faint('skipped') : c.dim(String(f.status || ''));
      L.push('  ' + c.orange(GLYPH.phase) + ' ' + c.fg(humanize(f.flowId)) + '  ' + c.faint('[') + st + c.faint(']'));
      if (f.status === 'skipped') {
        L.push('      ' + c.faint('prerequisites not met'));
      } else if (Array.isArray(f.guidance) && f.guidance.length) {
        // only the real "Dimension N: X (...)" lines, condensed to one word each
        const dims = f.guidance
          .filter((g) => /^Dimension \d+:/.test(g))
          .map((g) => g.replace(/^Dimension \d+:\s*/, '').replace(/\s*\(.*$/, '').trim().split(/\s+/)[0].toLowerCase())
          .filter(Boolean);
        if (dims.length) L.push('      ' + c.dim(dims.join('  ' + c.faint(GLYPH.dot) + '  ')));
      }
    });
    L.push('');

    // checklist handed to Claude (progress)
    const checklist = (flows[0] && Array.isArray(flows[0].checklist)) ? flows[0].checklist : [];
    if (checklist.length) {
      const done = checklist.filter((x) => x && x.completed).length;
      L.push('  ' + label('checklist') + progressBar(done / checklist.length, 18) + '  ' +
        c.dim(done + '/' + checklist.length) + ' ' + c.faint('handed to claude'));
    }

    // gates - what Sidecoach pulled in to validate.
    // FILTERED to validators that measured the USER'S ARTIFACT. Codex review 2026-07-28 (High):
    // the `measures` suppression added for BuildReport closed only that one consumer, and this
    // row pushed EVERY validationResult in with no filter - so `performance` (whose rule asks
    // "does my own guidance contain the word optimize?") kept printing a per-domain pass/fail
    // mark to the human on every single run, for every target, including a 0-byte file. A flow
    // grading its own guidance text is not a gate on the user's design.
    const gates = [];
    flows.forEach((f) => (f.validationResults || []).forEach((v) => { if (measuresArtifact(v)) gates.push(v); }));
    const grades = {};
    (report.domainGrades || []).forEach((g) => { grades[g.domain] = g; });
    if (gates.length) {
      gates.forEach((v, i) => {
        const g = grades[v.domain];
        const mark = v.status === 'pass' ? c.green(GLYPH.ok) : c.orange(GLYPH.no);
        const grade = g ? '  ' + c.dim(g.letter + ' ' + g.rulesPassed + '/' + g.rulesTotal) : '';
        L.push('  ' + label(i === 0 ? 'gates' : '') + mark + ' ' + c.fg(v.domain) + grade);
      });
    }
    L.push('');
  }

  // verdict + next (NON-audit only - the audit report above renders its own verdict + fixes).
  const verdict = isAudit ? '' : (report.verdict || '');
  if (verdict) {
    const vCol = verdict === 'clean' ? c.green(verdict) : c.orange(verdict);
    const n = (report.findings && report.findings.length) || (isAudit ? result.audit.totalFindings : 0);
    const grade = report.overallGrade || (isAudit ? result.audit.grade : '');
    let line = '  ' + c.orange(GLYPH.mark) + ' ' + c.dim('verdict') + '   ' + vCol;
    if (grade) line += '  ' + c.faint(GLYPH.dot) + ' ' + c.dim('grade ') + c.fg(grade);
    line += '  ' + c.faint(GLYPH.dot) + ' ' + c.dim(n + ' finding' + (n === 1 ? '' : 's'));
    L.push(line);
  }
  const nextSteps = Array.isArray(report.nextSteps) && report.nextSteps.length ? report.nextSteps
    : (Array.isArray(result.guidance) ? result.guidance : []);
  if (!isAudit && nextSteps.length) {
    L.push('  ' + c.orange(GLYPH.arrow) + ' ' + c.dim('next') + '      ' + c.dim(trunc(nextSteps[0], fit(14))));
  }
  L.push(rule());
  L.push('');

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// EXECUTIVE REPORT (Jonah 2026-07-04): the code-enforced, user-facing surface.
// The engine renders the format so it cannot drift into agent-composed prose.
// Plain Markdown (no ANSI, no panel chrome): one `####` block per finding-
// category, each a table (Before | After for build/polish, Finding | Fix for
// audits) followed by a one-or-two-sentence plain-language summary, closed by
// exactly ONE status line. No process narration, no gate-by-gate accounting.
// ---------------------------------------------------------------------------

// Concrete remediation per rule - the "Fix" / "After" cell when a finding carries none.
const RULE_FIX = {
  'low-contrast': 'raise the text or background contrast to at least 4.5:1',
  'gray-on-color': 'darken the text or lighten the background until the pair clears 4.5:1',
  'broken-image': 'repair or replace the image source so it loads',
  'skipped-heading': 'restore the missing heading level so the outline stays sequential',
  'justified-text': 'set the body text to left-aligned',
  'tiny-text': 'raise the font size to at least 12px',
  'nested-cards': 'flatten the inner card or swap it for a lighter container',
  'marketing-buzzword': 'replace the vague copy with a concrete, specific claim',
};
// Why each defect matters - the tail clause of the plain-language summary.
const RULE_WHY = {
  'low-contrast': 'low-contrast text is hard to read, especially for low-vision users',
  'gray-on-color': 'gray text on a colored background usually fails contrast and strains the eye',
  'broken-image': 'a broken image leaves a hole where real content should be',
  'skipped-heading': 'a skipped level breaks the outline that screen readers depend on',
  'justified-text': 'justified body text opens uneven gaps that slow reading',
  'tiny-text': 'text under 12px is hard to read on most screens',
  'nested-cards': 'a card inside a card blurs the visual hierarchy',
  'marketing-buzzword': 'vague marketing language reads as filler and weakens trust',
};

function cap(s) { s = String(s == null ? '' : s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
// "flowJ_tactical_polish" / "low-contrast" -> "tactical polish" / "low contrast"
function humRule(rule) { return String(rule == null ? '' : rule).replace(/^flow[A-Z0-9]+_/, '').replace(/[_-]+/g, ' ').trim(); }
function titleRule(rule) { const h = humRule(rule); return h ? cap(h) : 'Finding'; }
function ruleFix(rule, fix) {
  if (fix && String(fix).trim()) return String(fix).trim();
  return RULE_FIX[rule] || ('resolve the ' + (humRule(rule) || 'flagged') + ' issue on the affected element');
}
function ruleWhy(rule) { return RULE_WHY[rule] || 'it undercuts the finished result'; }
// Markdown table-cell safety: collapse whitespace, drop newlines, escape pipes.
function cell(s) { return String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'); }
function countWord(n, singular, plural) { return n + ' ' + (n === 1 ? singular : (plural || singular + 's')); }
function joinList(arr) {
  arr = (arr || []).filter(Boolean);
  if (arr.length <= 1) return arr.join('');
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}
function lensRank(lens) { return lens === 'objective' ? 0 : 1; }
function lensCategory(lens) { return lens === 'objective' ? 'accessibility' : 'taste'; }
// Coverage was partial if a reason is recorded OR either lens is explicitly unavailable.
// "clean" is a certification, so both signals must be checked before certifying (a lens
// object can say available:false without a matching unavailableReasons entry).
function coveragePartial(a) {
  if ((a.unavailableReasons || []).length > 0) return true;
  const ls = a.lenses || {};
  return [ls.objective, ls.subjective].some((x) => x && x.available === false);
}
function groupSeverityRank(g) {
  return g.some((f) => f.severity === 'blocking') ? 2 : g.some((f) => f.severity === 'warning') ? 1 : 0;
}

// AUDIT executive report: Finding | Fix tables, one block per rule.
function auditExecutive(a) {
  a = a || {};
  const host = String(a.renderUrl || 'the page').replace(/^https?:\/\//, '');
  const vt = a.verdict || 'inconclusive';
  const L = [];

  // INCONCLUSIVE: the audit could not certify the page. Say so, why, and the fix.
  if (vt === 'inconclusive') {
    const reasons = (a.unavailableReasons || []).map(cleanReason).filter(Boolean);
    const partial = !!a.rendered; // a lens DID run, just not all of them
    const lead = partial ? 'a detection lens did not run' : host + ' did not render';
    const why = partial ? 'one detection lens did not run' : 'the page did not render';
    L.push('#### Audit could not run');
    L.push('');
    L.push('| Finding | Fix |');
    L.push('| --- | --- |');
    L.push('| ' + cell(lead + (reasons.length ? ' (' + reasons[0] + ')' : '')) + ' | ' + cell('confirm ' + host + ' is reachable, then re-run the audit') + ' |');
    L.push('');
    L.push('The audit could not certify ' + host + ' because ' + why + (reasons.length ? ' (' + reasons[0] + ')' : '') + '. This is not a clean result.');
    L.push('');
    L.push('Audit: inconclusive. The page could not be certified - re-run once it renders.');
    return L.join('\n');
  }

  // CLEAN: a real scan of both lenses found nothing. "clean" is a CERTIFICATION,
  // so only the genuine clean verdict with full coverage earns it - never a partial
  // scan and never a bare zero count (mirrors the fail-closed rule the audit producer
  // already enforces: partial + zero findings is inconclusive, handled above).
  const n = a.totalFindings || 0;
  const partial = coveragePartial(a);
  if (vt === 'clean' && !partial) {
    L.push('#### No defects found');
    L.push('');
    L.push('| Finding | Fix |');
    L.push('| --- | --- |');
    L.push('| ' + cell('none - both lenses scanned ' + host + ' clean') + ' | ' + cell('no action needed') + ' |');
    L.push('');
    L.push('The rendered scan of ' + host + ' found no accessibility or taste defects.');
    L.push('');
    L.push('Audit: clean. No findings.');
    return L.join('\n');
  }
  // Zero enumerable findings but NOT a certified-clean verdict (a non-clean verdict
  // with nothing listed, or partial coverage). Report it honestly, never as clean.
  if (n === 0) {
    L.push('#### No findings to list');
    L.push('');
    L.push('| Finding | Fix |');
    L.push('| --- | --- |');
    L.push('| ' + cell('no findings enumerated for ' + host + (partial ? ', and a detection lens did not run' : '')) + ' | ' + cell('re-run the audit with full lens coverage to certify the page') + ' |');
    L.push('');
    L.push('The scan of ' + host + ' listed no findings' + (partial ? ', but coverage was partial so the page is not certified clean' : '') + '.');
    L.push('');
    // Partial coverage can never be certified clean, so downgrade the echoed verdict to
    // inconclusive here even if the input claimed clean (a contradictory state).
    const effVerdict = partial ? 'inconclusive' : vt;
    L.push('Audit: ' + effVerdict + (partial ? ', coverage partial - a lens did not run.' : ', no findings enumerated.'));
    return L.join('\n');
  }

  // FINDINGS: one block per rule (accessibility lens first, then taste), highest count first.
  const byRule = (a.byRule || []).slice().sort((x, y) => lensRank(x.lens) - lensRank(y.lens) || y.count - x.count);
  const fixes = a.topFixes || [];
  let categories = 0;
  byRule.forEach((r) => {
    categories++;
    const rows = fixes.filter((f) => f.rule === r.rule && (f.selector || f.metric));
    L.push('#### ' + titleRule(r.rule));
    L.push('');
    L.push('| Finding | Fix |');
    L.push('| --- | --- |');
    if (rows.length) {
      rows.forEach((f) => {
        const sel = f.selector || ('(' + r.rule + ')');
        const finding = sel + (f.metric ? ' (' + f.metric + ')' : '') + ' - ' + ruleDesc(r.rule);
        L.push('| ' + cell(finding) + ' | ' + cell(ruleFix(r.rule)) + ' |');
      });
      if (r.count > rows.length) {
        L.push('| ' + cell(countWord(r.count - rows.length, 'more element') + ' - ' + ruleDesc(r.rule)) + ' | ' + cell(ruleFix(r.rule)) + ' |');
      }
    } else {
      L.push('| ' + cell(countWord(r.count, 'element') + ' - ' + ruleDesc(r.rule)) + ' | ' + cell(ruleFix(r.rule)) + ' |');
    }
    L.push('');
    L.push(cap(countWord(r.count, lensCategory(r.lens) + ' issue')) + ' flagged as ' + ruleDesc(r.rule) + ', and ' + ruleWhy(r.rule) + '.');
    L.push('');
  });

  // STATUS line: verdict + total + coverage.
  const objN = (a.lenses && a.lenses.objective && a.lenses.objective.findings) || 0;
  const subN = (a.lenses && a.lenses.subjective && a.lenses.subjective.findings) || 0;
  const parts = [];
  if (objN) parts.push(countWord(objN, 'accessibility finding'));
  if (subN) parts.push(countWord(subN, 'taste finding'));
  L.push('Audit: ' + vt + ', ' + countWord(n, 'finding') + ' across ' + countWord(categories, 'category', 'categories') +
    (parts.length ? ' (' + parts.join(', ') + ')' : '') + (partial ? '. Coverage partial - a lens did not run.' : '.'));
  return L.join('\n');
}

// BUILD / POLISH executive report: Before | After tables, one block per finding rule.
function buildExecutive(result) {
  const report = result.buildReport || {};
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const verdict = report.verdict || 'clean';
  const grade = report.overallGrade || '';
  const L = [];

  // NOTHING WAS MEASURED is not the same as NOTHING WAS WRONG.
  //
  // Codex review 2026-07-28 (High): `const verdict = report.verdict || 'clean'` above synthesizes
  // a CLEAN verdict out of a MISSING report, and the no-findings block below then prints
  // "Checks passed. 0 findings." So every code path that deliberately withholds a BuildReport -
  // an audit whose target never rendered, a verb handed a page it does not scan, and any verb
  // handled before the target guard - still reached the human as a pass. That is the same
  // false-clean defect as the panel's `grade A`, one surface over.
  //
  // A result that produced no report at all cannot certify anything, so it says so instead.
  //
  // WHY THERE IS NO "did we measure a page?" TEST HERE.
  //
  // The original defect was real: `/sidecoach document index.html` produced no BuildReport and no
  // audit block, and this function's `report.verdict || 'clean'` then printed
  // "Checks passed. 0 findings." for a page nothing had opened (Codex 2026-07-28, High).
  //
  // My first two fixes both tried to INFER the answer here from what was missing, and both
  // over-captured, each in the same way:
  //   1. `!result.buildReport` swept up `/sidecoach list` and `/sidecoach help`, which execute
  //      nothing and claim nothing about a page.
  //   2. `executedFlows > 0 && !result.buildReport` then swept up `/sidecoach document` and
  //      `/sidecoach teach`, which DO run a handler and legitimately produce no report.
  //
  // Absence is not a signal. The fix belongs upstream, and now lives there: EVERY path handed a
  // page-shaped target attaches an `audit` block with `rendered: false` - including the two setup
  // commands that return before the target guard, which is what actually closed the original
  // hole. renderExecutiveReport routes anything carrying `result.audit` to auditExecutive, which
  // has always reported inconclusive correctly. So a result that reaches THIS function made no
  // claim about a page, and the clean-pass wording below is the right answer for it.
  // Asserted end-to-end (not against a synthetic fixture) in flow-target-render.test.ts.

  // No findings: name what ran, then a clean pass. (Covers clean builds and routing-only flows.)
  if (!findings.length) {
    const flows = Array.isArray(result.flowResults) ? result.flowResults : [];
    const ran = flows.map((f) => humanize(f.flowId)).filter(Boolean);
    L.push('#### ' + (report.composite ? cap(report.composite) : 'Result'));
    L.push('');
    L.push('| Before | After |');
    L.push('| --- | --- |');
    L.push('| ' + cell('no blocking or warning findings') + ' | ' + cell('no change needed') + ' |');
    L.push('');
    L.push(ran.length
      ? cap(joinList(ran)) + ' completed with no blocking or warning findings.'
      : 'The build completed with no blocking or warning findings.');
    L.push('');
    L.push('Checks passed. ' + (grade ? 'Grade ' + grade + ', ' : '') + '0 findings.');
    return L.join('\n');
  }

  // Group findings by rule, then order blocking-heaviest groups first.
  const groups = new Map();
  const order = [];
  findings.forEach((f) => {
    const key = f.rule || f.source || 'finding';
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(f);
  });
  order.sort((a, b) => groupSeverityRank(groups.get(b)) - groupSeverityRank(groups.get(a)) || groups.get(b).length - groups.get(a).length);

  order.forEach((key) => {
    const g = groups.get(key);
    L.push('#### ' + titleRule(key));
    L.push('');
    L.push('| Before | After |');
    L.push('| --- | --- |');
    g.forEach((f) => {
      L.push('| ' + cell(f.message || ruleDesc(f.rule)) + ' | ' + cell(ruleFix(f.rule, f.fix)) + ' |');
    });
    L.push('');
    const blk = g.filter((f) => f.severity === 'blocking').length;
    let s = cap(countWord(g.length, humRule(key) + ' finding'));
    if (blk) s += ' (' + countWord(blk, 'blocking') + ')';
    s += ' flagged; ' + ruleWhy(key) + '.';
    L.push(s);
    L.push('');
  });

  // STATUS line: verdict + severity breakdown + grade.
  const counts = report.severityCounts || {};
  const total = findings.length;
  const parts = [];
  if (counts.blocking) parts.push(countWord(counts.blocking, 'blocking'));
  if (counts.warning) parts.push(countWord(counts.warning, 'warning'));
  if (counts.info) parts.push(countWord(counts.info, 'info'));
  L.push(cap(verdict) + ': ' + countWord(total, 'finding') + (parts.length ? ' (' + parts.join(', ') + ')' : '') +
    (grade ? ', grade ' + grade : '') + '.');
  return L.join('\n');
}

/**
 * Render the user-facing EXECUTIVE REPORT from the same structured engine result
 * that render() consumes. Markdown, code-enforced format (see block comment above).
 *
 * @param {object} result  engine result object (audit-shaped or build-shaped)
 * @param {string} utterance  the original request (accepted for signature parity)
 * @returns {string} the executive report as Markdown
 */
function renderExecutiveReport(result, utterance) {
  result = result || {};
  if (result.audit) return auditExecutive(result.audit);
  return buildExecutive(result);
}

module.exports = { render, renderExecutiveReport, measuresArtifact, stripFlowOutputSelfChecks };
