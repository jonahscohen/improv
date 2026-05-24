---
name: test_site_1_sidecoach_pages
description: Building marketing and documentation pages for Sidecoach in new test-site-1 directory
type: project
relates_to: [session_2026-05-23_sidecoach_audit_report.md]
supersedes: []
superseded_by: []
---

# test-site-1: Sidecoach Marketing + Documentation Pages

**Location:** /Users/spare3/Documents/Github/claude-dotfiles/test-site-1/  
**Status:** IN PROGRESS  
**Scope:** 
1. Marketing page (index.html) - targets external developers, Claude Code users, designers
2. Documentation page (documentation.html) - targets both internal team and public community
3. Shared design system based on Yes& reference site
4. Interlinked navigation

**Design System:**
- Colors: brand-red (#DC2618), brand-ink (#1A1F1B), brand-cream (#F4EFE4), brand-paper (#FAF7EE)
- Typography: Source Serif 4 (display), Hanken Grotesk (body), JetBrains Mono (code)
- Layout: Two-column responsive (sidebar nav + main content, collapses on mobile)
- No anti-patterns: proper accessibility, semantic HTML, CSS variables, responsive design

**Structure:**
- test-site-1/
  - index.html (marketing page)
  - documentation.html (docs page)
  - styles.css (shared design system)

**Progress:**
- [x] Create test-site-1 directory
- [ ] Build marketing page (index.html)
- [ ] Build documentation page (documentation.html)
- [x] Create shared styles.css - complete with design system, responsive layout, accessibility
- [ ] Test interlinks
- [ ] Verify responsive design
- [ ] Verify accessibility

**Styles Created (styles.css):**
- Color system with brand palette and semantic aliases
- Typography system (Source Serif 4, Hanken Grotesk, JetBrains Mono)
- Layout framework (sticky topbar, responsive sidebar, main content area)
- Components: buttons, cards, feature grids, flow lists
- Responsive breakpoints (768px, 480px)
- Accessibility features (skip link, focus states, semantic HTML)
