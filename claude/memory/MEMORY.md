# Global Memory

## References
- [cmux browser pane](reference_cmux_browser.md) - Use cmux built-in browser for UI verification when inside a cmux terminal; prioritize over Chrome MCP
- [cmux markdown rendering](reference_cmux_markdown_render.md) - `cmux open <file.md>` renders markdown natively; do NOT install grip/glow/markserv and serve via localhost

## Sessions
- [Sidecoach deployment complete](session_2026-05-21_sidecoach_deployment.md) - Hooks symlinked to ~/.claude/hooks, registered in install.sh, ready for production
- [Attribution rule shipped](session_2026-04-23_attribution-rule.md): Added human-collaborator naming rule and How/Why memory requirement to claude/CLAUDE.md so the bundle ships it
- [PAUSE STATE - start here](session_2026-04-21_pause-state.md) - Full status of enforcement hooks (3/6 built), dotfiles portability (done), startup-check analysis (not implemented), what to do next
- [Enforcement hooks v1 setup](session_2026-04-13_enforcement-hooks.md) - PreCompact + PreToolUse Bash + PreToolUse Write/Edit hooks installed in ~/.claude/hooks/
- [Discord launcher folded into dotfiles](session_2026-04-14_discord-launcher-dotfiles.md) - Moved ~/.claude/discord-chat-launcher.sh into claude-dotfiles, install.sh wiring added
- [Ghostty placeholder + discord auto-wire](session_2026-04-14_portability-fixes.md) - Fixed ghostty path-pong (copy + placeholder), auto-wire discord source line into .zshrc with path-based idempotency

## Feedback
- [Behavioral failures - choice offering and skipping ahead](~/.claude/memory/session_2026-05-22_behavioral-failures.md) - Three critical pattern failures: text-form choices instead of AskUserQuestion, skipping ahead after told to STOP, acknowledgment without behavioral change. Active prevention mechanisms required. Test until passing.
- [Hook verification discipline](feedback_hook_verification_discipline.md) - Pipe-test raw hook commands before wiring into settings.json; use python3 -c json.dumps for fixtures, not echo
- [Planner pipeline drift](feedback_planner_pipeline_drift.md) - Cap planner-reviewer-remediator iterations at 2; switch language if bash hits its safe envelope
- [Discipline under pressure](feedback_discipline_under_pressure.md) - Never drop per-task memory writes or visual verification to appear fast; user frustration means more care, not less
- [Reprioritize on direct questions](feedback_reprioritize_on_questions.md) - When user asks a question, answer it directly; don't redirect to original task
- [Efficiency matters](feedback_efficiency_matters.md) - Waste is not acceptable; optimize for load time and user experience; sequential waits kill UX
- [Memory scope check](feedback_memory_scope_check.md) - Before writing memory, ask "project-only or every project?" - global lessons live in claude-dotfiles/claude/memory/ and symlink from ~/.claude/memory/
