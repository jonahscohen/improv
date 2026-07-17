---
name: Browser quit path - single-line sign-off + legacy zshrc shortcut block was the "stuck" cause
description: Jonah wanted quit to return him to the shell with no trailing noise, just a quit confirmation and one formal sign-off line. Codex found the real "stuck" cause was an unmigrated legacy claude-dotfiles:shortcuts block in zshrc leaving a stale ampersand launcher.
type: project
relates_to: [session_2026-07-16_gum_stdin_pipe_root_cause.md, decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: real Terminal screenshot (render, no regression) + Codex pty byte capture of the quit epilogue
confidence: high
---

Jonah on quitting the browser: "I wanna return to shell and it keeps me stuck there. I also don't want to see all that unformatted messaging at the end. Just verbally confirm that quit is being activated AND sign off formally with a single line." He put Codex on it.

**ROOT CAUSE of "stuck" (Codex):** two separate things were being conflated.
1. `[ok]  Done.` was the browser's own quit tail, printed by `component_browser()`.
2. `Saving session... / ...copying shared history... / [Process completed]` is **Terminal.app + zsh shell-exit output**, NOT install.sh. It appears when the window's owning process exits. The generated `ampersand` function does not `exec`, BUT this machine still carried a **legacy `# === claude-dotfiles:shortcuts:begin ===` block** in zshrc that install.sh never migrated (it only knew the current `improv:shortcuts` marker). The stale shortcut body persisted and kept launching the old way.

**CHANGES (all in install.sh):**
- New `_br_quit_epilogue`: clears/restores the terminal, then prints exactly `Quit activated.` + `Session closed.` Nothing else.
- Removed the browser's `ok "Done."` quit tail.
- The unapplied-changes confirm gum chooser moved from stdin pipe to argv (same class of bug as [[session_2026-07-16_gum_stdin_pipe_root_cause.md]] - it was the last stdin-piped gum call).
- tty save/restore fallback for macOS `/usr/bin/script` ptys.
- The `ampersand` writer now MIGRATES legacy `claude-dotfiles:shortcuts` blocks (sed-delete + re-append current format) and runs `/bin/bash ./install.sh`, returning its status.

**Verified:** epilogue bytes identical across ESC / Quit row / Ctrl-C: `\x1b[0m\x1b[?25h\x1b[3J\x1b[H\x1b[2JQuit activated.\r\nSession closed.\r\n`. All three quit paths exit 0. `stty` restored (echo/canonical/signal); a command typed after exit echoed and ran normally. No `[ok] Done.`, no `Saving session`, no `[Process completed]` in installer output. Suites: component-browser 104, render 146, parity ALL PASSED, bash -n clean. Lead re-verified the render in a real Terminal at 80x24 by screenshot: no regression, single Up to date / single Quit / all six Core Components.

**PROVEN end-to-end (lead, pty driving an INTERACTIVE zsh, i.e. Jonah's real path):** typed `ampersand` at a live prompt, browser opened, selected Quit -> output was exactly `Quit activated.` / `Session closed.` followed by `spare3@Yes-JCohen improv %`, and a command typed at that prompt afterwards ran normally (`BACK_AT_PROMPT_42`). He DOES return to a working shell.

**THE "STUCK" WAS PARTLY MY OWN POLLUTION.** Jonah's zshrc `ampersand` is a clean function running `( cd ... && ./install.sh )` in a SUBSHELL - no exec, no exit - so it always returned to his prompt. The `Saving session... / ...copying shared history... / [Process completed]` block he kept seeing is Terminal.app + zsh window-exit text, emitted when a window is opened to run a SCRIPT rather than host a shell. That was MY test harness: I repeatedly ran `open -a Terminal /tmp/amp*.sh` and left the windows on his screen, and he reasonably read them as the installer's behavior. Lesson: do not leave throwaway launcher windows on the user's desktop; they become false evidence.

**Still unverified:** 80x40 paging behavior.

**Note for a future session:** the legacy-marker migration is a general trap - install.sh writes zshrc blocks keyed by a marker string, and the project has been renamed at least once (claude-dotfiles -> improv). Any other zshrc/settings block keyed on the old name has the same stale-content risk.

Files: install.sh (_br_quit_epilogue, component_browser quit path, unapplied-changes confirm, append_shortcuts/legacy migration), claude/hooks/test-browser-render.sh (new quit contract + pty timing).
