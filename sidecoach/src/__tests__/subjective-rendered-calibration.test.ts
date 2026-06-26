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
import { chromium } from 'playwright';
import { analyzeHtmlOnBrowserSubjective, type SubjectiveRule } from '../validators/subjective-rendered-scanner';

const IMPLEMENTED_RULES: SubjectiveRule[] = ['tiny-text', 'nested-cards', 'marketing-buzzword'];
interface Fixture { name: string; html: string; expect: SubjectiveRule | null; note?: string; }
const doc = (body: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
// ~75-char sentence; repeat to clear the 200-char min-content guard with realistic running text.
const S = 'This is a running body sentence with clearly more than six words of text. ';
// CONCRETE filler (zero buzzwords): dilutes density so a stray buzzword stays below the 1.0 threshold. ~22 words.
const CONC = 'Deploy a Postgres database from the dashboard or the command line and receive a connection string the moment it is ready. ';
const para = (px: number, n = 4) => `<p style="font-size:${px}px">${S.repeat(n)}</p>`;
// card helpers: a real-panel-size rounded container. border / shadow / bg-distinct each qualify as a "card".
const cardBorder = (inner: string) => `<div style="width:400px;height:300px;border-radius:12px;border:1px solid #ddd"><p>Card body</p>${inner}</div>`;
const innerBorder = `<div style="width:200px;height:120px;border-radius:8px;border:1px solid #ccc"><p>Inner panel</p></div>`;
const innerShadow = `<div style="width:200px;height:120px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.1)"><span>Inner</span></div>`;

const FIXTURES: Fixture[] = [
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
  { name: 'nc/rounded-section-no-treatment', expect: null, note: 'rounded section containing a rounded sub-block, neither with border/shadow (no card treatment)', html: doc('<section style="width:600px;height:300px;border-radius:12px"><div style="width:300px;height:150px;border-radius:10px"><p>plain rounded blocks</p></div></section>') },

  // ---- marketing-buzzword (v2: holistic weighted DENSITY >= 1.0 over content copy) ----
  // PRESENT (buzzword-saturated copy -> high density)
  { name: 'mb/dense-fluff', expect: 'marketing-buzzword', note: 'a buzzword-saturated marketing paragraph (density far above 1.0)', html: doc('<main><h1 style="font-size:56px">The revolutionary, seamless platform</h1><p style="font-size:18px">Our world-class, enterprise-grade, AI-powered solution is purpose-built to supercharge productivity and unlock limitless growth. Effortless, intuitive, and future-proof, it transforms how teams work and delivers best-in-class results. Elevate your workflow with our next-generation, all-in-one toolkit and accelerate innovation across the organization.</p></main>') },
  { name: 'mb/steady-marketing', expect: 'marketing-buzzword', note: 'realistic marketing copy with a steady drumbeat of buzzwords (density clearly above 1.0)', html: doc(`<main><h1 style="font-size:56px">Modern automation for growing teams</h1><p style="font-size:16px">Acme is the modern platform that helps you streamline operations and scale with confidence. Our powerful, intuitive automation accelerates your work, and customers love how seamless it feels. From startups to enterprises, innovative teams rely on our enterprise-grade, all-in-one solution. ${'Get started in minutes and connect the tools you already use. '.repeat(2)}</p></main>`) },

  // ABSENT (concrete copy -> low density; or buzzwords excluded by scope)
  { name: 'mb/concrete-zero', expect: null, note: 'concrete technical copy with zero buzzwords -> density 0', html: doc(`<main><h1 style="font-size:56px">Deploy Postgres in thirty seconds</h1><p style="font-size:16px">${CONC.repeat(3)}Daily backups are retained for thirty days and you can restore to any second within that window. Read replicas are available in additional regions.</p></main>`) },
  { name: 'mb/single-stray-buzzword', expect: null, note: 'ONE stray buzzword diluted across substantial concrete copy stays below the density threshold', html: doc(`<main><h1 style="font-size:56px">A modern database for developers</h1><p style="font-size:16px">${CONC.repeat(6)}</p></main>`) },
  { name: 'mb/buzzwords-in-testimonial', expect: null, note: 'TESTIMONIAL exclusion: buzzword-heavy CUSTOMER QUOTE is social proof, excluded; the concrete body keeps density low', html: doc(`<main><h1 style="font-size:56px">Managed Postgres for teams</h1><blockquote class="testimonial" style="font-size:20px">This revolutionary, seamless, world-class platform supercharged our team and unlocked limitless, game-changing, best-in-class results.</blockquote><p style="font-size:16px">${CONC.repeat(3)}</p></main>`) },
  { name: 'mb/buzzwords-peripheral-only', expect: null, note: 'PERIPHERAL exclusion: a buzzword cluster in the footer is chrome, not the page copy => excluded', html: doc(`<main><h1 style="font-size:56px">Managed database for developers</h1><p style="font-size:16px">${CONC.repeat(3)}</p></main><footer style="font-size:18px">Seamless. Powerful. Revolutionary. Supercharge. Effortless. World-class. Unlock. Limitless.</footer>`) },
];

async function run(): Promise<void> {
  const impl = new Set(IMPLEMENTED_RULES);
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = []; let asserted = 0;
  try {
    for (const f of FIXTURES) {
      const findings = await analyzeHtmlOnBrowserSubjective(browser, f.html, 30000);
      const fired = new Set(findings.map((x) => x.rule));
      if (f.expect === null) {
        asserted++;
        const firedImpl = [...fired].filter((r) => impl.has(r));
        if (firedImpl.length) failures.push(`${f.name}: expected CLEAN but fired [${firedImpl.join(',')}]${f.note ? ' (' + f.note + ')' : ''}`);
      } else if (impl.has(f.expect)) {
        asserted++;
        if (!fired.has(f.expect)) failures.push(`${f.name}: expected ${f.expect} not detected${f.note ? ' (' + f.note + ')' : ''}`);
      }
    }
  } finally { await browser.close(); }
  if (failures.length) throw new Error(`subjective-rendered calibration FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  console.log(`subjective-rendered-calibration: OK (${asserted} asserted; implemented: [${IMPLEMENTED_RULES.join(', ')}])`);
}

run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
