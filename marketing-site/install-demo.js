// Install-workflow terminal sim (scd-install-): a self-contained, animated
// replay of the "How to start" flow - install the skill, teach it the project,
// then describe the work. Reuses the .scd-* terminal CSS but runs its own small
// engine so it stays isolated from the audit demo (demo.js). No-ops if its
// markup (#scd-install) is absent.
(function () {
  var root = document.getElementById('scd-install');
  if (!root) return;
  var body = document.getElementById('scd-install-body');
  var cmd = document.getElementById('scd-install-cmd');
  var spinEl = document.getElementById('scd-install-spin');
  var replayBtn = document.getElementById('scd-install-replay');
  if (!body) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]ff=1/.test(location.search);
  if (reduce) document.documentElement.setAttribute('data-still', '');
  var token = 0;
  var sleep = function (ms) { return reduce ? Promise.resolve() : new Promise(function (res) { setTimeout(res, ms); }); };
  var alive = function (my) { return my === token; };

  var scrollRAF = 0;
  function toBottom() {
    if (reduce) { body.scrollTop = body.scrollHeight; return; }
    cancelAnimationFrame(scrollRAF);
    var step = function () {
      var target = body.scrollHeight - body.clientHeight;
      var diff = target - body.scrollTop;
      if (diff < 1) { body.scrollTop = target; return; }
      body.scrollTop += diff * 0.16;
      scrollRAF = requestAnimationFrame(step);
    };
    scrollRAF = requestAnimationFrame(step);
  }

  // working spinner above the input bar (braille dot cycle, like a CLI spinner)
  var SPARKS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
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
      sparkIdx = (sparkIdx + 1) % SPARKS.length; spinSecs += 0.8; spinTok += 60 + Math.floor(Math.random() * 110);
      paintSpin();
    }, 110);
  }
  function setVerb(v) { spinVerb = v; if (spinEl && spinEl.innerHTML) paintSpin(); }
  function stopSpin() { if (spinTimer) { clearInterval(spinTimer); spinTimer = null; } if (spinEl) spinEl.innerHTML = ''; }

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
    var delay = 1000 / (cps || 26);
    for (var i = 0; i < text.length; i++) {
      if (!alive(my)) return;
      el.insertAdjacentText('beforeend', text[i]);
      toBottom();
      await sleep(delay + (text[i] === ' ' ? 22 : 0));
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
      await sleep(95 + Math.floor(Math.random() * 110));
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

  // submit the current input bar text up into the transcript as a command line
  async function submit(text, my, cps) {
    await type(cmd, text, my, cps || 26);
    if (!alive(my)) return false;
    await sleep(380);
    add('<span class="scd-input">' + text + '</span>');
    cmd.textContent = '';
    return true;
  }

  async function run() {
    token++; var my = token; body.innerHTML = ''; stopSpin(); cmd.textContent = '';
    await sleep(340);

    // 1. install the skill from the shell
    if (!(await submit('ampersand --only sidecoach', my))) return;
    gap();
    startSpin('Installing');
    await sleep(900);
    if (!alive(my)) return;
    branch('resolving <span class="scd-ok">sidecoach</span> · design layer');
    await sleep(700);
    branch('<span class="scd-ok">&#10003;</span> installed · hooks registered, skill ready');
    stopSpin();
    gap();

    // 2. hand off to Claude
    await say('Installed. Open Claude in your project and teach it the basics.', my);
    if (!alive(my)) return; gap();

    // 3. teach it the project -> writes the two files
    if (!(await submit('teach Sidecoach about this project', my))) return;
    gap();
    startSpin('Reading');
    await say('Interviewing you for the gaps, then writing the two files.', my);
    if (!alive(my)) return;
    tool('Write', 'PRODUCT.md');
    branch('brand voice, who it is for, the patterns to avoid');
    tool('Write', 'DESIGN.md');
    branch('tokens scanned from your CSS · colors, type, spacing');
    stopSpin();
    gap();

    // 4. describe the work in plain language
    if (!(await submit('make the pricing page feel more confident', my))) return;
    gap();
    startSpin('Designing');
    await say('Routing through sidecoach: a polish and tone pass on the pricing page.', my);
    if (!alive(my)) return;
    branch('<span class="scd-ok">grade A</span> · bolder type scale, tighter rhythm, AA contrast');
    stopSpin();
    await say('Set up once. From here, you just describe the work.', my);
    if (!alive(my)) return; gap();
    toBottom();
  }

  var started = false;
  if (reduce) {
    run();
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(root);
  } else { run(); }
  replayBtn.addEventListener('click', function () { body.scrollTop = 0; run(); });
})();
