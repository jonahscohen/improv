# PRODUCT.md - claude-dotfiles reference manual (the docs site)

## Register

**Product-side.** This is the reference documentation for an opinionated open-source dev tool. The user has already chosen to look at the tool; this site teaches them everything. Calm, precise, editorial. Less "selling" tone than the marketing site - more "annotated engineering manual."

## Who this is for

**Primary audience:** Developers who have pulled the trigger on installing the dotfiles and want depth. They need to know how every component works, how every hook fires, how the design pipeline routes, how memory persists, how to customize.

**Secondary audience:** Engineering leads doing a thorough evaluation - they may not install yet but they want to understand the full system before recommending it to a team.

**Tertiary audience:** Yes& devs themselves - this site is the canonical reference when they're extending the dotfiles or onboarding a teammate.

## Brand personality

Same brand voice as the marketing site, different register. Three physical-object words: **annotated engineering manual**, **midnight workshop reference**, **considered technical writing**.

Precise, complete, calm. The voice of someone walking you through their workshop and explaining every tool. Mature, not loud. Editorial in typography but technical in content density. The reader trusts that everything documented here is real, current, and load-bearing.

NOT: sparse Linear-aesthetic-minimal, Vercel-docs pixel-dense, AI-product hype, "10x your productivity," abstract 3D Stripe-aesthetic, Notion-default-clean.

## Anti-references

Avoid the saturated documentation lanes:

- **Stripe Docs / Vercel Docs / Linear Docs** - all variations on "minimal monochrome + accent color + monospace code blocks." Excellent docs sites but their look has been adopted by every dev tool to the point of monoculture. Don't visit those sites first; visit them last to be sure we're not converging.
- **GitBook-default** - sidebar tree + sterile typography + zero opinion. We have opinions; the site should reflect them.
- **Read the Docs / Sphinx** - feels archived. Functional but unloved.
- **Notion-published-as-docs** - the bland "I generated this from a Notion page" look. We're not generated; we're written.
- **Tailwind Docs** - dense and excellent but explicitly Tailwind-branded. We aren't Tailwind-branded.

## Strategic principles

1. **Depth over surface.** Every component, hook, skill, and decision gets its own section with rationale. If a reader has a question about "why does this work this way," the answer lives here.
2. **Editorial typography, technical content.** Source Serif 4 headings + Hanken Grotesk body + JetBrains Mono code. Generous reading column (62-70ch). Whitespace that lets the prose breathe.
3. **One canonical source.** This site replaces "scroll through README + grep through memory + remember the CLAUDE.md sections." Nothing important should be hard to find here.
4. **Searchable by structure, not text search.** Strong sidebar nav + on-page anchors. A reader scanning the sidebar should be able to predict where each topic lives. Text search is a later concern.
5. **The brand mark earns its place** (same rule as the marketing site). The red Yes& ampersand appears in the header. Not on every section. Not as decoration. Used deliberately.

## Brand visual references

Same as the marketing site:
- Yes& wordmark + ampersand as anchors
- Cream `#F4EFE4` canvas, off-black `#1A1F1B` ink, red `#DC2618` accent
- Source Serif 4 (display) + Hanken Grotesk (body) + JetBrains Mono (code)
- All off the fontshare-reference reflex-reject list

What's different from marketing:
- Document-density layout (sidebar + content + right TOC rail), not hero-led marketing layout
- Lower visual flourish budget (no italic hero accent line, no big inverted CTA section)
- Higher information density per screen (we're documenting, not selling)
- More code blocks; code is content here, not garnish
