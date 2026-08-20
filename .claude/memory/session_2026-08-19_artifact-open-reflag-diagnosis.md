---
name: artifact-open-stop re-flag loop - FIXED (peer-reported)
description: Fixed the artifact-surface trio re-flagging already-shown files; added mtime-gated shown ledger + .design exclusion + ARTIFACT_SURFACE_IGNORE knob
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex
confidence: high
---

Peer session (iacp/newsletter-template) reported artifact-open-stop.sh re-flagging the SAME .design/figma/*.png captures on nearly every Stop even after each was Read 3+ times; and no durable way to mark an internal-scaffold dir as never-flag. Jonah chose "fix loop + ignore".

ROOT CAUSE (reproduced with the 3 real hooks + crafted JSON): discharge (clear.sh) is FINE - a Read strikes the path from the per-session pending file. The bug is RE-ARMING: mandate.sh harvests visual paths from ANY non-consumer Bash command's text/stdout and dedups ONLY against the current pending file, with NO "already shown" memory. So after a Read strikes a path, a LATER Bash command that merely MENTIONS that same absolute path re-appends it, and the Stop gate re-blocks on an already-shown file. Building AGAINST reference captures mentions those paths repeatedly, so they kept coming back.

FIX (shipped, NOT committed; hooks live via symlink so active immediately on this machine):
1. **Shown ledger** `.artifact-shown.<session>` (per-session key byte-identical to pending, reaped at +1 day alongside pending). clear.sh writes `path<TAB>mtime_ns` on every discharge (latest-wins, replace-or-append). mandate.sh loads it and SKIPS a candidate only when the candidate is a MENTION (generic visual scrape of a Bash command/stdout) AND the file is UNCHANGED since shown (`st_mtime_ns <= recorded`). CREATIONS (Write, -o/--output, redirects, save()-calls, MCP output keys) are considered first and NEVER skipped.
2. **.design/ exclusion** added to EXCLUDE_ALWAYS (parallels .claude/) - internal Figma reference captures never flagged.
3. **ARTIFACT_SURFACE_IGNORE** env: comma/space list of dir-name/path fragments a project marks as scaffolding; segment-bounded regex (re.escape'd, ReDoS-safe), matched against the canonical path. Durable per-project or global.

SELF-ANALYSIS (a P1 I shipped, Codex caught): my FIRST fix was a path-only shown-skip in the bash wrapper - skip recording if PATH_TO_SHOW is in the shown ledger. Codex round 1 flagged the false-clean: that also suppresses a genuine RE-CREATION/overwrite of a shown path (new content, unshown). WHY I missed it: I conflated PATH IDENTITY with ARTIFACT IDENTITY - "same path = same artifact already shown" is false when the file is regenerated. Round-2 fix (creations-vs-mentions split) narrowed it but Codex round 2 showed a bare-positional Bash re-creation (`magick in.jpg shown.png`) still reads as a mention. The real discriminator is CONTENT CHANGE, not position - hence mtime. LESSON: for a "seen this already" cache keyed on a path, the key must include a change-token (mtime/hash), or a re-creation is silently hidden.

VERIFICATION: mandate 65 / clear 25 / stop 12 suites green (baseline 56/23/12; +9 new regression cases incl. re-creation-still-flags for Write, --out, and bare-positional-newer-mtime, plus segment-bounded ignore + control mutants). End-to-end 6/6 with the real hooks (create->Read->mention-quiet->Stop-clean->recreate-reflag). 3 Codex rounds: 2 folded (the P1 via mtime), final round P0/P1 NONE, no fail-open regression, no ledger-parse crash (all error paths fall to record-not-suppress). Accepted-as-designed (not folded): reused-session-key collision + >1-day-session ledger reaping (both pre-existing per-session-file properties, low-prob, reaper-bounded); broad ARTIFACT_SURFACE_IGNORE tokens are a user footgun by design.

Files: claude/hooks/artifact-open-mandate.sh, artifact-open-clear.sh, test-artifact-open-mandate.sh, test-artifact-open-clear.sh. stop.sh untouched.
