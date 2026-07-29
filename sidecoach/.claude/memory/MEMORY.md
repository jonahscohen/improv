# Beats moved to the repo root

- [Sidecoach Session](session_2026-07-29_sidecoach.md) - design decisions, rules applied, metrics
- [Sidecoach Session](session_2026-07-28_sidecoach.md) - design decisions, rules applied, metrics
- [Sidecoach Session](session_2026-07-26_sidecoach.md) - design decisions, rules applied, metrics
This directory is no longer a beats corpus. All 37 session beats that lived here were
migrated to the canonical project-root record on 2026-07-24:

    /Users/spare3/Documents/Github/improv/.claude/memory/

**Write beats there, not here.** CLAUDE.md names the project-root `.claude/memory/` as the
canonical source of truth, and a second corpus nested inside `sidecoach/` split the
cross-session, cross-machine continuity layer in two.

This was not theoretical. On 2026-07-24 a teammate working in `sidecoach/` reported that two
beat files "do not exist" and proposed working around their absence - it was reading this
directory while the beats sat in the root one. A split record produces confidently wrong
reports about what has and has not been recorded.

The 14 index lines that were here are appended to the root `MEMORY.md`; the beat files kept
their filenames, so every link still resolves. Git history was preserved (`git mv`).

This file is a tombstone, deliberately left in place rather than deleted, so that anything
landing in `sidecoach/` is redirected instead of recreating the split.
