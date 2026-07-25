"use strict";
/**
 * Sidecoach direction presentation (Stage 2d) - the exclusion-safe deck.
 *
 * Presents a set of rolled directions (drawn by the Stage 2c roll) for a DECISION, without any interactive
 * in-browser surface. Two renderings, chosen by the caller's surface:
 *   - RICH surface  -> a self-contained visualizer ARTIFACT: static HTML, one card per direction. The viewer
 *                      reads it and decides; nothing on the page does anything.
 *   - TEXT surface  -> a clean Markdown deck: a table plus a short per-direction detail block.
 * The user picks by RESPONDING (a number or an id). A re-roll is a re-invocation of Stage 2c - this module
 * never re-rolls, never edits, never previews a variant.
 *
 * HARD EXCLUSION (the load-bearing property): there is NO in-browser variant surface anywhere in this track.
 * The rich rendering is STATIC HTML only - no network server, no client runtime, no embedded preview frame,
 * no variant-preview code path. It reuses the Stage 2c deck by IMPORTING it; it owns no roll logic. These
 * exclusions are verified two ways: a self-source scan in the test asserts none of the forbidden runtime
 * patterns appear in this module or its bin, and the diff is grepped at review time.
 *
 * DETERMINISM: both renderers are pure string builders over the resolved directions - the same directions in
 * the same order yield byte-identical output. No clock, no RNG, no ambient state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDirections = resolveDirections;
exports.renderDeckMarkdown = renderDeckMarkdown;
exports.renderDeckArtifactHtml = renderDeckArtifactHtml;
const direction_deck_1 = require("./direction-deck");
/**
 * Resolve an ordered id list into deck directions, reporting any unknown or duplicate ids. The presentation
 * is a DECISION surface, so a typo'd id (silently dropped) or a duplicated option would corrupt the choice -
 * the bin fails loud on either rather than presenting a wrong deck.
 */
function resolveDirections(ids) {
    const unknown = [];
    const duplicates = [];
    const seen = new Set();
    const directions = [];
    for (const id of ids) {
        if (seen.has(id)) {
            duplicates.push(id);
            continue;
        }
        seen.add(id);
        const d = (0, direction_deck_1.directionById)(id);
        if (!d) {
            unknown.push(id);
            continue;
        }
        directions.push(d);
    }
    return { directions, unknown, duplicates };
}
const DEFAULT_TITLE = 'Direction options';
const PICK_LINE = 'Pick one to start the build. Reply with the option number or the id. Re-roll with `sidecoach-roll` (Stage 2c).';
// ---------------------------------------------------------------------------
// Text surface: a clean Markdown deck (table + per-direction detail)
// ---------------------------------------------------------------------------
/**
 * Inline-Markdown safety for any interpolated value: collapse whitespace onto one line (so a value can never
 * break out of a table row or a heading onto its own line), and escape the pipe and backtick that are
 * structural in tables and code spans. The deck fields (name/axis/premise/moves/avoid) come from our own
 * curated Stage 2c deck and are trusted-by-construction, but `--title` crosses the CLI boundary; running every
 * interpolated field through one helper keeps the boundary honest without depending on which field is trusted.
 */
function mdInline(s) {
    return String(s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|').replace(/`/g, '\\`');
}
/**
 * Render the directions as a clean Markdown deck: a summary table (option, direction, axis, premise) followed
 * by one detail block per direction (moves + what it avoids), closed by the pick instruction. Pure Markdown -
 * no HTML, no ANSI, no chrome.
 */
function renderDeckMarkdown(directions, opts = {}) {
    const title = mdInline(opts.title || DEFAULT_TITLE);
    const L = [];
    L.push(`## ${title}`);
    L.push('');
    L.push(PICK_LINE);
    L.push('');
    L.push('| # | Direction | Axis | Premise |');
    L.push('| --- | --- | --- | --- |');
    directions.forEach((d, i) => {
        L.push(`| ${i + 1} | ${mdInline(d.name)} (\`${mdInline(d.id)}\`) | ${mdInline(d.axis)} | ${mdInline(d.premise)} |`);
    });
    L.push('');
    directions.forEach((d, i) => {
        L.push(`### ${i + 1}. ${mdInline(d.name)} (\`${mdInline(d.id)}\`)`);
        L.push('');
        L.push(`- Axis: ${mdInline(d.axis)}`);
        L.push(`- Moves: ${d.moves.map((m) => mdInline(m)).join('; ')}`);
        L.push(`- Avoids: ${mdInline(d.avoid)}`);
        L.push('');
    });
    return L.join('\n').replace(/\n+$/, '\n');
}
// ---------------------------------------------------------------------------
// Rich surface: a self-contained, static visualizer artifact (no runtime, no network, no preview frame)
// ---------------------------------------------------------------------------
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function directionCard(d, index) {
    const moves = d.moves.map((m) => `<li>${escHtml(m)}</li>`).join('');
    return `<article class="card">
  <header class="card-head">
    <span class="num">${index + 1}</span>
    <div>
      <h2 class="name">${escHtml(d.name)}</h2>
      <p class="id"><code>${escHtml(d.id)}</code> &middot; <span class="axis">${escHtml(d.axis)}</span></p>
    </div>
  </header>
  <p class="premise">${escHtml(d.premise)}</p>
  <ul class="moves">${moves}</ul>
  <p class="avoid"><strong>Avoids:</strong> ${escHtml(d.avoid)}</p>
</article>`;
}
/**
 * Render the directions as a self-contained static HTML artifact for a rich surface. Theme-aware
 * (prefers-color-scheme), responsive (a fluid grid, wide content scrolls inside its own container), and
 * entirely inert: it carries no runtime code, opens no network channel, and embeds no preview frame. The
 * viewer reads the cards and picks by responding in chat.
 */
function renderDeckArtifactHtml(directions, opts = {}) {
    const title = opts.title || DEFAULT_TITLE;
    const cards = directions.map((d, i) => directionCard(d, i)).join('\n');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
<style>
  :root {
    --bg: #ffffff; --fg: #14181f; --muted: #55606e; --line: #e2e6ec;
    --card: #ffffff; --accent: #1f4f8f; --chip: #eef2f7;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14181f; --fg: #eef1f5; --muted: #9aa5b4; --line: #2a313c; --card: #1b212b; --accent: #7aa2e3; --chip: #232b36; }
  }
  :root[data-theme="dark"] { --bg: #14181f; --fg: #eef1f5; --muted: #9aa5b4; --line: #2a313c; --card: #1b212b; --accent: #7aa2e3; --chip: #232b36; }
  :root[data-theme="light"] { --bg: #ffffff; --fg: #14181f; --muted: #55606e; --line: #e2e6ec; --card: #ffffff; --accent: #1f4f8f; --chip: #eef2f7; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: var(--bg); color: var(--fg);
         font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
  .wrap { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 6px; }
  .pick { color: var(--muted); font-size: 15px; line-height: 1.5; margin: 0 0 24px; max-width: 70ch; }
  .pick code { background: var(--chip); padding: 1px 6px; border-radius: 4px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .card { border: 1px solid var(--line); border-radius: 12px; padding: 20px; background: var(--card); }
  .card-head { display: flex; gap: 12px; align-items: baseline; margin: 0 0 10px; }
  .num { flex: none; width: 28px; height: 28px; border-radius: 999px; background: var(--chip); color: var(--fg);
         display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
  .name { font-size: 19px; line-height: 1.25; margin: 0; }
  .id { font-size: 13px; line-height: 1.4; color: var(--muted); margin: 2px 0 0; }
  .axis { text-transform: capitalize; }
  .premise { font-size: 15px; line-height: 1.55; margin: 0 0 12px; }
  .moves { margin: 0 0 12px; padding-left: 20px; }
  .moves li { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .avoid { font-size: 13px; line-height: 1.5; color: var(--muted); margin: 0; }
  .avoid strong { color: var(--fg); }
</style>
</head>
<body>
<div class="wrap">
<h1>${escHtml(title)}</h1>
<p class="pick">Pick one to start the build. Reply with the option number or the id shown on each card. A re-roll is a re-invocation of <code>sidecoach-roll</code> (Stage 2c).</p>
<div class="grid">
${cards}
</div>
</div>
</body>
</html>`;
}
//# sourceMappingURL=direction-deck-present.js.map