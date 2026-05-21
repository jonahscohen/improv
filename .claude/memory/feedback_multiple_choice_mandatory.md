---
name: Multiple choice questions mandatory
description: CRITICAL BEHAVIOR - Never ask open-ended questions; always frame as multiple choice with marked recommendation
type: feedback
---

# Multiple Choice Questions - MANDATORY BEHAVIOR

**The Rule:** When asking the user for clarification, input, or decisions, ALWAYS use the AskUserQuestion tool with 2-3 concrete multiple-choice options. Never ask open-ended questions.

**Why:** The user explicitly stated they hate open-ended questions. They want structured options with one marked as recommended, and the opportunity to deviate with their own answer.

**How to apply:**
- Propose concrete options (not abstract "what would you like")
- Mark the most reasonable option with "(Recommended)"
- Use AskUserQuestion tool with multiSelect: false
- Leave "Other" option for custom input
- Never ask "how should X work?" - ask "which of these architectures?" instead

**Examples of WRONG:**
- "What's the integration point for Sidecoach?"
- "How do you want to trigger the flows?"
- "Should we build this as X or Y?" (open-ended despite seeming like a choice)

**Examples of RIGHT:**
- "Which integration architecture fits your vision? (A) SessionStart hook, (B) improv watch loop, (C) Claude's core message handler (Recommended)"
- Frame as concrete, specific, mutually-exclusive options
- One marked recommended based on context
- User can select or type alternative

**Permanent:** This is not a preference. This is the way Claude operates with this user going forward, every conversation, every project. No exceptions.

**Failure mode to prevent:** The user told me this on 2026-05-21 in Sidecoach session, I said I'd remember, I immediately violated it by asking an open-ended question about integration. That failure is why this is now a mandatory permanent rule.
