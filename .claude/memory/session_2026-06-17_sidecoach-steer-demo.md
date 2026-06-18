---
name: Sidecoach "steer" demo - web replay of the designed --render panel
description: marketing-site/sidecoach-demo.html shows a Claude session routed through Sidecoach with the designed panel animating (route/flow/checklist/phases/gates/verdict); mirrors the engine --render layer; gate catches a contrast miss then Claude fixes it
type: project
relates_to: [session_2026-06-17_sidecoach-render-presentation-layer.md, session_2026-06-17_demo-full-loop-rebuild.md]
---

Jonah ("let's try it"): build the web demo that replays the designed Sidecoach --render output with animated progress, so the demo shows Sidecoach steering rather than vanilla Claude.

Built marketing-site/sidecoach-demo.html (demo OF sidecoach; the rate-limit demo.html stays the general-loop one). Page: eyebrow "Live demo", title "Watch Sidecoach steer.", lede about seeing the machinery (flow + confidence, phases, checklist, gates). Title bar "claude · acme-web". Labeled simulated.

The arc:
- ❯ "audit this page for accessibility, performance, and theming"
- ● Routing that through sidecoach.
- THE SIDECOACH PANEL (a left-orange-accented, faintly-tinted block = visually distinct from plain Claude lines), mirroring bin/sidecoach-present.js:
  - ◆ sidecoach · multi-lens audit
  - route: "classifying intent" -> resolves to Multi-Lens Audit · flowK · conf 0.85
  - flow: brand verify › multi-lens audit › design critique
  - checklist bar climbs 0/5 -> 5/5 as phases complete (▰ on / ▱ off)
  - ◇ phases each [running] (pulsing) -> [done] (green); multi-lens audit shows the 5 dimensions
  - gates: ✓ taste, ✓ claudemd-mandate, ✗ polish-standard (catches a contrast miss)
  - verdict: 1 finding · grade B
- ● Claude acts on the gate's finding: Update(styles.css) raising --text-tertiary to AA
- gate flips ✗ -> ✓ polish-standard; verdict updates to clean · grade A · 0 findings
- ● summary, idle ❯

CSS: added .scd-sc* panel classes to demo.css (?v=2) - left orange border, faint tint, phase status run/done/skip/fail, progress bar on/off, gate ok/no, verdict clean/find. Engine reuses the demo.css TUI palette + the async/await helpers.

VERIFIED in browser, FULL transcript end-to-end (incl. the tail). The headless background tab freezes mid-animation (Chrome suspends JS timers in an occluded tab), so to verify "within the existing constraints" (Jonah's ask) I added a `?ff=1` instant mode:
- sleep() returns Promise.resolve() (a MICROTASK) instead of setTimeout when reduce/ff, so the whole transcript builds inside ONE macrotask - a throttled tab can't freeze between timers.
- add() sets final opacity/transform inline in reduce mode (no stranded fade).
- when reduce/ff, run() is called directly (not via IntersectionObserver, which never fired before the freeze).
Navigating ?ff=1 then read_page + scroll_to confirmed EVERYTHING renders correctly: the distinct orange-accented panel (◆ header, route+conf, flow chain, checklist 5/5, 3 phases green [done] + dims), gates ✓ taste / ✓ claudemd-mandate / ✓ polish-standard (final state after the flip), verdict clean · grade A · 0 findings, the fix sequence (● polish gate caught contrast -> Update(styles.css) -> --text-tertiary #8B8A82 → #6E6D66), summary, idle ❯. Colors/layout all correct.
The normal (animated, no-ff) view plays the ✗-catch -> fix -> ✓ transition at full speed in a focused tab; ?ff=1 jumps to the resolved end state (useful for verification + an instant/reduced-motion render).

Honest note retained: this is a happy-path illustration. The gate-catches-contrast-then-fix beat is faithful to a real successful session (Sidecoach routes/scaffolds/gates; Claude does the fix), using real flow/gate/dimension names, but the engine itself often skips flows / rubber-stamps - the demo shows the intended good run, labeled simulated.

Files: marketing-site/sidecoach-demo.html (new), demo.css (?v=2, panel classes added).

Collaborator: Jonah.
