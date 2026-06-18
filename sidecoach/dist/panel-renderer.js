"use strict";
// Sidecoach panel renderer - the compact terminal card.
// Pure + deterministic. Reproduces the marketing demo's `.scd-sc` panel
// (marketing-site/demo.js ~lines 133-210, demo.css `.scd-*`) as monospace text
// the model prints verbatim. Glyphs are written as \u escapes so this source
// stays ASCII (content-guard friendly) while the runtime emits the real
// characters. ANSI truecolor matches the demo's --scd-* tokens; NO_COLOR (or
// opts.color:false) yields a plain, copy-safe card.
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSidecoachPanel = renderSidecoachPanel;
// Resolved demo color tokens (demo.css): orange #D9794E, green #8FB573,
// fg #E7E4DF, plus dim/faint label greys (the --scd-dim/--scd-faint rgba over
// the #191815 screen).
const C = {
    orange: '217;121;78',
    green: '143;181;115',
    fg: '231;228;223',
    dim: '150;148;143',
    faint: '120;118;114',
};
// Glyphs (\u escapes -> real chars at runtime).
const G = {
    mark: '◆', // diamond - header + verdict
    phase: '◇', // hollow diamond - phase rows
    bar: '▰', // black vertical rectangle - progress bar
    chevron: '›', // single right chevron - flow chain separator
    dot: '·', // middle dot - separators
    vbar: '│', // light vertical - left accent (mirrors border-left)
    check: '✓', // check - gate pass
    cross: '✗', // ballot x - gate fail
};
function renderSidecoachPanel(model, opts = {}) {
    const color = opts.color ?? !process.env.NO_COLOR;
    const paint = (rgb, s) => (color ? `\x1b[38;2;${rgb}m${s}\x1b[0m` : s);
    const fg = (s) => paint(C.fg, s);
    const dim = (s) => paint(C.dim, s);
    const faint = (s) => paint(C.faint, s);
    const orange = (s) => paint(C.orange, s);
    const green = (s) => paint(C.green, s);
    const accent = orange(G.vbar) + ' ';
    const lines = [];
    const push = (s = '') => lines.push(accent + s);
    // Header: "<diamond> sidecoach . <verb/flow>"
    const subtitle = model.verb || model.flowName.toLowerCase();
    push(`${orange(G.mark)} ${fg('sidecoach')} ${dim(`${G.dot} ${subtitle}`)}`);
    push();
    // route + flow chain
    const conf = typeof model.confidence === 'number' ? dim(` ${G.dot} conf ${model.confidence.toFixed(2)}`) : '';
    push(`${dim('route')}   ${fg(model.flowName)} ${dim(`${G.dot} ${model.flowId}`)}${conf}`);
    if (model.chain.length > 0) {
        push(`${dim('flow')}    ${model.chain.map((c) => dim(c)).join(faint(` ${G.chevron} `))}`);
    }
    push();
    // checklist progress bar
    const total = model.checklist.length || 1;
    const done = model.checklist.filter((c) => c.done).length;
    const width = Math.max(8, opts.width ?? 16);
    const filled = Math.round((done / total) * width);
    const bar = orange(G.bar.repeat(filled)) + faint(G.bar.repeat(Math.max(0, width - filled)));
    push(`${dim('checklist')} ${bar} ${dim(`${done}/${total}`)}`);
    push();
    // phases (one per chain step) + the headline phase's dims line
    const headlineLabel = model.flowName.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    for (const item of model.checklist) {
        const phaseMark = item.done ? green(G.phase) : orange(G.phase);
        const state = item.done ? green('[done]') : faint('[running]');
        push(`${phaseMark} ${fg(item.label)} ${state}`);
        if (model.dims && model.dims.length > 0 && item.label === headlineLabel) {
            push(`  ${model.dims.map((d) => dim(d)).join(faint(` ${G.dot} `))}`);
        }
    }
    push();
    // gates: pass/fail marks (or pending dot before they run)
    const gateCells = model.gates.map((g) => {
        if (g.ok === null)
            return faint(`${G.dot} ${g.name}`);
        const m = g.ok ? green(G.check) : orange(G.cross);
        return `${m} ${dim(g.name)}`;
    });
    push(`${dim('gates')}   ${gateCells.join('   ')}`);
    // verdict (only once a verdict exists)
    if (model.verdict) {
        const vColor = model.verdict === 'clean' ? green : orange;
        const grade = model.grade ? dim(` ${G.dot} grade ${model.grade}`) : '';
        const fc = typeof model.findings === 'number'
            ? dim(` ${G.dot} ${model.findings} finding${model.findings === 1 ? '' : 's'}`)
            : '';
        push(`${orange(G.mark)} ${dim('verdict')}  ${vColor(model.verdict)}${grade}${fc}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=panel-renderer.js.map