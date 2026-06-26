---
name: fontshare-reference skill built
description: New Anthropic skill modeled on component-gallery-reference; researches fontshare.com before font picks and integrates with oracle's reflex-reject list
type: project
relates_to: [session_2026-05-19_fonts-reference-doc.md, session_2026-05-19_fonts-oracle-filter.md, session_2026-05-19_second-fix-gate-hook.md, reflection_2026-05-19.md]
---

## What shipped (2026-05-19)

Jonah wanted fontshare.com to be a reference resource for typography decisions the same way component.gallery is for UI components.

Built `claude/skills/fontshare-reference/SKILL.md` (~140 lines) following the component-gallery-reference structure:
- Frontmatter with keyword-rich `description` that auto-triggers on font-decision language (already confirmed live - the skill showed up in this session's skill list immediately after copy to `~/.claude/skills/fontshare-reference/`)
- "Layered synthesis" intro: Catalog (this) → Strategy (oracle's brand.md font procedure + typography.md anti-reflexes) → Project (DESIGN.md tokens)
- When-to-use list
- Why fontshare specifically (the user's pitch: catalog organization, designer-curated quality, anti-monoculture stance)
- Fontshare's organization (categories, personality tags, feature filters)
- 7-step workflow that explicitly bakes in oracle's reflex-reject list
- Fallback catalogs section for when fontshare doesn't fit (Google Fonts, Velvetyne, Pangram Pangram, Future Fonts, Klim, ABC Dinamo)
- Anti-pattern checklist before finalizing

## Critical integration point
The skill explicitly enforces oracle's reflex-reject list AND adds a warning about fontshare's own "Most popular" surface (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) creeping toward training-data-default status. Purpose: prevent the new fontshare-monoculture from replacing the old Google-Fonts-monoculture.

## Wiring done
- `claude/skills/fontshare-reference/SKILL.md` - canonical source
- `~/.claude/skills/fontshare-reference/SKILL.md` - active install (already auto-loaded into this session per the skills list)
- `install.sh` updated at 5 spots so future installs pick it up:
  - Line 10 (header comment)
  - Line 74 (picker description)
  - Line 92 (file list shown to user)
  - Line 743 (uninstall - new `rm -rf` line)
  - Lines 1559-1564 (new install block following component-gallery pattern)
- `claude/CLAUDE.md` design stack diagram - added `Typography: fontshare-reference (fontshare.com catalog, integrates with oracle's reflex-reject list)` line between Research and Tactical

## Drift note (NOT reconciled this pass)
- `claude/CLAUDE.md` (source) updated. `~/.claude/CLAUDE.md` (installed) is the concatenated result of source + RULES.md + memory-discipline-section.md per the installer logic. The design-stack change becomes live on next `install.sh` run. Per `plan_claude_md_split.md`, reconciliation is a separate scheduled task.

## Hook over-firing observation
The `second-fix-gate.sh` built earlier today fired 3 times during the 5 sequential install.sh edits in this task. All five edits were additive parts of ONE coherent change (wiring a new skill in 5 spots); none were "fix attempts on an unverified bug". The hook can't currently distinguish:
- Bad shape: edit-fix-on-same-file-same-area-while-needs-verification-still-set (the case it was built for)
- Good shape: edit-N-times-as-part-of-one-additive-change-to-the-same-file (what just happened)

Possible refinement (not done in this session): suppress the gate when the previous edit's file hash differs by additive-only insertion (no diff lines removed), or when no test/build has been requested in the same logical sequence. Tracked in [[session_2026-05-19_second-fix-gate-hook.md]] as a tuning target.

## Collaborator
Jonah
