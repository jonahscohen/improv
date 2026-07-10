---
name: Split skills component out of claude so existing Claude users can layer in
description: Promoted Anthropic Skills install to its own opt-in TUI component (`skills`), separate from the monolithic `claude` component. Lets users with existing Claude Code setups install tactical-polish without overwriting their CLAUDE.md/settings.json. Documented the plugins-merge gap as a TODO.
type: project
---

Collaborator: Jonah Cohen

# What changed

## install.sh

- Added `skills` as the 2nd component (between `claude` and `ghostty`) in the KEYS/TITLES/DESCS arrays. Default-on. Description: "additive, safe alongside existing setup."
- Moved the `npx skills add jakubkrehel/tactical-polish` block out of the `claude` apply-section into its own `# 2. Anthropic Skills` section guarded by `picked skills`.
- Renumbered subsequent section comments (3-8) to keep the file's section numbering consistent.
- `--preset minimal` now picks `claude + skills + nvm` (was `claude + nvm`). Reasoning: minimal is "the bare essentials," and skills are now an explicit opt-in piece of that.
- `--help` valid keys list updated to include `skills`.
- Post-install summary line for the skill moved from the claude bullet to its own `picked skills && echo "..."` line.
- `claude` component description rewritten to be honest about what it overwrites (CLAUDE.md, settings.json, hooks, statusline, memory) and tells users with existing Claude Code setups to skip it and pick `skills` alone.
- `skills` description explicitly calls out that it does NOT touch CLAUDE.md / settings.json / hooks / statusline.

## README.md

- Component table now has 8 rows; `skills` is row 2 with "**Additive**" highlighted and the no-touch list spelled out.
- New "Boost an existing Claude Code setup without overwriting it" subsection. Tells users with their own Claude Code config to pick `skills` standalone. Documents the plugins-merge gap honestly: today the plugin list is bundled inside settings.json, so to layer just plugins onto an existing settings.json they need to manually copy `enabledPlugins` + `extraKnownMarketplaces`.

# Why

User flagged that the previous monolithic `claude` component description ("Skip only if you've configured Claude Code by hand and don't want it overwritten") created a binary trap: skip claude and you lose ALL benefits including the tactical-polish skill that doesn't actually need to overwrite anything to work. Skills install into `~/.claude/skills/` and Claude Code reads them regardless of whose CLAUDE.md/settings.json is active - so they're naturally additive and shouldn't be coupled to the overwriting bundle.

For plugins: they're declared inside `settings.json`'s `enabledPlugins` block, so cleanly splitting them out requires JSON-merging into someone's existing settings file. Real feature, bigger lift, deferred. Documented the workaround (copy the JSON blocks manually) so the user isn't blocked.

# How to apply

- New machine: pick both `claude` and `skills` in the TUI for the full bundle.
- Machine with existing Claude Code: pick `skills` only. Get the UI-polish capability without overwriting your CLAUDE.md.
- Use `--only skills` to non-interactively install just the skill on someone's existing setup: `curl ... | bash -s -- --only skills`.

# Future work (deferred)

- JSON-merge `enabledPlugins` + `extraKnownMarketplaces` from our settings.json into a user's existing settings.json. Would let a `plugins` component install our plugin list additively. Requires either jq or python3, careful conflict handling (don't overwrite a user's manual `: false` toggles), and a shift from symlink to file-copy for settings.json (since merging breaks the symlink contract).
- A `claude-config` vs `claude-skills` vs `claude-memory` finer-grained split, if more granularity is requested.

# Files touched

- `install.sh` (component split, section renumber, preset update, summary update, descriptions)
- `README.md` (component table, "Boost an existing setup" subsection)
- `.claude/memory/session_2026-04-25_skills-component-split.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)
