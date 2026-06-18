---
name: Demo reframed as a general full-loop Claude Code session (not sidecoach)
description: marketing-site/demo.html (renamed from sidecoach-demo) replays a full agentic loop on a made-up task - rate-limit a login endpoint - explore/plan/edit/test/fail/fix/verify/commit, faithful Claude Code TUI
type: project
relates_to: [session_2026-06-17_sidecoach-demo-rebuilt-real.md, feedback_simulations_match_real_tui.md]
---

Jonah: "make the demo go through a full loop, make it not about sidecoach, make up a task that's lengthy and fully involved."

Rebuilt the demo as a GENERAL Claude Code session (no sidecoach framing). Renamed sidecoach-demo.html/css -> demo.html/demo.css; removed the old sidecoach-demo.* and assets/sidecoach-session.json. Page copy: eyebrow "Live demo", title "Watch the full loop.", lede about explore/plan/edit/test/fix/verify/commit. Title bar "claude · acme-api". Badge "simulated" (it is a made-up illustration now, labeled honestly).

The made-up task (lengthy, fully involved): "logins are getting hammered by credential stuffing. add rate limiting to the login endpoint." The transcript runs the whole agentic loop:
- Explore: Grep(rateLimit) -> none, Grep(POST /auth/login), Read auth.ts / server.ts / middleware/index.ts
- Plan: 4 "- " list items (token bucket, 5/15min, applied to POST /auth/login, a test)
- Implement: Write rate-limit.ts, Update auth.ts, Update config.ts, Write rate-limit.test.ts
- Test -> REAL FAILURE: "1 failed ... ✗ returns 429 after 5 attempts (expected 429, got 200)" (✗ in orange)
- Diagnose + fix: root-causes the module-scope bug, Update rate-limit.ts
- Re-test -> "59 passed" (green), live curl verify "200 200 200 200 200 429" (429 highlighted orange), tsc --noEmit clean
- Summary (4 "- " items) + git commit "[main 7f3c1a9] ... 4 files changed, +120 -3"
- idle ❯ prompt

Faithful Claude Code TUI (same engine as the prior version): warm near-black screen, off-white text, GREEN ● tool bullets, off-white ● assistant bullets, └ result branches, "- " assistant list items, ORANGE ✶ spinner cycling sparks with verb changing per phase (Exploring/Planning/Implementing/Testing/Diagnosing/Verifying) and "(Xm Ys · N tokens)" climbing to a believable multi-minute total, ❯ orange prompt. New status colors: .scd-fail (orange ✗), .scd-ok (green pass), .scd-hl (orange 429). Brand red stays only on the page eyebrow/headings.

Files: marketing-site/demo.html, demo.css (?v=1). Engine: custom async/await, spinner pinned bottom, IntersectionObserver autostart + Replay, prefers-reduced-motion = instant final state, body aria-hidden (decorative).

VERIFICATION CAVEAT: Chrome FREEZES/throttles JS timers in an unfocused background tab, so the headless replay crawls (~4 cps typing) or freezes until clicked. Confirmed rendering of page chrome, ❯ prompt + typing, and (in the identical-engine prior version) the full faithful transcript incl. green ● / └ / orange spinner. The new status-color spans use the same innerHTML render path. Runs full speed in a focused foreground tab.

Collaborator: Jonah.
