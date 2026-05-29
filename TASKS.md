# Dotfiles tasks

<!-- Managed by /task-list skill. Hand-edits welcome; preserve the structure. -->
<!-- Last ID: T-0037 -->
<!-- Completed tasks are removed once done; full detail lives in .claude/memory/ beats + git history. -->

## dotfiles
### Active
- [ ] T-0001 [P2] 2026-05-25 research QuiverAI implementation methods

## sidecoach
### Active
- [ ] T-0037 [P3] 2026-05-28 (skill-recon Tier 3) shadcn/ui opt-in cookbook reference. NEW reference doc under `sidecoach/reference/_extracted/external/shadcn-ui/` (match the existing _extracted/external convention - frontmatter source URL + type + MIT attribution, like vercel forms-guidelines.md). Cookbook content from giuseppe-trisciuoglio/developer-kit shadcn-ui skill: cn() = clsx+tailwind-merge, cva variant systems, Radix asChild/Slot, React-Hook-Form + Zod resolver wiring, CSS-variable theming (HSL-channel --primary consumed via hsl(var(--primary))), next-themes dark mode, components.json registry + npx shadcn add CLI (+ registry-security note), ChartContainer/Recharts theming. Framed as OPT-IN: only consult when a project uses shadcn (components.json present / Tailwind+Radix detected) - sidecoach stays library-agnostic by default. SKIP the ~3300 lines of scraped official-doc install snippets (low value). License: MIT (c) Giuseppe Trisciuoglio - attribute. (Tier 3 mobile/HIG reference DEFERRED - web-only.) Run as a dynamic workflow (draft -> adversarial verify) per the wedge-resilience decision. Origin: skill-recon synthesis 2026-05-28.
- [ ] T-0007 [P2] 2026-05-28 Codex + Gemini CLI orchestration for sidecoach (large, scope-heavy). OMC's distinctive capability surfaced in the 2026-05-28 research is `omc team N:codex/gemini/claude` spawning real worker panes for different CLIs side-by-side via cmux's tmux-shim. Sidecoach currently spawns only Claude teammates. Adding Codex + Gemini means FULLY accommodating them, not a half-measure: (a) detect which CLI is available on PATH, (b) install/auth flow per CLI (codex login, gemini API key), (c) prompt-format adapter per CLI (each one has its own quirks - tool-use formats, system-prompt conventions, context limits), (d) output parser per CLI (the cmux pane integration sees stdout - need to parse each CLI's progress/completion signals), (e) capability map (which sidecoach flows can run on which CLI - design-domain flows likely Claude-only, generic refactor/research flows could fan out), (f) model-tier routing per CLI (each provider has its own Haiku/Sonnet/Opus analog), (g) cost-tracking per CLI, (h) graceful degradation when a CLI is missing. Start with a design memo before any code - the wrong abstraction here would lock sidecoach into a one-provider-only ceiling. Origin: omc-research team findings 2026-05-28.
