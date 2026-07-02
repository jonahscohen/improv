---
name: visualizer token contract
description: The ONLY valid CSS variable tokens for mcp__visualize__show_widget, the dark-mode contract, and the authoring rules. Use these verbatim - do not guess numbered tokens or add hardcoded color fallbacks. Enforced by the visualizer-guard.sh PreToolUse hook.
type: reference
relates_to: [reference_claude_code_surface_detection.md]
---

Collaborator: Jonah Cohen. Written 2026-06-30 after a widget shipped with guessed token names + hardcoded fallbacks that produced invisible text in dark mode (an a11y failure). The hook `visualizer-guard.sh` now mechanically blocks the failure modes below; this beat is the positive reference so you author correctly the first time.

## The canonical tokens (use verbatim, NO numbered scale)

The visualizer does NOT have a Tailwind-style numbered scale. There is no `--text-100`, `--bg-200`, `--border-300`, `--accent-main-100`. Those silently fail to resolve. Real tokens are word-suffixed:

- **Text:** `--text-primary` (high contrast; headings auto-set, don't override), `--text-secondary` (muted - labels/subtitles), `--text-muted` (hints). Role: `--text-accent`, `--text-danger`, `--text-success`, `--text-warning`.
- **Surfaces:** `--surface-2` (raised card), `--surface-1` (subtle panel/metric card), `--surface-0` (page bg). These are the ONLY valid numbered tokens (0/1/2 only). Role tints: `--bg-accent`, `--bg-danger`, `--bg-success`, `--bg-warning`.
- **Borders:** `--border` (default hairline, 0.5px), `--border-strong` (hover/emphasis), `--border-stronger`. Role: `--border-accent`, `--border-danger`, `--border-success`, `--border-warning`.
- **Typography:** `--font-sans`, `--font-voice` (serif, editorial only), `--font-mono`.
- **Layout:** `--radius` (8px, controls only - cards use literal 12px, larger use 16px), `--pad-{sm,md,lg,xl}`, `--gap-{xs,sm,md,lg,xl}`.
- **SVG aliases:** `var(--p)`, `var(--s)`, `var(--t)`, `var(--bg2)`, `var(--b)`.

## The dark-mode contract (this is what the a11y bug violated)

- **All `--*` tokens auto-adapt to light/dark. Use them with NO fallback.** A hardcoded fallback - `var(--text-200, #333)` - defeats the adaptation: if the token is wrong/missing the light-mode hex wins and goes invisible on a dark surface. NEVER put a hex/rgb/hsl fallback in `var()`. (A var-as-fallback, `var(--a, var(--b))`, is fine.)
- **Tinted panels MUST pair bg + text from the same role:** `background: var(--bg-danger); color: var(--text-danger);`. Same for accent/success/warning. The pair is colour-matched in both modes.
- **Canvas/Chart.js can't resolve CSS variables** - use hex there, or read a token once via `getComputedStyle(document.documentElement).getPropertyValue('--text-muted')`. This is the one place bare hex is correct.

## Authoring rules (hook-enforced or spec)

- **No CDATA wrapper** around widget_code - the tool doesn't strip it and `]]>` leaks into the render. Pass raw SVG/HTML.
- **font-weight: only 400 and 500.** Headings pre-styled to 500, body 400. No 600/700/bold.
- Headings (h1=22, h2=18, h3=16, all weight 500) and form elements (`<input>`, `<button>`, `<select>`) are pre-styled - write them bare, don't override unless changing geometry.
- Borders are `0.5px solid var(--border)`, not 1px (`--border-strong` for emphasis; featured/accent card border `2px solid var(--border-accent)` is the only 2px exception).
- Outer container background transparent only - the host provides the bg. No dark/colored bg on the outer wrapper.
- No `position: fixed` (iframe collapses). No gradients/shadows/blur/glow (flash during streaming; one `<linearGradient>` allowed for illustrative diagrams only). No HTML/CSS comments (break streaming). Sentence case everywhere. Round every displayed number. Tabler outline icons only (`<i class="ti ti-name">`, never `-filled`).
- CDN allowlist (CSP): only cdnjs.cloudflare.com, esm.sh, cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com, fonts.gstatic.com.

## What the hook blocks (visualizer-guard.sh, PreToolUse on mcp__visualize__show_widget)

1. CDATA wrappers (`<![CDATA[` / `]]>`)
2. Hardcoded color fallbacks in `var()` (`var(--x, #hex|rgb|hsl)`) - the a11y bug
3. Hallucinated numbered tokens (`--text-100`, `--bg-200`, `--*-N`, `--surface-3+`, `--accent-main-*`)
4. font-weight 600/700/800/900/bold

Regression coverage: `claude/hooks/_tests/test-visualizer-guard.sh` (21 cases). Registered in BOTH `claude/settings.json` (repo source) and `~/.claude/settings.json` (live) - settings.json is NOT symlinked, so both must be kept in sync; a hook-registration change needs a session restart to take effect.

## Files
- claude/hooks/visualizer-guard.sh (the gate)
- claude/hooks/_tests/test-visualizer-guard.sh (regression suite)
