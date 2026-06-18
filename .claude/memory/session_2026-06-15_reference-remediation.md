---
name: Reference page remediation - Jonah's 5 corrections
description: Fixing the rebuilt reference.html per Jonah - justify on every page, kill "dotfiles" (it's Improv), plain-language sidecoach (no flow codenames), strip internal task codes, real design QA via sidecoach
type: project
relates_to: [session_2026-06-15_reference-gospel-rebuild.md, feedback_plain_language_not_phase_codes.md]
---

Jonah's 5 corrections on the first reference.html build:
1. justify only loaded on the homepage -> inject justify-core into EVERY marketing page.
2. design is "ass" / "icky taste" - I ran sidecoach AUDIT only, never actually applied
   sidecoach critique/polish to the visual choices. Must do real design QA.
3. sidecoach docs are "a MESS" with "FUCK ASS terms" - the content dumped 48 internal
   flow codenames (flowA_brand_verify ... flowZ), task codes (T-0015 etc.), and jargon
   (cull, oh-my-claudecode, parity-plus). Violates feedback_plain_language_not_phase_codes
   for a PUBLIC page. Rewrite in plain language; reflect current state.
4. "dotfiles" everywhere - it's Improv. 14 occurrences -> all replaced.
5. Update the whole thing.

DONE so far:
- Injected justify-core.js?v=5 into beats/cheatsheet/justify/sidecoach.html (homepage +
  reference already had it). Now justify loads site-wide (dev).
- Content fixer over the authored JSON: dotfiles/Dotfiles -> Improv (0 remain), stripped
  T-NNNN task codes, fixed the paraphrased ~/.claude/.dotfiles-state path (real onboard
  uses ~/.claude/channels/discord/ + access.json).
DONE (all 5):
- Rewrote sidecoach.json fully in plain language: 9 chapters (Overview, Setup,
  How a design pass runs, Verb commands, Modes, Validators, QA gate, Where it sits,
  Source). The flow-codename dump became a plain numbered list (brand check ->
  component research -> ... -> tactical polish) + "26 flows in all". 0 flowX, 0
  T-codes, 0 oh-my-claudecode/parity-plus/cull. Verified in browser - reads like
  real docs.
- Re-assembled (60 chapters). Verified clean: 0 dotfiles, 0 flowX, 0 T-codes.
- Design taste pass (ran sidecoach audit + critique for the dimensions): killed the
  ~150px dead gap between subnav and content (.ref-layout padding-block ->
  space-6/space-20; dropped the .section 96px wrapper); cleaned the hero - "Every
  part of Improv, documented." (dropped the try-hard "The gospel."), red underline
  now on the single word "documented" (no descender mess). styles.css?v=33.
- Verified dark+light earlier; verified justify claudebar now appears on
  reference.html (and beats/cheatsheet/justify/sidecoach pages got the script).
NOTE: marketing-site has NO PRODUCT.md, so sidecoach critique fell back to generic
personas - a real gap; /sidecoach teach would fix it (flag for Jonah).
LESSON: the first build shipped internal jargon (flow codenames, dotfiles) to a
PUBLIC page because the authors pulled verbatim from CLAUDE.md/source without a
plain-language + public-naming pass. Author prompts for user-facing copy must
forbid internal codenames and the "dotfiles" name up front, not fix after.

CORRECTION 2 (Jonah, the big one): "the whole point of 2+ days was to remove modes
ENTIRELY and replace them with natural-language activation, which still isn't
mentioned in Sidecoach docs. Are you throwing on purpose?"
- Modes are DEPRECATED. feedback_mode_words_unnatural.md (2026-06-12): "I hate all
  of those mode words. They're unnatural conversationally." The replacement is the
  entire P1-P4f LANE / intent-detection build (intent-detector.ts, lane-classifier,
  lane-runner, lane-convergence, lane-checkpoint-store, lanes.generated.ts; MCP tools
  classify_intent / list_lanes / sidecoach_lane). You write naturally -> it classifies
  the intent -> runs to convergence -> checkpoints -> asks one clarifying question if
  ambiguous -> checks the real page in a browser -> works in any chat.
- FIX: cut "The modes" chapter from the reference; added headline chapter "How you
  invoke it: plain language" (after Setup) describing intent detection in plain words
  (mapped to Jonah's own glossary in feedback_plain_language_not_phase_codes.md);
  Overview now leads with natural language; verbs reframed as the explicit alternative.
  Verified in browser (fresh load) - modes gone, new chapter reads correctly.
- BROWSER CACHE GOTCHA: a hash-only navigate restored the OLD page from bfcache despite
  serve.py no-store; had to navigate with a ?fresh=1 query to force the new HTML.

SELF-ANALYSIS (why I shipped the dead feature): the author agent grounded in the
sidecoach SKILL.md + modes.ts, which STILL describe modes (the lane migration never
updated the skill docs or deleted modes.ts). I treated current source files as the
truth and never cross-checked the recent BEATS/decisions for what was deprecated -
even though feedback_mode_words_unnatural.md and the whole lane build were in
MEMORY.md and the git log. LESSON: when documenting a feature for a user-facing page,
check the beats for deprecation/replacement decisions FIRST; source files lag intent,
and a freshly-built replacement may sit beside the corpse it replaced.

STILL LINGERING IN CODE (flagged to Jonah, not yet done): modes.ts,
claude/hooks/sidecoach-modes.json, and the old MCP tools list_modes/resolve_keyword
still exist beside the new lane/intent system. "Remove modes entirely from our setup"
implies deleting these too - a separate, riskier code-cleanup task (must confirm no
caller depends on them). Offered to do it.

Collaborator: Jonah.
