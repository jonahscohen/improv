---
name: Wired make-interfaces-feel-better skill into install.sh and CLAUDE.md
description: Added the make-interfaces-feel-better Anthropic Skill as a step in install.sh's claude component (npx skills add) and as a tactical implementation layer + new QA-gate items in CLAUDE.md. Three-layer design stack now wired end-to-end: Oracle (strategy) -> design.md (tokens) -> make-interfaces-feel-better (tactics).
type: project
---

Collaborator: Jonah Cohen

# What changed

## install.sh

Final sub-step inside the `claude` component (only runs if the user picks `claude`):

```bash
if command -v npx >/dev/null 2>&1; then
  if npx --yes skills add jakubkrehel/make-interfaces-feel-better 2>/dev/null; then
    ok "make-interfaces-feel-better skill installed"
  else
    warn "Skill install failed (non-fatal). Run manually..."
  fi
else
  warn "npx not found - skipping skill install."
fi
```

Non-fatal on failure (network, missing npx, etc.) - prints actionable manual fallback. Post-install summary lists the skill as part of the claude install. The `claude` component description in the TUI now mentions the skill so users see it before ticking the box.

## claude/CLAUDE.md

Two additions under "Design Work and Oracle":

1. New `### Tactical implementation layer (make-interfaces-feel-better)` section. Documents the 16 specific rules with their exact values (scale 0.96, blur 4px->0, image outlines rgba(0,0,0,0.1) never tinted, hit area 40x40, transition: all banned, etc.), explains the skill auto-triggers on UI keywords, and tells Claude to manually invoke if it didn't auto-trigger. Also makes the skill's before/after table format the canonical UI-change summary format.
2. QA gate expanded from 3 items to 5: existing audit + critique + polish, plus the 14-point feel-better checklist, plus design.md lint when DESIGN.md exists. All five must run on substantive UI changes; trivial edits can skip.

## README.md

Updated the "First-run walkthrough" step 5 to list all five QA-gate items, and added a paragraph explaining that the skill is auto-installed as the tactical layer between Oracle and DESIGN.md.

# Why

Comparing the three resources head-to-head:

| Layer | Owner | Answers |
|---|---|---|
| Strategy / brand / register | Oracle (PRODUCT.md + 23 commands) | "Who is this for, what's the personality?" |
| Token values | design.md (YAML + lint) | "What's primary, body-md, spacing.md?" |
| Tactical CSS/motion | make-interfaces-feel-better (16 rules) | "When you write the button, scale to exactly 0.96" |

They cover three different layers with almost no overlap. Oracle's `polish` gestures at "align to design system" but doesn't have hard rules for things like image outline color or icon-swap blur values. design.md has values but not tactics. make-interfaces-feel-better fills the gap between "what tokens" and "what the user feels."

Worth integrating because:
- The 16 rules are specific enough to enforce mechanically (exact values, not vibes)
- Auto-triggers on UI keywords - no manual dispatch needed in 90% of cases
- Has a checklist (testable) and a review-output-format (consistent summaries)
- The Krehel article it's based on is well-respected in design-engineering circles

# How to apply

Live globally on every Claude Code session on this machine after `install.sh` runs with the claude component picked. Other machines pick up the skill install + CLAUDE.md rule via `yesplease` (or `git pull` + re-run install.sh).

The skill's `description` field auto-triggers on keywords (border radius, animation, optical alignment, hover state, tabular numbers, "feel better", etc.). For UI work that doesn't hit those keywords, CLAUDE.md mandates manual invocation of `/make-interfaces-feel-better` before reporting done.

# Files touched

- `install.sh` (skill install sub-step in claude section, summary line, component description)
- `claude/CLAUDE.md` (new tactical-implementation-layer section + QA gate expanded to 5 items)
- `README.md` (first-run walkthrough step 5 + tactical-layer paragraph)
- `.claude/memory/session_2026-04-25_feel-better-skill.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)
