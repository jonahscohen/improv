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

/**
 * @param {object} result  engine result object
 * @param {string} utterance  the original request
 * @returns {string} designed multi-line presentation
 */
function render(result, utterance) {
  result = result || {};
  const L = [];
  const verb = (result.buildReport && result.buildReport.composite) || humanize(result.detectedFlow && result.detectedFlow.flowId) || 'flow';
  const flow = result.detectedFlow || {};
  const flows = Array.isArray(result.flowResults) ? result.flowResults : [];
  const report = result.buildReport || {};

  L.push('');
  L.push(rule());
  L.push('  ' + c.orange(GLYPH.mark) + ' ' + c.bold(c.fg('sidecoach')) + '  ' + c.dim(GLYPH.dot + ' ' + verb));
  if (utterance) L.push('  ' + c.faint('“') + c.dim(utterance) + c.faint('”'));
  L.push(rule());
  L.push('');

  // routing - the one beat that is unmistakably Sidecoach
  if (flow.flowName || flow.flowId) {
    const conf = typeof flow.confidence === 'number' ? flow.confidence.toFixed(2) : '--';
    L.push('  ' + label('route') + c.fg(flow.flowName || humanize(flow.flowId)) +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim(String(flow.flowId || '').replace(/_.*/, '')) +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim('conf ') + c.orange(conf));
  }
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

  // verdict + next
  if (report.verdict) {
    const v = report.verdict === 'clean' ? c.green(report.verdict) : c.orange(report.verdict);
    const n = (report.findings || []).length;
    L.push('  ' + c.orange(GLYPH.mark) + ' ' + c.dim('verdict') + '   ' + v +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim('grade ') + c.fg(report.overallGrade || '?') +
      '  ' + c.faint(GLYPH.dot) + ' ' + c.dim(n + ' finding' + (n === 1 ? '' : 's')));
  }
  if (Array.isArray(report.nextSteps) && report.nextSteps.length) {
    L.push('  ' + c.orange(GLYPH.arrow) + ' ' + c.dim('next') + '      ' + c.dim(report.nextSteps[0]));
  }
  L.push(rule());
  L.push('');

  return L.join('\n');
}

module.exports = { render };
