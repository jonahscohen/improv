---
name: Browser/visual validation tool precedence + routing map
description: Canonical precedence for the in-browser/visual validation + control tools (cmux, claude-in-chrome, Peekaboo, computer-use, Playwright collector, dedicated MCPs, justify) - what takes precedence over all, P1 per surface, and the last-resort fallback; reconciles CLAUDE.md tiers + the Verification Protocol + the 2026-05-26 parity audit
type: reference
relates_to: [reference_local_testing_parity_audit_2026-05-26.md, session_2026-05-26_peekaboo_parity_audit.md, session_2026-06-14_p4b2-COMPLETE.md]
---

Routing/precedence for the browser/visual validation + control tools. CRITICAL:
precedence is ENVIRONMENT-FIRST. The client surface Claude runs in determines which
tools even EXIST. cmux is TERMINAL/CLI-ONLY (Jonah's setup; the team mostly is NOT
in cmux). Users may be on: phone, desktop app (mac/win), IDE sidebar, or CLI/cmux.
Do NOT treat cmux as a team-wide default.

**ABOVE ALL (the rule, not a tool): the Verification Protocol.** Verify with eyes on
a REAL screenshot, via REAL input. A DOM/AX state-READ may be used for TARGETING but
NEVER as PROOF (same banned shortcut as DOM-state-reads-via-JS). On constrained
surfaces (phone/IDE) the "eyes-on screenshot" is supplied by the USER or measured by
the engine - not driven by a client tool.

**TWO CLASSES OF TOOL:**
- ENGINE-SIDE = PORTABLE (works regardless of where the human is, because it runs on
  the machine executing the engine): the Playwright collector (P4b-2) + tilt-lab
  verify. This is the ONLY universal validation layer - the only automated check
  available to a teammate on a phone with no cmux/extension/screen access. It is the
  common floor under every environment, not a niche track.
- CLIENT-SIDE = ENVIRONMENT-GATED (only exist in specific surfaces + when connected):
  cmux, Chrome MCP (claude-in-chrome), computer-use, Peekaboo, justify.

**P1 BY ENVIRONMENT (visual verify / native):**
- cmux / terminal (Jonah): cmux browser pane / Peekaboo+computer-use. cmux is
  CLI-ONLY - nobody outside cmux has it.
- Desktop app (macOS): Chrome MCP if extension connected / Peekaboo -> computer-use.
  (no cmux)
- Desktop app (Windows): Chrome MCP / computer-use. (no cmux, NO Peekaboo - macOS-only)
- IDE sidebar: Chrome MCP if wired, else engine collector + user-shared screenshots.
- Phone / claude.ai: NO client capture tools -> engine collector + user-provided
  screenshots is the only path.

**Last-resort (where it exists): computer-use** raw pixel screenshot + click/type.

**App-specific override (highest when it applies):** a dedicated MCP for the exact
app (Figma, Slack, etc.) beats general tools FOR THAT APP'S DOMAIN.

**Off the validation ladder: justify** - in-browser change AUTHORING/preview/review
(manipulate/buffer/apply overlay), not validation; also client-side (needs its
server + a browser).

**One-line:** Above all = the Verification Protocol. The ONLY portable/universal
validation = the engine-side Playwright collector (works on phone/desktop/IDE/CLI).
Client P1 is environment-dependent: cmux ONLY in cmux; Chrome MCP on desktop/IDE with
the extension; Peekaboo for native macOS; computer-use the pixel last-resort where it
exists. cmux is Jonah's personal P1, NOT a team default.

**Validation-guard caveat (from the audit):** if Peekaboo is used in a VERIFICATION
context, `peekaboo see --json`/AX-read used as PROOF is the same shortcut as banned
DOM-state reads; the guard should treat AX-read-for-verification like a state-read.
AX-read-for-targeting is fine.

Collaborator: Jonah.
