---
name: AI company icons source from Lobehub first
description: When sourcing icons for AI companies, models, or products, use Lobehub - the company/brand/AI-logo tier of the icon cascade. Corrected sourcing paths (verified 2026-09-05).
type: feedback
relates_to: [decision_2026-09-05_icon-priority-cascade.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: github-tree + unpkg-cdn 200 checks
confidence: high
---

When sourcing an icon/logo for an AI company, model, or product (Claude, OpenAI, Gemini,
Mistral, Cohere, GitHub, Copilot, Cursor, and so on), use Lobehub. In the icon priority
cascade it is the dedicated **company / brand / AI-logo tier** (Lane D) - it is where logos
go, regardless of whether the logo is interactive or not. reicon has only a small brands
bundle and is a limited fallback, never the primary logo source.

**Repo:** `lobehub/lobe-icons` (default branch `master`), site `icons.lobehub.com`, MIT.
900+ AI/LLM/company brand logos, color + monochrome, dark/light variants.

**Verified sourcing (2026-09-05):**
- **React:** `npm i @lobehub/icons`, then
  `import { OpenAI, Anthropic, Claude, Gemini } from '@lobehub/icons';`
- **Static SVG (any stack):** package `@lobehub/icons-static-svg`, or the CDN
  `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<slug>.svg`
  (e.g. `openai.svg`, `anthropic.svg`, `claude-color.svg` - all return 200). Copy verbatim.
- **Verbatim GitHub source:** `packages/static-svg/icons/<slug>.svg` on `master`
  (903 SVGs). Also `packages/static-png/{dark,light}/`, `packages/static-webp/{dark,light}/`,
  `packages/static-avatar/avatars/`, and `@lobehub/icons-rn` for React Native.
- Mark the graphic `data-icon-source="lobehub"` for provenance.

**Correction to the prior note:** the old path `packages/static-png/public/dark/` is stale -
it is now `packages/static-png/dark/` (no `public/` segment). Prefer the static-SVG package /
CDN or `@lobehub/icons` React import over hand-copying PNGs.

This applies to any project, not just improv, and is enforced through the icon-source skill
cascade (verbatim only; a hook blocks off-cascade icon-library imports and marker-less
fabricated icons).
