---
name: Icon priority cascade replaces one-library-per-project
description: Context-routed icon/logo/illustration cascade (Figma > animated > reicon > static; logos = Lobehub; illustrations = imagegen) with a fail-hard gate for the mechanizable subset. Supersedes the blanket one-library rule.
type: decision
relates_to: [feedback_ai_icons_lobehub.md, session_2026-07-28_fabricated-svg-primitive-gap.md, session_2026-07-28_icon-source-fix.md, project_2026-09-05_PENDING-icon-cascade-agent.md]
supersedes: project_2026-09-05_PENDING-icon-cascade-agent.md
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests (73/73) + 1898-file over-block dry-run (0 denies) + web/gh source verification + independent-Claude review folded + real gpt-5.5 Codex review folded (1 over-block fixed)
confidence: high
---

Collaborator: Jonah. Base commit 89bc1355.

Chose a CONTEXT-ROUTED icon cascade over the old blanket "one library per project" rule. A
project now legitimately mixes sources by context. Encoded as authoritative routing in the
`icon-source` skill, a tight clause in `claude/RULES.md`, and a fail-hard PreToolUse gate for
the mechanizable subset.

## The cascade (what was decided)

- **Interactive-element icons:** (1) Figma reference -> extract the icon FROM Figma;
  (2) else ANIMATED in order Lucide Animated -> Heroicons Animated -> Hugeicons Animated;
  (3) no animated icon for the concept -> reicon; (4) else the static fallback tier.
- **Non-interactive icons:** reicon first, then static tier (animation not a priority).
- **Illustrations (vs stock photo):** imagegen via sidecoach-image; reicon spot icons only
  supplement.
- **Company / brand / AI logos:** Lobehub first, reicon brands a limited fallback.
- **Static fallback tier:** Lucide -> Heroicons -> Hugeicons -> Phosphor -> Material Symbols
  (Tabler / Bootstrap for edge cases). One-library-per-project survives ONLY inside this tier.

## Alternatives considered

- **Keep blanket one-library-per-project:** rejected - it cannot express "Figma icon here,
  AI logo there, animated toggle elsewhere," which is the real need. Kept only where it still
  matters (static-fallback coherence).
- **Hard-block the full cascade priority (Figma>animated>reicon>static) at write time:**
  rejected as unsound. A hook cannot know whether a Figma reference exists, whether an
  animated icon exists for a concept, or whether the Figma file contains the icon. Forcing it
  would over-block. Priority is BEHAVIORAL (the skill), not mechanical.
- **Reuse the taste-validator fabricated-svg detector's branch 1 (>=2 paths || pathLen>50) as
  the hard block:** rejected - branch 1 fires on every normal multi-path verbatim icon; as an
  INJECT that is tolerable, as a BLOCK it is massive over-block. The gate uses only the
  branch-2 semantic signal (P=1.000) plus a no-marker exemption.

## Why this one

It matches how real builds actually source graphics, and it is the first icon rule with a
mechanical backstop that is provably sound (see below). The two hard-block checks
(off-cascade import; marker-less fabricated icon) have ZERO blast radius on the repo's own
source, so "can't fail" does not become "blocks real work" - the exact failure mode that
caused the multi-day Figma-fidelity regression.

## Evidence that CONTRADICTS the brief premise (flagged, resolved in the skill)

Two of Jonah's 8 rules assumed reicon capabilities it does not have:

1. **reicon has NO illustration set.** It is a 2,682-icon UI set (Outline/Filled + a duotone
   set), single source `data/icon-data.json`, 38 UI categories (arrows, ui, files, faces...).
   So "illustrations -> reicon" was re-pointed: primary illustration route is imagegen
   (sidecoach-image); reicon spot icons only supplement.
2. **reicon has NO comprehensive company/AI-logo library** - only a small `reicon-brands.js`
   brand/social bundle. So logos route to Lobehub first; reicon brands are a limited fallback.
3. **Hugeicons Animated is NOT in the official Hugeicons monorepo.** It exists as a separate
   third-party shadcn-CLI project `enesgules/hugeicons-animated` (hugeicons-animated.com), and
   it declares no LICENSE file - flagged in the skill (confirm license before redistributing).

## What each source actually is + exact sourcing (verified 2026-09-05)

- **reicon** (`dqev/reicon`, reicon.dev, MIT): 2,700+ UI icons, Outline/Filled + duotone.
  Raw SVG (copy from reicon.dev/icon/<name>, the ZIP, or data/icon-data.json, currentColor
  24x24), web component `<re-icon name="...">`, npm `reicon-react` (+ vue/svelte/vanilla/rn/
  flutter), and an MCP server `reicon-mcp`.
- **Lucide Animated** (`pqoqubbw/icons`, lucide-animated.com, MIT + no-resell README clause):
  React+Framer Motion, ~467 components, shadcn registry
  `npx shadcn@latest add "https://lucide-animated.com/r/<name>.json"`.
- **Heroicons Animated** (`heroicons-animated/heroicons-animated`, MIT): React+motion,
  `npx shadcn@latest add @heroicons-animated/<name>` or `npm add @heroicons-animated/react motion`.
- **Hugeicons Animated** (`enesgules/hugeicons-animated`, no license file): motion,
  `npx shadcn@latest add @hugeicons-animated/<name>`, geometry from `@hugeicons/core-free-icons`.
- **Lobehub** (`lobehub/lobe-icons` master, MIT): 900+ AI/company logos; `@lobehub/icons`
  React, `@lobehub/icons-static-svg` + CDN unpkg. See feedback_ai_icons_lobehub.md.
- **Static tier:** Lucide, Heroicons, Hugeicons (@hugeicons/react + core-free-icons), Phosphor,
  Material Symbols, Tabler, Bootstrap Icons - verbatim path data only.

## The gate (mechanizable subset only, fail-HARD)

`claude/hooks/icon-cascade-guard.sh` (PreToolUse Write|Edit|MultiEdit), tests
`claude/hooks/test-icon-cascade-guard.sh` (59/59 green):

- **B1 off-cascade import:** denies an import/require/side-effect-import of an icon library
  outside the cascade (react-icons, Font Awesome, Feather, Iconify, Ionicons, Ant/MUI icons,
  primeicons, remix/box/octicons, ...). Matched as a module SPECIFIER, so CSS/font banners in
  captured pages never match.
- **B2 marker-less fabricated icon:** denies an inline <svg> with the taste-validator's
  P=1.000 semantic signal (root aria-hidden=true + currentColor + square viewBox <=48 + no
  text/image/defs/gradient/animate/use) built from >=2 primitives OR a compound path with >=2
  subpaths, carrying NO provenance marker. A verbatim icon that keeps its library class /
  data-icon-source marker passes. Deliberately does NOT fire on two separate <path> elements
  (zero-FP over recall; the taste-validator inject still surfaces that softer case).

**Path gate (the soundness core):** fires only on buildable app source
(.html/.htm/.jsx/.tsx/.vue/.svelte/.astro; imports also .ts/.js/.mjs/.cjs) and NEVER on
corpus (eval/corpus), generated fixtures (efficacy-trial, fixtures, __tests__), backups,
node_modules, worktrees, dist/build, _extracted, dependency-map, test-*/.test./.spec. files,
or non-app files (.md/.css).

**BEHAVIORAL (documented, not hooked):** the cascade priority ordering, static-on-interactive,
logo routing, illustration routing. A hook cannot soundly decide these.

## Blast-radius survey (done BEFORE wiring any block)

- All 20 off-cascade icon-library string matches in the repo are in
  `sidecoach/eval/corpus/candidates/` (captured third-party pages). ZERO in improv's own
  source. The path gate excludes the corpus.
- 54 aria-hidden SVG files exist, mostly `sidecoach/efficacy-trial/**` generated fixtures -
  excluded by the path gate. B2 would-fire count on the one real app-source primitive file
  (`claude/installer-gui/index.html`) = 0.
- Dry-run of the guard over ALL 1,898 tracked app-source files as simulated writes: **0
  denies.** No over-block on committed source.

## Revisit when

- reicon ships a real illustration or comprehensive-logo set (then rules 6/7 can point back to
  it).
- Hugeicons Animated adds a clear license (remove the redistribution caveat).
- An animated library is added/dropped from tier 2, or a new off-cascade library becomes
  common enough to add to the B1 blocklist.
- The gate is ever seen to over-block real source (re-run the 1,898-file dry-run; treat any
  new deny as a soundness bug, not a feature).

## Cross-model review + folded findings

Codex was UNAVAILABLE: `~/.claude/hooks/codex-review.py` is pinned to model `gpt-6-astra`,
which the installed `codex-cli 0.152.1` rejects ("requires a newer version of Codex"). The
wrapper failed loudly and told us to fall back. Per RULES item 8, an independent Claude
reviewer (fresh context, not the producer) reviewed the diff. Verdict SHIP-WITH-FIXES; all
findings folded and the whole unit re-verified (70/70 + 0/1898):
- HIGH (over-block): B1 matched an off-cascade name inside a `//` comment or a mid-code
  string, denying the whole write. Fixed: strip comments and anchor matching to real
  import/require positions. Residual (multiline template-literal code sample) documented.
- LOW: scoped-package over-match (`@iconify` swallowing `@iconifyx`). Fixed: boundary match
  `s == lib or s.startswith(lib + "/")` for all entries.
- LOW: comma-separated viewBox slipped B2. Fixed: accept `[\s,]+` separators.
- LOW: short markers `ph-/ti-/bi-/hgi` matched as bare substrings (e.g. inside "morph-x").
  Fixed: require a class-token boundary for those.
- LOW-MED (doc): repo-sourced static icons ship no class, so adding aria-hidden would trip
  B2. Fixed in the skill: instruct adding `data-icon-source` on repo-copied icons.
- Dead-code `base` variable removed.
- Split-mechanics (heredoc + env var), fail-open on malformed input, and the
  mechanizable-vs-behavioral split were confirmed sound.

## Cross-model review UPDATE (real gpt-5.5 Codex, 2026-09-05, Jonah)

The earlier "Codex UNAVAILABLE" was a config-pin problem, not a real outage. `codex-review.py`
passes no `-m` by default, so it inherits the codex CONFIG's model, which still resolves to
`gpt-6-astra` (rejected by codex-cli 0.152.1) - the comment in codex-review.py saying "currently
gpt-5.5" is only a comment. Forcing `-m gpt-5.5` restores it (SMOKE_OK 8.6s). So a genuine
DIFFERENT-MODEL review finally ran. (Durable fix belongs in the codex config pin, tracked
separately; the `-m gpt-5.5` override is the working path meanwhile.)

gpt-5.5 returned 10 findings. Triaged against this gate's core promise (NEVER over-block; recall
is deliberately secondary):

- **1 genuine OVER-BLOCK, FOLDED:** a `require()`/`import()` CALL sitting INSIDE a string literal
  (e.g. `const s = 'require("react-icons")'`) denied the write, contradicting the documented
  "mid-code strings never deny." Fixed with a same-line quote-balance check (`_in_string_literal`)
  that skips a call keyword sitting inside a string; multiline/template edge cases fall through as
  not-in-string (fail-OPEN, the safe direction). Regression tests added (require/import-in-string
  and backtick-template variants). Suite 70 -> 73 green; 1898-file dry-run still 0 denies; a real
  `require("react-icons")` call still denies.
- **9 UNDER-BLOCKS = fail-open, NOT folded** (folding them would grow the deny surface and risk the
  over-block this gate forbids; they match the documented zero-FP-over-recall stance or the
  "revisit when" blocklist-growth path). Recorded for improv-pm to weigh, not defects:
  - Edit/MultiEdit sees only `new_string`, not the assembled file (inherent PreToolUse limit;
    content-guard has the same shape).
  - `/worktrees/` path exclusion could skip real app source kept under a worktrees/ dir.
  - `@iconify-icons/*` and `@remixicon/react` (scoped React pkgs) aren't in the B1 blocklist - the
    exact "add a library when it becomes common" case in Revisit-when.
  - JSX boolean `aria-hidden={true}` not recognized (only the `="true"` string form).
  - Single-quote / JSX-expression `d='...'` path data not counted for compound detection
    (documented double-quote-only recall limit).
  - `//` comment-strip is not string-aware (a same-line URL string can erase a later call).
  - Non-zero-origin square viewBox (`-12 -12 24 24`) not parsed (documented recall limit).
  - Long provenance markers are plain substrings, so `class="not-lucide"` falsely vouches
    (symmetry with the short-marker tightening; fail-open bypass).
- The over-block fix is permissive-only (it strictly shrinks the deny surface), so it cannot add a
  new over-block; verified by the new tests + the clean 1898-file dry-run rather than a second
  full Codex pass.

## Incident (transient EPERM during the fold) - self-analysis

Mid-fold, an environment-wide transient EPERM burst hit: python3 could not access its import
path cache and the two session-created hook files were unreadable/unwritable even with the
Bash sandbox disabled (the independent reviewer hit the same on the hook file). This is the
condition in session_2026-09-02_env-cwd-eperm-transient-resume.md. It self-healed after a few
minutes. Why it slowed us: the fix required editing files that were momentarily locked. How it
was handled: rebuilt the corrected files in the scratchpad, polled for the environment to heal
(python-import + file-read probe), then dropped them in and re-verified. No code defect - the
59/59 and first 0/1898 runs passed before the burst; the burst was infrastructure, not logic.

## Files touched

- claude/skills/icon-source/SKILL.md (rewritten to the cascade)
- claude/RULES.md (cascade clause replacing the old verbatim-icon bullet)
- claude/hooks/icon-cascade-guard.sh (new, PreToolUse gate)
- claude/hooks/test-icon-cascade-guard.sh (new, 59-case falsification suite)
- .claude/memory/feedback_ai_icons_lobehub.md (refreshed sourcing)
- .claude/memory/decision_2026-09-05_icon-priority-cascade.md (this beat)
- .claude/memory/MEMORY.md (index)

Not committed - improv-pm reviews and commits. Gate not yet wired into settings.json/install.sh
(integration step for improv-pm; see the report).
