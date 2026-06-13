---
name: claude-mem vs beats evaluation
description: Evaluated thedotmack/claude-mem against the beats system; complementary not competitive, keep beats as source of truth
type: reference
relates_to: [session_2026-06-12_external-skill-eval-six-skills.md]
---

Evaluated https://github.com/thedotmack/claude-mem (v13.6.0, Apache-2.0, ~82k stars per GitHub) against this project's beats system, at Jonah's request (2026-06-13).

**What claude-mem is:** a fully-automatic, infrastructure-backed memory engine for AI agents (Claude Code, Codex, Gemini, Copilot, +). Pipeline: lifecycle hooks (SessionStart / UserPromptSubmit / PostToolUse / Summary / SessionEnd) stream every tool call into a worker daemon (HTTP :37777); a background Claude Agent SDK process compresses raw tool logs into structured observations (title+narrative+facts) + session summaries; stored in SQLite (`~/.claude-mem/claude-mem.db`, FTS5) + ChromaDB vector store; retrieved via MCP tools (search -> timeline -> get_observations, progressive disclosure ~10x token savings) and semantic injection at SessionStart.

**Core difference (opposite philosophies):**
- claude-mem = passive/automatic capture of everything, AI authors the memory, opaque DB+vector storage, semantic relevance retrieval, scales well, zero effort.
- beats = deliberate per-task writes, human+agent author intentional typed/linked entries, plain markdown in the repo, deterministic load-everything-at-startup, structured reasoning (decision beats w/ Alternatives/Why/Revisit-when).

**Two mismatches that matter most for Jonah:**
1. Cross-machine sharing: beats are git-committed (the entire reason beats exist - multi-machine continuity via shared repo). claude-mem stores in `~/.claude-mem/` OUTSIDE the repo, per-machine. It is local episodic memory; it does NOT provide shared-via-git continuity.
2. Telemetry: claude-mem v13.6.0 sends anonymized usage to PostHog by default (counts only, honors DO_NOT_TRACK / CLAUDE_MEM_TELEMETRY=0, and now backfills historical activity). Beats send nothing.

**Verdict:** complementary, not competitors. claude-mem = flight recorder (lossy, automatic, episodic - "what did I touch 3 weeks ago"). beats = lab notebook (intentional, structured, semantic - "why did we decide X, what did we reject"). claude-mem cannot produce reasoning that never entered the tool stream; beats cannot recall the mechanical edits nobody wrote down.

**Worth stealing:** claude-mem's retrieval pattern (relevance-filtered fetch of matched IDs) is the answer to beats' growing O(corpus) context tax at startup. The `reflect` skill is a manual approximation of it. Recommendation: keep beats as source of truth; if corpus-growth context pressure becomes the pain, borrow claude-mem's retrieval (relevance-filtered load) rather than its storage. Running both side by side is non-conflicting (one writes the repo, one writes ~/.claude-mem).

Collaborator: Jonah.
