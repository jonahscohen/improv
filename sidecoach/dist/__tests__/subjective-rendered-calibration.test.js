"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/subjective-rendered-calibration.test.ts
//
// OWNED calibration for the rendered SUBJECTIVE (taste) scanner. Precision-first: every comfortable/negative
// fixture is asserted ALWAYS (the detector must never over-fire). Each idiom-present fixture asserts the class
// fires. Authored from a readability/spec basis, NOT tuned to the eval labeler.
//
// tiny-text spec: flag a page iff (>=1 RUNNING BODY block >=6 words below 12px) OR (>=3 VERY-SMALL <=10px text
// elements). A single 12px caption (conventional) must NOT trigger; sr-only tiny text must NOT count.
//
// marketing-buzzword spec (Stage 5a v2): a HOLISTIC weighted buzzword DENSITY over the page's content copy. Flag a
// page iff (weighted buzzword occurrences / content words * 100) >= 1.0, where weights are vacuity-tiered
// (PEAK 3 / STRONG 2 / MILD 1). Scope = visible, non-peripheral content text EXCLUDING testimonial/quote regions.
// So: a buzzword-SATURATED page fires; a long CONCRETE page with a stray buzzword or two stays low-density and does
// NOT fire; buzzwords confined to testimonials or peripheral chrome are excluded. (v1's tight prominent-cluster rule
// overfit a homogeneous corpus and collapsed on the held-out; v2 is calibrated on a register-diverse dev set.)
//
// default-typeface spec (Stage 4a): a page-level judgment that the CONTENT text is not set in a typeface anyone
// CHOSE. Flag a page iff >= 75% of its content text (char-weighted, visible, non-peripheral) leads with a family
// from the system/default vocabulary - or, where a committed family is KNOWN, that family carries < 25% of the
// content text. So: a bare system stack fires, an unstyled page fires, Tailwind's untouched ui-sans-serif fires,
// a declared-but-never-applied webfont fires; a branded page does not, a chosen face LEADING a system fallback
// chain does not, a single caption on Arial does not, and system-stack nav/footer chrome does not.
const playwright_1 = require("playwright");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const subjective_rendered_scanner_1 = require("../validators/subjective-rendered-scanner");
const IMPLEMENTED_RULES = ['tiny-text', 'nested-cards', 'marketing-buzzword', 'default-typeface'];
// The inline fixtures below exercise tiny-text / nested-cards / marketing-buzzword, so they declare a nominal
// CHOSEN family. Without it every one of them would also be a default-typeface positive (an unstyled page
// computes to the UA default) and the `expect: null` negatives would fail on an unrelated class. The family is
// never loaded, so the PAINTED text and every rendered metric are byte-identical to the unstyled case - only
// the DECLARED stack these fixtures were never about changes.
const doc = (body) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:'Fixture Sans',sans-serif">${body}</body></html>`;
const FIXTURE_DIR = node_path_1.default.resolve(__dirname, '..', '..', 'eval', 'fixtures', 'default-typeface');
const face = (file) => (0, node_fs_1.readFileSync)(node_path_1.default.join(FIXTURE_DIR, file), 'utf8');
// ~75-char sentence; repeat to clear the 200-char min-content guard with realistic running text.
const S = 'This is a running body sentence with clearly more than six words of text. ';
// CONCRETE filler (zero buzzwords): dilutes density so a stray buzzword stays below the 1.0 threshold. ~22 words.
const CONC = 'Deploy a Postgres database from the dashboard or the command line and receive a connection string the moment it is ready. ';
const para = (px, n = 4) => `<p style="font-size:${px}px">${S.repeat(n)}</p>`;
// card helpers: a real-panel-size rounded container. border / shadow / bg-distinct each qualify as a "card".
const cardBorder = (inner) => `<div style="width:400px;height:300px;border-radius:12px;border:1px solid #ddd"><p>Card body</p>${inner}</div>`;
const innerBorder = `<div style="width:200px;height:120px;border-radius:8px;border:1px solid #ccc"><p>Inner panel</p></div>`;
const innerShadow = `<div style="width:200px;height:120px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1)"><span>Inner</span></div>`;
const FIXTURES = [
    // PRESENT (a SUBSTANTIAL share of CONTENT text is small => strains readability)
    { name: 'tt/dense-13px-body', expect: 'tiny-text', note: 'whole content body at 13px => ~100% of content text small', html: doc(`<main>${para(13)}${para(13)}</main>`) },
    { name: 'tt/half-content-small', expect: 'tiny-text', note: 'half the content text at 12px, half at 16px => ~50% small >= 0.20', html: doc(`<main>${para(16)}${para(12)}</main>`) },
    { name: 'tt/dense-10px-lists', expect: 'tiny-text', note: 'dense content set at 10px', html: doc(`<main><ul><li style="font-size:10px">${S.repeat(2)}</li><li style="font-size:10px">${S.repeat(2)}</li><li style="font-size:10px">${S.repeat(2)}</li></ul></main>`) },
    // ABSENT (readable content - must NOT over-fire; the density/region feature protects precision)
    { name: 'tt/comfortable-16px-body', expect: null, note: 'standard 16px content body is comfortable', html: doc(`<main>${para(16)}${para(16)}</main>`) },
    { name: 'tt/readable-body-small-footer', expect: null, note: 'the canonical ABSENT pattern: 16px readable body + small 11px FOOTER (peripheral, excluded) => content proportion ~0', html: doc(`<main>${para(16)}${para(16)}</main><footer><a style="font-size:11px">Privacy</a> <a style="font-size:11px">Terms</a> <a style="font-size:11px">Cookies</a> <a style="font-size:11px">Contact</a></footer>`) },
    { name: 'tt/single-12px-caption', expect: null, note: 'one short 12px caption amid a 16px body => proportion below the floor', html: doc(`<main>${para(16, 6)}<figcaption style="font-size:12px">A short caption</figcaption></main>`) },
    { name: 'tt/sronly-tiny-not-counted', expect: null, note: 'sr-only 9px text is not visible to sighted users -> excluded, content stays 16px', html: doc(`<main>${para(16)}<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);font-size:9px">${S.repeat(4)}</span></main>`) },
    { name: 'tt/readable-14px-heavy-dashboard', expect: null, note: 'PRECISION (Codex High#1 + lead ruling): 14px is a COMMON READABLE body size (GitHub, dashboards, cards, tables). A page whose content is mostly readable 14px must NOT fire - "strains readability" means a readable page is ABSENT by definition. This negative pins SMALL_PX at 13 (14px not counted).', html: doc(`<main><section class="cards">${para(14, 5)}${para(14, 5)}</section><table><tr><td style="font-size:14px">${S.repeat(3)}</td><td style="font-size:14px">${S.repeat(3)}</td></tr></table></main>`) },
    // ---- nested-cards ----
    // PRESENT (a card-like container holding a meaningfully-smaller card-like container)
    { name: 'nc/border-card-in-border-card', expect: 'nested-cards', note: 'a bordered card contains a smaller bordered sub-panel', html: doc(cardBorder(innerBorder)) },
    { name: 'nc/shadow-inner-card', expect: 'nested-cards', note: 'a bordered card contains a smaller shadow card', html: doc(cardBorder(innerShadow)) },
    { name: 'nc/shadow-card-in-shadow-card', expect: 'nested-cards', note: 'a shadow card contains a smaller shadow sub-panel', html: doc(`<div style="width:440px;height:340px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.12)"><p>Outer</p><div style="width:240px;height:140px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1)"><span>Inner</span></div></div>`) },
    // ABSENT - precision (>=10 negatives, lead gate). Includes the bg-distinct INCIDENTAL-nesting over-fire the
    // milestone exposed (precision 0.27): a tinted rounded region inside another tinted rounded region is NOT a
    // card-in-card; with the tighten (border|shadow only) these must NOT fire.
    { name: 'nc/flat-card-grid', expect: null, note: 'three SIBLING cards in a grid - adjacent, not nested', html: doc(`<section style="display:flex;gap:16px">${cardBorder('')}${cardBorder('')}${cardBorder('')}</section>`) },
    { name: 'nc/single-card-plain-children', expect: null, note: 'one card whose children are plain blocks, not cards', html: doc(cardBorder('<div style="width:200px;height:120px"><p>plain block</p></div><ul><li>list</li></ul>')) },
    { name: 'nc/no-cards-at-all', expect: null, note: 'plain page, no card treatment anywhere', html: doc('<main><section><h2>Section</h2><p>Just text and a list.</p><ul><li>one</li><li>two</li></ul></section></main>') },
    { name: 'nc/bg-distinct-incidental-nesting', expect: null, note: 'THE OVER-FIRE PATTERN (milestone P0.27): a tinted rounded layout region inside another tinted rounded region, NO border/shadow -> not a visual card-in-card; the tighten drops bg-distinct so this is ABSENT', html: doc(`<div style="background:#f4f4f5"><div style="width:420px;height:320px;border-radius:12px;background:#ffffff"><p>tinted region</p><div style="width:220px;height:130px;border-radius:8px;background:#eef2ff"><span>tinted sub-region</span></div></div></div>`) },
    { name: 'nc/tinted-dashboard-regions', expect: null, note: 'dashboard-like nested tinted containers (bg-only, rounded, no border/shadow) - layout regions, not cards', html: doc(`<main style="background:#fafafa"><div style="width:600px;height:400px;border-radius:10px;background:#f1f5f9"><div style="width:300px;height:180px;border-radius:8px;background:#e2e8f0"><p>panel</p></div></div></main>`) },
    { name: 'nc/card-with-rounded-buttons', expect: null, note: 'a card whose children are rounded BUTTONS/inputs (small, not card-size sub-panels)', html: doc(cardBorder('<button style="width:120px;height:40px;border-radius:8px;border:1px solid #ccc">Action</button> <input style="width:200px;height:40px;border-radius:8px;border:1px solid #ccc">')) },
    { name: 'nc/card-with-image-children', expect: null, note: 'a card containing images (media), not nested cards', html: doc(cardBorder('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="width:300px;height:180px;border-radius:8px" alt="">')) },
    { name: 'nc/inner-not-smaller', expect: null, note: 'a card containing a card that is ~the same size (>85% area) - not a layered sub-panel', html: doc(`<div style="width:420px;height:320px;border-radius:12px;border:1px solid #ddd"><div style="width:410px;height:300px;border-radius:10px;border:1px solid #ccc"><p>nearly same size</p></div></div>`) },
    { name: 'nc/single-bordered-card', expect: null, note: 'one bordered card, no nesting', html: doc(cardBorder('<p>just body text and a heading</p>')) },
    { name: 'nc/fullbleed-section-holding-a-card', expect: 'nested-cards', note: 'THE REJECTED 2026-07-28 GUARD, pinned as a POSITIVE. Suppressing a full-bleed outer box gained precision on the tuning population and LOST it on the untouched held-out (0.750 -> 0.500, removing 2 true positives and 0 false positives), so the guard was not shipped. This page must still fire; a future re-tune that silences it has to bring a fresh held-out measurement.', html: doc(`<section style="width:1280px;height:400px;border-radius:12px;border:1px solid #ddd"><p>Full-bleed section</p><div style="width:300px;height:180px;border-radius:8px;border:1px solid #ccc"><p>A real card inside it</p></div></section>`) },
    { name: 'nc/rounded-section-no-treatment', expect: null, note: 'rounded section containing a rounded sub-block, neither with border/shadow (no card treatment)', html: doc('<section style="width:600px;height:300px;border-radius:12px"><div style="width:300px;height:150px;border-radius:10px"><p>plain rounded blocks</p></div></section>') },
    // ---- marketing-buzzword (v2: holistic weighted DENSITY >= 1.0 over content copy) ----
    // PRESENT (buzzword-saturated copy -> high density)
    { name: 'mb/dense-fluff', expect: 'marketing-buzzword', note: 'a buzzword-saturated marketing paragraph (density far above 1.0)', html: doc('<main><h1 style="font-size:56px">The revolutionary, seamless platform</h1><p style="font-size:18px">Our world-class, enterprise-grade, AI-powered solution is purpose-built to supercharge productivity and unlock limitless growth. Effortless, intuitive, and future-proof, it transforms how teams work and delivers best-in-class results. Elevate your workflow with our next-generation, all-in-one toolkit and accelerate innovation across the organization.</p></main>') },
    { name: 'mb/steady-marketing', expect: 'marketing-buzzword', note: 'realistic marketing copy with a steady drumbeat of buzzwords, carrying TWO distinct PEAK terms (seamless, effortless) - the v4 gate', html: doc(`<main><h1 style="font-size:56px">Modern automation for growing teams</h1><p style="font-size:16px">Acme is the modern platform that helps you streamline operations and scale with confidence. Our powerful, intuitive automation accelerates your work, and customers love how seamless and effortless it feels. From startups to enterprises, innovative teams rely on our enterprise-grade, all-in-one solution. ${'Get started in minutes and connect the tools you already use. '.repeat(2)}</p></main>`) },
    // ABSENT (concrete copy -> low density; or buzzwords excluded by scope)
    { name: 'mb/concrete-zero', expect: null, note: 'concrete technical copy with zero buzzwords -> density 0', html: doc(`<main><h1 style="font-size:56px">Deploy Postgres in thirty seconds</h1><p style="font-size:16px">${CONC.repeat(3)}Daily backups are retained for thirty days and you can restore to any second within that window. Read replicas are available in additional regions.</p></main>`) },
    { name: 'mb/single-stray-buzzword', expect: null, note: 'ONE stray buzzword diluted across substantial concrete copy stays below the density threshold', html: doc(`<main><h1 style="font-size:56px">A modern database for developers</h1><p style="font-size:16px">${CONC.repeat(6)}</p></main>`) },
    { name: 'mb/buzzwords-in-testimonial', expect: null, note: 'TESTIMONIAL exclusion: buzzword-heavy CUSTOMER QUOTE is social proof, excluded; the concrete body keeps density low', html: doc(`<main><h1 style="font-size:56px">Managed Postgres for teams</h1><blockquote class="testimonial" style="font-size:20px">This revolutionary, seamless, world-class platform supercharged our team and unlocked limitless, game-changing, best-in-class results.</blockquote><p style="font-size:16px">${CONC.repeat(3)}</p></main>`) },
    // THE MEASURED FALSE-POSITIVE MODE (2026-07-28). On the 138-page tuning population the v3 operating point fired
    // on MDN, Rust, Django, Kubernetes and Vercel docs: ordinary technical vocabulary (robust, scalable, efficient,
    // optimize, modern, advanced, intelligent) carried the density over the line, and the v3 qualify guard passed
    // because a page describing real engineering trivially contains ONE strong term. Each of those pages had 0 or 1
    // distinct PEAK term. This fixture reproduces that shape and pins the v4 gate: >= 2 distinct PEAK terms.
    { name: 'mb/technical-docs-one-peak-term', expect: null, note: 'V4 GATE: dense technical vocabulary at a density well ABOVE the firing threshold, with exactly ONE distinct PEAK term. This is the class that broke precision on held-out (0.304); it must be clean.', html: doc(`<main><h1 style="font-size:56px">Scaling the scheduler</h1><p style="font-size:16px">The scheduler is a robust, scalable component with an intuitive, flexible API. Advanced users can optimize placement with a comprehensive set of dynamic constraints, and the modern control plane automates rollout so upgrades feel seamless. Intelligent, unified defaults keep the integrated pipeline efficient and performant, and the premium tier adds sophisticated automation for productivity.</p></main>`) },
    { name: 'mb/two-peak-terms-fires', expect: 'marketing-buzzword', note: 'V4 GATE, the other side: the same register with TWO distinct PEAK terms (seamless, effortless) DOES fire - proving the gate is a threshold on PEAK distinctness and not a blanket suppression', html: doc(`<main><h1 style="font-size:56px">Scaling the scheduler</h1><p style="font-size:16px">The scheduler is a robust, scalable component with an intuitive, flexible API. Advanced users can optimize placement with a comprehensive set of dynamic constraints, and the modern control plane automates rollout so upgrades feel seamless and effortless. Intelligent, unified defaults keep the integrated pipeline efficient and performant, and the premium tier adds sophisticated automation for productivity.</p></main>`) },
    { name: 'mb/buzzwords-peripheral-only', expect: null, note: 'PERIPHERAL exclusion: a buzzword cluster in the footer is chrome, not the page copy => excluded', html: doc(`<main><h1 style="font-size:56px">Managed database for developers</h1><p style="font-size:16px">${CONC.repeat(3)}</p></main><footer style="font-size:18px">Seamless. Powerful. Revolutionary. Supercharge. Effortless. World-class. Unlock. Limitless.</footer>`) },
    // ---- default-typeface (Stage 4a). Fixtures live on disk so eval/typeface-calibrate.mjs scores the SAME
    // pages this test asserts on - one fixture set, two consumers, no drift between the sweep and the gate.
    // PRESENT (the content text is not set in a typeface anyone chose)
    { name: 'dt/unstyled', expect: 'default-typeface', faceGroundA: true, note: 'no font-family anywhere - the page renders in the UA default', html: face('p01-unstyled.html') },
    { name: 'dt/system-stack', expect: 'default-typeface', faceGroundA: true, note: 'the canonical -apple-system/BlinkMacSystemFont/Segoe UI/Roboto boilerplate - the most common default stack on the web', html: face('p02-system-stack.html') },
    { name: 'dt/websafe-monoculture', expect: 'default-typeface', faceGroundA: true, note: 'Arial body + Georgia headings + Courier code - the OS-bundled websafe monoculture, i.e. no typeface was bought or chosen', html: face('p03-websafe-monoculture.html') },
    { name: 'dt/webfont-declared-never-applied', expect: 'default-typeface', faceGroundA: true, note: 'THE RENDERED-ENGINE EDGE: the brand face is loaded via @font-face but no content selector references it, so the content renders on system-ui. A static source read sees the declaration and calls this clean; the rendered read is correct.', html: face('p04-webfont-declared-never-applied.html') },
    { name: 'dt/tailwind-defaults', expect: 'default-typeface', faceGroundA: true, note: 'untouched utility defaults (ui-sans-serif / ui-monospace) - the framework default, never overridden', html: face('p05-tailwind-defaults.html') },
    // ABSENT - precision. Each is a page that HAS chosen a typeface, in a way that is easy to over-fire on.
    { name: 'dt/branded-body', expect: null, note: 'a chosen face throughout', html: face('n01-branded-body.html') },
    { name: 'dt/brand-body-system-code-and-table', expect: null, note: 'brand face for prose + ui-monospace code + system-ui data table - normal, deliberate mixed typography; the default share stays well under the threshold', html: face('n02-brand-body-system-code-and-table.html') },
    { name: 'dt/brand-with-system-fallback', expect: null, note: 'the chosen face LEADS a long system fallback chain - the standard correct way to ship a webfont, and the case a naive all-families-are-system rule would still pass but a naive any-system-family rule would fail', html: face('n03-brand-with-system-fallback.html') },
    { name: 'dt/single-system-caption', expect: null, note: 'THE EXPLICIT PRECISION CONSTRAINT: exactly ONE element on a fallback stack must not fire the page', html: face('n04-single-system-caption.html') },
    { name: 'dt/system-chrome-branded-content', expect: null, note: 'nav + footer on the system stack (peripheral, excluded) with branded content - a very common, deliberate pattern', html: face('n05-system-chrome-branded-content.html') },
    // ---- default-typeface ground (B): brand mismatch, active ONLY where a committed family is KNOWN.
    { name: 'dt/brand-committed-and-used', expect: null, brand: ['Ostinato Sans'], note: 'the committed family IS what paints the content - the commitment landed, so no finding', html: face('n06-brand-mismatch-negative.html') },
    { name: 'dt/brand-committed-but-absent', expect: 'default-typeface', brand: ['Verge Serif'], note: 'GROUND B: the same well-typeset page scanned against a DIFFERENT committed family. The page is set in Alluvium Sans, so the committed Verge Serif carries 0% of the content - the brand decision did not land, even though the page is not on a default stack.', html: face('n01-branded-body.html') },
    { name: 'dt/no-brand-supplied-is-inert', expect: null, note: 'the SAME page with NO committed family supplied - ground B must be INERT, not guess at a brand', html: face('n01-branded-body.html') },
    // ---- default-typeface GROUND A GATE (2026-07-28). Ground A is gated OFF by default because its precision on
    // real pages is UNDEFINED: the only labeled positives anywhere are the five synthetic fixtures above, all 12
    // labeled REAL pages are negatives it stays silent on, and all 40 of its real-page fires (31/90 candidates,
    // 9/37 held-out) are unlabeled. Every ground-A positive above therefore asserts against the OPT-IN path; these
    // two assert the DEFAULT path stays silent, so a regression that quietly re-enables it fails here.
    { name: 'dt/gated-unstyled-silent-by-default', expect: null, note: 'GATE: the unstyled page - the strongest possible ground-A positive - must emit NOTHING with no opt-in', html: face('p01-unstyled.html') },
    { name: 'dt/gated-tailwind-defaults-silent-by-default', expect: null, note: 'GATE: untouched framework defaults must emit NOTHING with no opt-in', html: face('p05-tailwind-defaults.html') },
    // ---- default-typeface regressions folded from the Codex review ----
    { name: 'dt/quoted-family-containing-comma', expect: null, note: 'CODEX P2: a legal quoted family name that CONTAINS a comma. A naive split(",") reads the lead as "arial" and false-positives on a page that chose a typeface; the quote-aware splitter keeps the name whole.', html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:'Arial, Sans'"><main><p>${S.repeat(6)}</p></main></body></html>` },
    { name: 'dt/body-level-text-on-system-stack', expect: 'default-typeface', faceGroundA: true, note: 'CODEX P2: text placed DIRECTLY in <body> with no wrapping element. The walk includes document.body itself, so an unstyled bare page is still counted rather than scoring zero content.', html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif">${S.repeat(6)}</body></html>` },
];
async function run() {
    const impl = new Set(IMPLEMENTED_RULES);
    const browser = await playwright_1.chromium.launch({ headless: true });
    const failures = [];
    let asserted = 0;
    try {
        for (const f of FIXTURES) {
            const findings = await (0, subjective_rendered_scanner_1.analyzeHtmlOnBrowserSubjective)(browser, f.html, 30000, {}, {
                ...(f.brand ? { brandFamilies: f.brand } : {}),
                ...(f.faceGroundA ? { enableDefaultStackGround: true } : {}),
            });
            const fired = new Set(findings.map((x) => x.rule));
            if (f.expect === null) {
                asserted++;
                const firedImpl = [...fired].filter((r) => impl.has(r));
                if (firedImpl.length)
                    failures.push(`${f.name}: expected CLEAN but fired [${firedImpl.join(',')}]${f.note ? ' (' + f.note + ')' : ''}`);
            }
            else if (impl.has(f.expect)) {
                asserted++;
                if (!fired.has(f.expect))
                    failures.push(`${f.name}: expected ${f.expect} not detected${f.note ? ' (' + f.note + ')' : ''}`);
            }
        }
    }
    finally {
        await browser.close();
    }
    if (failures.length)
        throw new Error(`subjective-rendered calibration FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
    console.log(`subjective-rendered-calibration: OK (${asserted} asserted; implemented: [${IMPLEMENTED_RULES.join(', ')}])`);
}
run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
//# sourceMappingURL=subjective-rendered-calibration.test.js.map