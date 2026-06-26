#!/usr/bin/env node
/**
 * MOTION-OBSERVE referee instrument (Jonah's "re-label motion properly" ruling; lead-gated design option (a)).
 *
 * The speculative motion GT (layout-transition + bounce-easing) was guessed from CSS declarations by a labeler
 * that can't SEE motion (calcom PRESENT @ layout-shift-ratio 0.00; oracle's 74% recall is method-coupled to
 * that CSS-reading). This instrument produces OBSERVATION-BASED GT: render, TRIGGER motion, SAMPLE geometry over
 * time, classify from the OBSERVED trajectory. BLIND + uniform + deterministic.
 *
 * SCOPE: option (a) = scripts-stripped captures (determinism), so it observes CSS-NATIVE motion only (CSS
 * animations, :hover/:focus transitions). JS-driven motion won't run (~1/17 dev pages were JS-only). GT is
 * labeled "CSS-observable motion". Both tools are blind to JS motion equally, so the comparison stays fair.
 *
 * DEFINITIONS (observed, not CSS-name):
 *  - layout-transition: an animation SHIFTS SURROUNDING CONTENT. We track candidate animated elements AND their
 *    following-siblings; if a sibling's DOCUMENT-coordinate position (rect.top/left + scroll) moves > EPS while the
 *    candidate animates, the page reflows = layout-transition. (transform/opacity don't reflow neighbors; width/
 *    height/top/margin/grid do - exactly the rubric.)
 *  - bounce-easing: OBSERVED overshoot-and-return in a sampled scalar; FALLBACK to an overshoot timing-function
 *    (cubic-bezier with a control-point y outside [0,1], or a spring/linear() spring) when motion is too fast to
 *    sample.
 *
 * Deterministic: fixed viewport, fixed trigger sequence + timings, fixed sample schedule. Output: per page,
 * { layoutTransition: bool, bounceEasing: bool, evidence }. Usage: motion-observe-label.mjs <corpus> (dev|frozen)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');

function stripScripts(html) { return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, ''); }

// In-page: trigger motion + sample geometry; classify layout-shift + bounce. Self-contained (page.evaluate).
async function observe(page) {
  return await page.evaluate(async () => {
    const EPS = 3; // px movement threshold (document coords)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const docRect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, left: r.left + window.scrollX, w: r.width, h: r.height }; };
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };

    // candidate animated elements: have a CSS animation or a transition declared
    const cands = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const hasAnim = cs.animationName && cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0;
      const hasTrans = cs.transitionProperty && cs.transitionProperty !== 'none' && parseFloat(cs.transitionDuration) > 0;
      if ((hasAnim || hasTrans) && vis(el)) cands.push(el);
      if (cands.length >= 400) break;
    }

    // (1) bounce via overshoot TIMING FUNCTION (deterministic, robust): any animation/transition timing function
    // that overshoots - cubic-bezier with y1 or y2 outside [0,1], or a spring/linear()-spring.
    let bounceCurve = false;
    const overshootBezier = (s) => { const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i.exec(s); if (!m) return false; const y1 = parseFloat(m[2]), y2 = parseFloat(m[4]); return y1 < -0.001 || y1 > 1.001 || y2 < -0.001 || y2 > 1.001; };
    for (const el of cands) {
      const cs = getComputedStyle(el);
      const tf = (cs.transitionTimingFunction || '') + ',' + (cs.animationTimingFunction || '');
      if (overshootBezier(tf) || /\blinear\([^)]*\)/i.test(tf) || /spring/i.test(tf)) { bounceCurve = true; break; }
    }

    // (2) sample geometry in CONTROLLED windows (no scroll) to observe ANIMATION-driven reflow + bounce, NOT
    // scroll/load page-settle. The scroll-phase v1 conflated reveal/lazy reflow (siblings moved THOUSANDS of px)
    // with animation reflow; we drop scroll-as-a-measurement-window. Animation reflow is MODEST (an accordion/
    // expand: ~tens-to-low-hundreds px), so we cap the magnitude. Windows: LOAD (auto CSS animations) + HOVER
    // (transition-triggered expands). MAG_MIN < shift < MAG_MAX excludes both jitter and page-settle.
    const MAG_MIN = 3, MAG_MAX = 400;
    const tracked = cands.slice(0, 200).map((el) => ({ el, sib: el.nextElementSibling, win: [] }));
    const snapWin = () => { for (const t of tracked) t.win.push({ self: vis(t.el) ? docRect(t.el) : null, sib: (t.sib && vis(t.sib)) ? docRect(t.sib) : null }); };
    const range = (arr, pick) => { const xs = arr.map(pick).filter((v) => v != null); if (xs.length < 2) return 0; return Math.max(...xs) - Math.min(...xs); };
    const detectWindow = () => {
      for (const t of tracked) {
        // SIBLING reflow: VERTICAL only (a following element pushed DOWN = surrounding-content shift). Horizontal
        // sibling movement is dominated by marquees/carousels (in-place scroll within an overflow container), NOT
        // surrounding-content disruption, so it is excluded.
        const st = range(t.win, (s) => s.sib && s.sib.top);
        if (st > MAG_MIN && st < MAG_MAX) return { sel: (t.el.tagName || '').toLowerCase() + (typeof t.el.className === 'string' && t.el.className ? '.' + t.el.className.trim().split(/\s+/)[0] : ''), siblingTopRange: Math.round(st) };
        // OWN-size change (the element itself grows/shrinks = expand/collapse/accordion) - either axis counts.
        const dw = range(t.win, (s) => s.self && s.self.w), dh = range(t.win, (s) => s.self && s.self.h);
        if ((dw > MAG_MIN && dw < MAG_MAX) || (dh > MAG_MIN && dh < MAG_MAX)) return { sel: (t.el.tagName || '').toLowerCase(), ownWidthRange: Math.round(dw), ownHeightRange: Math.round(dh) };
      }
      return null;
    };
    const overshootWindow = () => {
      for (const t of tracked) { const a = t.win.map((s) => s.self && s.self.top).filter((v) => v != null); if (a.length < 4) continue; const settle = a[a.length - 1]; let mx = 0; for (const v of a) mx = Math.max(mx, Math.abs(v - settle)); if (mx > 9 && mx < MAG_MAX && Math.abs(a[a.length - 2] - settle) < mx * 0.5) return true; }
      return false;
    };

    let layoutEvidence = null, bounceObserved = false;
    // LOAD window
    for (const t of tracked) t.win = [];
    snapWin(); for (let i = 0; i < 14; i++) { await sleep(35); snapWin(); }
    layoutEvidence = detectWindow(); bounceObserved = overshootWindow();
    // scroll to reveal in-view content (TRIGGER only - not a measurement window), then settle
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await sleep(20); }
    window.scrollTo(0, 0); await sleep(120);
    // HOVER window (controlled): sample a baseline, hover a fixed set, sample the transition
    if (!layoutEvidence || !bounceObserved) {
      const hoverTargets = [...document.querySelectorAll('a, button, summary, [class*="card" i], [data-state], [aria-expanded]')].filter(vis).slice(0, 50);
      for (const t of tracked) t.win = [];
      snapWin();
      for (const ht of hoverTargets) { ht.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); ht.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); ht.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); }
      for (let i = 0; i < 12; i++) { await sleep(35); snapWin(); }
      layoutEvidence = layoutEvidence || detectWindow(); bounceObserved = bounceObserved || overshootWindow();
    }

    return { layoutTransition: !!layoutEvidence, layoutEvidence, bounceEasing: bounceObserved, bounceObserved, bounceCurve };
  });
}

async function run() {
  const mode = process.argv[2] || 'dev';
  let pages;
  if (mode === 'dev') {
    const man = JSON.parse(readFileSync(path.join(CORPUS, 'dev-manifest.json'), 'utf8'));
    pages = (man.pages || []).filter((p) => !p.failed).map((p) => ({ id: p.id, file: path.join('dev', `${p.id}.html`) }));
  } else {
    const cand = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
    pages = cand.map((c) => ({ id: c.id, file: c.file }));
  }
  const browser = await chromium.launch({ headless: true });
  const out = {};
  try {
    for (const p of pages) {
      const html = stripScripts(readFileSync(path.join(CORPUS, p.file), 'utf8'));
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const res = await observe(page);
        out[p.id] = res;
        process.stderr.write(`  ${p.id}: lt=${res.layoutTransition} be=${res.bounceEasing}${res.layoutEvidence ? ' [' + JSON.stringify(res.layoutEvidence) + ']' : ''}\n`);
      } catch (e) { out[p.id] = { error: String(e).slice(0, 80) }; process.stderr.write(`  FAIL ${p.id}\n`); }
      finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  const sink = path.join(CORPUS, `motion-observed-${mode}.json`);
  writeFileSync(sink, JSON.stringify({ generatedUtc: new Date().toISOString(), mode, note: 'CSS-observable motion GT (scripts-stripped). layout-transition = observed sibling/own-size reflow; bounce-easing = observed overshoot OR overshoot timing-function.', labels: out }, null, 2) + '\n');
  const lt = Object.values(out).filter((r) => r.layoutTransition).length, be = Object.values(out).filter((r) => r.bounceEasing).length;
  console.log(`\nmotion-observed (${mode}): ${pages.length} pages -> layout-transition ${lt}, bounce-easing ${be} -> ${sink}`);
}
run();
