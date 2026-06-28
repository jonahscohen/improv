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

    // gates - what Sidecoach pulled in to validate
    const gates = [];
    flows.forEach((f) => (f.validationResults || []).forEach((v) => gates.push(v)));
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

module.exports = { render };
