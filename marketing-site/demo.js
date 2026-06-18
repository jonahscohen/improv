// Claude Code session demo (scd-): a simulated, animated Claude Code session
// routed through Sidecoach. Self-contained widget - drops into any page that
// includes demo.css and an #scd-term markup block. No-ops if the markup is
// absent. Shared by sidecoach-demo.html and the sidecoach.html "one move" split.
(function () {
  var body = document.getElementById('scd-body');
  var term = document.getElementById('scd-term');
  var replayBtn = document.getElementById('scd-replay');
  if (!body) return;

  // ?ff=1 forces the instant (reduced-motion) path - renders the final
  // transcript in one pass, also used to verify without the tab-throttle wait.
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]ff=1/.test(location.search);
  if (reduce) document.documentElement.setAttribute('data-still', ''); // no caret blink in instant/reduced mode
  var token = 0;
  // In instant mode resolve via a MICROTASK (not setTimeout): the whole
  // transcript then builds inside one macrotask, so a throttled/occluded tab
  // can't freeze mid-render between timers.
  var sleep = function (ms) { return reduce ? Promise.resolve() : new Promise(function (res) { setTimeout(res, ms); }); };
  var alive = function (my) { return my === token; };
  // Smooth, eased auto-scroll that keeps chasing the bottom as content streams in.
  var scrollRAF = 0;
  function toBottom() {
    if (reduce) { body.scrollTop = body.scrollHeight; return; }
    cancelAnimationFrame(scrollRAF);
    var step = function () {
      var target = body.scrollHeight - body.clientHeight;
      var diff = target - body.scrollTop;
      if (diff < 1) { body.scrollTop = target; return; }
      body.scrollTop += diff * 0.16;            // ease-out toward the bottom
      scrollRAF = requestAnimationFrame(step);
    };
    scrollRAF = requestAnimationFrame(step);
  }

  // persistent footer: the working spinner above the divider + input bar
  var cmd = document.getElementById('scd-cmd');
  var spinEl = document.getElementById('scd-spin');
  var SPARKS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  var spinTimer = null, spinSecs = 0, spinTok = 0, spinVerb = '', sparkIdx = 0;
  function fmtTok(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function fmtTime(s) { s = Math.max(1, Math.round(s)); return s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's'; }
  function paintSpin() {
    if (!spinEl) return;
    spinEl.innerHTML = '<span class="spark">' + SPARKS[sparkIdx] + '</span> <span class="verb">' + spinVerb +
      '</span>… <span class="hint">(' + fmtTime(spinSecs) + ' · ' + fmtTok(spinTok) + ' tokens)</span>';
  }
  function startSpin(v) {
    spinVerb = v; sparkIdx = 0; spinSecs = 0; spinTok = 0; paintSpin();
    if (reduce) return;
    spinTimer = setInterval(function () {
      sparkIdx = (sparkIdx + 1) % SPARKS.length; spinSecs += 0.8; spinTok += 70 + Math.floor(Math.random() * 120);
      paintSpin();
    }, 120);
  }
  function setVerb(v) { spinVerb = v; if (spinEl && spinEl.innerHTML) paintSpin(); }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } if (spinEl) spinEl.innerHTML = ''; }

  function add(html, cls, parent) {
    var el = document.createElement('div');
    el.className = 'scd-line' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    (parent || body).appendChild(el);
    if (reduce) { el.classList.add('is-in'); el.style.opacity = '1'; el.style.transform = 'none'; }
    else { void el.offsetWidth; el.classList.add('is-in'); }
    toBottom();
    return el;
  }
  function gap(parent) { return add('', 'scd-gap', parent); }

  async function type(el, text, my, cps) {
    if (reduce) { el.insertAdjacentText('beforeend', text); return; }
    var delay = 1000 / (cps || 24);
    for (var i = 0; i < text.length; i++) {
      if (!alive(my)) return;
      el.insertAdjacentText('beforeend', text[i]);
      toBottom();
      await sleep(delay + (text[i] === ' ' ? 24 : 0));
    }
  }
  // Claude streams in CHUNKS (a few words / a clause at a time), not word-by-word.
  async function stream(el, text, my) {
    if (reduce) { el.innerHTML = text; return; }
    var words = text.split(' '), i = 0;
    while (i < words.length) {
      if (!alive(my)) return;
      i += 3 + Math.floor(Math.random() * 4);   // 3-6 words per burst
      el.innerHTML = words.slice(0, i).join(' ');
      toBottom();
      await sleep(95 + Math.floor(Math.random() * 120));
    }
    el.innerHTML = text;
  }
  async function say(text, my) {
    var el = add('<span class="scd-dot-asst">●</span> <span class="scd-asst"></span>');
    await stream(el.querySelector('.scd-asst'), text, my);
    return el;
  }
  function tool(name, args) {
    add('<span class="scd-dot-tool">●</span> <span class="scd-tname">' + name + '</span><span class="scd-args">(' + args + ')</span>');
  }
  function branch(html) { add('<span class="scd-res">  <span class="scd-branch">└</span> ' + html + '</span>'); }

  // ── the Sidecoach panel ──
  function barHTML(done, total) {
    var cells = 18, on = Math.round((done / total) * cells);
    return '<span class="on">' + '▰'.repeat(on) + '</span><span class="off">' + '▱'.repeat(cells - on) + '</span>' +
      ' <span class="n">' + done + '/' + total + '</span>';
  }

  var REQUEST = 'audit this page for accessibility, performance, and theming';
  async function run() {
    // reveal the terminal (zoom-fade) the moment it runs; scoped CSS only
    // animates the one-move terminal on sidecoach.html, no-op elsewhere.
    if (term) term.classList.add('is-revealed');
    token++; var my = token; body.innerHTML = ''; stopSpin(); cmd.textContent = '';

    // 1. type into the persistent input bar, then "submit" it up into the transcript
    await sleep(340);
    await type(cmd, REQUEST, my, 28);
    if (!alive(my)) return;
    await sleep(420);
    add('<span class="scd-input">' + REQUEST + '</span>');
    cmd.textContent = '';
    gap();

    // 2. Claude routes into sidecoach; the working spinner appears above the bar
    startSpin('Routing');
    await say('Routing that through sidecoach.', my);
    if (!alive(my)) return; gap();

    // 3. build the Sidecoach panel
    var panel = add('', 'scd-sc');
    add('<span class="scd-sc__head"><span class="mark">◆</span> sidecoach <span class="verb">· multi-lens audit</span></span>', null, panel);
    gap(panel);
    await sleep(360);

    // classify -> route resolves
    var routeRow = add('<span class="scd-sc__row"><span class="k">route</span><span class="v"><span class="d">classifying intent</span></span></span>', null, panel);
    await sleep(620);
    if (!alive(my)) return;
    routeRow.querySelector('.v').innerHTML = 'Multi-Lens Audit <span class="d">· flowK · conf 0.85</span>';
    add('<span class="scd-sc__row"><span class="k">flow</span><span class="v"><span class="d">brand verify</span> <span class="sep">›</span> <span class="d">multi-lens audit</span> <span class="sep">›</span> <span class="d">design critique</span></span></span>', null, panel);
    gap(panel);
    await sleep(300);

    // checklist + phases, animated
    var checkRow = add('<span class="scd-sc__row scd-sc__bar"><span class="k">checklist</span><span class="v">' + barHTML(0, 5) + '</span></span>', null, panel);
    var checkV = checkRow.querySelector('.v');
    var done = 0;
    function bump(n) { done = Math.min(5, done + n); checkV.innerHTML = barHTML(done, 5); }
    gap(panel);
    setVerb('Auditing');

    var phases = [
      { name: 'brand verify', dims: null, bump: 1 },
      { name: 'multi-lens audit', dims: 'accessibility <span class="sep">·</span> performance <span class="sep">·</span> theming <span class="sep">·</span> responsive <span class="sep">·</span> anti-patterns', bump: 3 },
      { name: 'design critique', dims: null, bump: 1 }
    ];
    for (var i = 0; i < phases.length; i++) {
      if (!alive(my)) return;
      var p = phases[i];
      var row = add('<span class="scd-sc__phase"><span class="ph">◇</span> <span class="nm">' + p.name + '</span> <span class="scd-sc__st run">[running]</span></span>', null, panel);
      if (p.dims) add('<span class="scd-sc__dims">' + p.dims + '</span>', null, panel);
      await sleep(p.dims ? 1100 : 700);
      if (!alive(my)) return;
      row.querySelector('.scd-sc__st').className = 'scd-sc__st done';
      row.querySelector('.scd-sc__st').textContent = '[done]';
      bump(p.bump);
      await sleep(260);
    }
    gap(panel);

    // gates resolve - polish gate catches a contrast miss
    var gateRow = add('<span class="scd-sc__row scd-sc__gate"><span class="k">gates</span><span class="v"></span></span>', null, panel);
    var gateV = gateRow.querySelector('.v');
    var gates = [
      { nm: 'taste', ok: true },
      { nm: 'claudemd-mandate', ok: true },
      { nm: 'polish-standard', ok: false }
    ];
    for (var g = 0; g < gates.length; g++) {
      if (!alive(my)) return;
      await sleep(420);
      var gg = gates[g];
      gateV.insertAdjacentHTML('beforeend',
        (g ? '   ' : '') + '<span class="' + (gg.ok ? 'ok' : 'no') + '" data-g="' + gg.nm + '">' +
        (gg.ok ? '✓' : '✗') + ' <span class="nm">' + gg.nm + '</span></span>');
      toBottom();
    }
    await sleep(300);
    var verdict = add('<span class="scd-sc__verdict"><span class="mark">◆</span> verdict  <span class="find">1 finding</span> <span class="d">· grade B · contrast below AA</span></span>', null, panel);
    gap(panel);

    // 4. Claude acts on the gate's finding
    setVerb('Synthesizing');
    await sleep(500);
    if (!alive(my)) return;
    await say('The polish gate caught one thing: faint caption text misses AA contrast. Applying the token fix.', my);
    if (!alive(my)) return;
    tool('Update', 'styles.css');
    branch('Updated styles.css with 1 addition and 1 removal');
    branch('<span class="scd-ok">--text-tertiary</span> #8B8A82 ' + '→' + ' #6E6D66  (AA on cream)');
    await sleep(500);

    // 5. gate re-runs, verdict clears
    if (!alive(my)) return;
    var failGate = gateV.querySelector('[data-g="polish-standard"]');
    if (failGate) { failGate.className = 'ok'; failGate.innerHTML = '✓ <span class="nm">polish-standard</span>'; }
    verdict.innerHTML = '<span class="scd-sc__verdict"><span class="mark">◆</span> verdict  <span class="clean">clean</span> <span class="d">· grade A · 0 findings</span></span>';
    await sleep(400);

    // 6. summary
    await say('Audit clean across all five dimensions. Sidecoach picked the flow, ran the phases, and its polish gate is what flagged the contrast - the fix is in.', my);
    if (!alive(my)) return; gap();

    // work done: spinner clears, the persistent input bar returns to idle
    stopSpin();
    toBottom();
  }

  var started = false;
  if (reduce) {
    run(); // instant mode: render now, within the load macrotask (no IO wait, no freeze)
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(term);
  } else { run(); }
  replayBtn.addEventListener('click', function () { body.scrollTop = 0; run(); });
})();
