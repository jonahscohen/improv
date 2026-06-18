// Everyday-workflow stepper (wf-): a clickable vertical stepper wired to a
// terminal. Each step types/streams its segment into the terminal and marks
// itself active (prior steps done). Auto-advances on scroll-in; clicking a
// step jumps to it. Reuses the .scd-* terminal CSS, own engine, scoped to
// #scd-wf so it can't touch the audit/install terminals. No-ops if absent.
(function () {
  var term = document.getElementById('scd-wf');
  var stepperEl = document.getElementById('wf-stepper');
  if (!term || !stepperEl) return;
  var body = document.getElementById('scd-wf-body');
  var cmd = document.getElementById('scd-wf-cmd');
  if (!body) return;
  var steps = Array.prototype.slice.call(stepperEl.querySelectorAll('.stepper__step'));

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]ff=1/.test(location.search);
  if (reduce) document.documentElement.setAttribute('data-still', '');
  var token = 0;
  var sleep = function (ms) { return reduce ? Promise.resolve() : new Promise(function (res) { setTimeout(res, ms); }); };
  var alive = function (my) { return my === token; };

  function toBottom() { body.scrollTop = body.scrollHeight; }

  function add(html, cls) {
    var el = document.createElement('div');
    el.className = 'scd-line' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    body.appendChild(el);
    if (reduce) { el.classList.add('is-in'); el.style.opacity = '1'; el.style.transform = 'none'; }
    else { void el.offsetWidth; el.classList.add('is-in'); }
    toBottom();
    return el;
  }
  function gap() { return add('', 'scd-gap'); }

  async function type(el, text, my, cps) {
    if (reduce) { el.insertAdjacentText('beforeend', text); return; }
    var delay = 1000 / (cps || 30);
    for (var i = 0; i < text.length; i++) {
      if (!alive(my)) return;
      el.insertAdjacentText('beforeend', text[i]);
      toBottom();
      await sleep(delay + (text[i] === ' ' ? 18 : 0));
    }
  }
  async function stream(el, text, my) {
    if (reduce) { el.innerHTML = text; return; }
    var words = text.split(' '), i = 0;
    while (i < words.length) {
      if (!alive(my)) return;
      i += 3 + Math.floor(Math.random() * 4);
      el.innerHTML = words.slice(0, i).join(' ');
      toBottom();
      await sleep(90 + Math.floor(Math.random() * 90));
    }
    el.innerHTML = text;
  }
  async function say(text, my) {
    var el = add('<span class="scd-dot-asst">&#9679;</span> <span class="scd-asst"></span>');
    await stream(el.querySelector('.scd-asst'), text, my);
  }
  function tool(name, args) { add('<span class="scd-dot-tool">&#9679;</span> <span class="scd-tname">' + name + '</span><span class="scd-args">(' + args + ')</span>'); }
  function branch(html) { add('<span class="scd-res">  <span class="scd-branch">&#9492;</span> ' + html + '</span>'); }
  function ok(label) { branch('<span class="scd-ok">&#10003;</span> ' + label); }

  async function submitCmd(text, my) {
    if (cmd) { await type(cmd, text, my, 30); if (!alive(my)) return false; await sleep(320); cmd.textContent = ''; }
    add('<span class="scd-input">' + text + '</span>');
    return true;
  }

  // ── the four step segments ──
  var SEGMENTS = [
    async function (my) { // Build
      if (!(await submitCmd('build a pricing table for the three plans', my))) return;
      gap();
      await say('Building the component from scratch.', my); if (!alive(my)) return;
      tool('Write', 'PricingTable.tsx');
      branch('tokens &middot; 3-up grid &middot; 8 interaction states');
      branch('motion in, with a reduced-motion fallback');
      await sleep(400); if (!alive(my)) return;
      await say('Built it - tokens, layout, and every state are in. What next?', my);
    },
    async function (my) { // Technical check
      if (!(await submitCmd('now review it and tighten it up', my))) return;
      gap();
      await say('Routing the review through sidecoach. Stage 1 of 3 &middot; technical.', my); if (!alive(my)) return;
      ok('accessibility &middot; contrast AA, focus order, labels');
      ok('theming &middot; light and dark');
      ok('responsive &middot; every breakpoint');
      ok('anti-patterns &middot; none found');
    },
    async function (my) { // Critique
      await say('Stage 2 of 3 &middot; an independent critique.', my); if (!alive(my)) return;
      branch('cognitive load &middot; hierarchy &middot; emotional read');
      await sleep(360); if (!alive(my)) return;
      branch('<span class="scd-hl">1 finding</span> &middot; the plan cards read a little flat');
    },
    async function (my) { // Polish
      await say('Stage 3 of 3 &middot; the final polish.', my); if (!alive(my)) return;
      ok('optical alignment, press states, tabular numbers');
      ok('balanced headings, real hit-target sizes');
      await sleep(400); if (!alive(my)) return;
      await say('Review clean. Fixes applied, the table is shipped.', my);
    }
  ];

  function markStepper(active) {
    steps.forEach(function (s, i) {
      s.classList.toggle('is-active', i === active);
      s.classList.toggle('is-done', i < active);
    });
  }

  var played = -1;     // furthest step appended into the transcript
  var running = false; // a segment is currently streaming
  var marks = [];      // first element of each step, for scroll-back

  function scrollToStep(i) {
    var m = marks[i];
    if (!m) return;
    body.scrollTop += m.getBoundingClientRect().top - body.getBoundingClientRect().top - 10;
  }

  function elementsFrom(node) {
    var out = [], el = node;
    while (el) { out.push(el); el = el.nextSibling; }
    return out;
  }
  // gently fade-collapse the given line elements out, then remove them
  async function collapseEls(els, my) {
    if (!els.length) return;
    if (reduce) { els.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); }); return; }
    els.forEach(function (e) { if (e.classList) e.classList.add('scd-collapsing'); });
    await sleep(440);
    if (!alive(my)) return;
    els.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
  }

  // Advance forward (append, cumulative - never clears) or rewind (gently reset
  // the log back to `target`, dropping later steps). No auto-advance: progression
  // happens only on a click or the first reveal.
  async function goTo(target) {
    if (running || target < 0 || target >= SEGMENTS.length || target === played) return;
    running = true;
    token++; var my = token;
    var rewind = target < played;
    if (rewind) {
      await collapseEls(marks[target + 1] ? elementsFrom(marks[target + 1]) : [], my);
      for (var k = target + 1; k < marks.length; k++) marks[k] = null;
      played = target;
    } else {
      for (var i = played + 1; i <= target && alive(my); i++) {
        markStepper(i);
        var idx = body.children.length;
        if (i > 0) gap();
        await SEGMENTS[i](my);
        marks[i] = body.children[idx] || body.lastChild;
        played = i;
      }
    }
    running = false;
    if (!alive(my)) return;
    markStepper(target);
    if (rewind) scrollToStep(target);
  }

  // Restart: collapse the whole transcript away, then replay from step 1.
  async function restart() {
    if (running) return;
    running = true;
    token++; var my = token;
    await collapseEls(elementsFrom(body.firstChild), my);
    if (!alive(my)) { running = false; return; }
    body.innerHTML = ''; marks = []; played = -1;
    running = false;
    goTo(0);
  }

  steps.forEach(function (s, i) {
    var btn = s.querySelector('.stepper__btn') || s;
    btn.addEventListener('click', function () { goTo(i); });
  });
  var restartBtn = document.getElementById('scd-wf-replay');
  if (restartBtn) restartBtn.addEventListener('click', restart);

  var started = false;
  function start() { if (started) return; started = true; goTo(0); }
  if (reduce) {
    started = true;
    goTo(SEGMENTS.length - 1); // instant: render the whole transcript, all done
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
    }, { threshold: 0.35 });
    io.observe(term);
  } else { start(); }
})();
