"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taste_validator_1 = require("../taste-validator");
const HTML_WITH_OBSERVER = `<!doctype html>
<html><head><style>
.lp-reveal { opacity: 0; transform: translateY(8px); transition: opacity 400ms ease, transform 400ms ease; }
.lp-reveal.is-visible { opacity: 1; transform: translateY(0); }
</style></head>
<body>
  <section class="lp-reveal">Hero</section>
  <script>
    var els = document.querySelectorAll('.lp-reveal');
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('is-visible'); });
    });
    els.forEach(function(el) { io.observe(el); });
  </script>
</body></html>`;
const HTML_WITHOUT_OBSERVER = `<!doctype html>
<html><head><style>
@keyframes lp-reveal-anim { from { opacity: 0; } to { opacity: 1; } }
.lp-reveal { opacity: 0; animation: lp-reveal-anim 400ms ease forwards; }
</style></head>
<body><section class="lp-reveal">Hero</section></body></html>`;
const dirty = (0, taste_validator_1.validateTaste)(HTML_WITH_OBSERVER);
const clean = (0, taste_validator_1.validateTaste)(HTML_WITHOUT_OBSERVER);
const dirtyHit = dirty.find(v => v.ruleId === 'taste/observer-race');
const cleanHit = clean.find(v => v.ruleId === 'taste/observer-race');
if (!dirtyHit) {
    console.error('FAIL: observer-race not flagged on observer-driven HTML');
    process.exit(1);
}
if (cleanHit) {
    console.error('FAIL: observer-race wrongly flagged on CSS-animation HTML');
    process.exit(1);
}
console.log('taste-validator observer-race test PASS');
//# sourceMappingURL=taste-validator-observer-race.test.js.map