---
name: Question-asking protocol fix - permanent prevention
description: Added mandatory gate to CLAUDE.md preventing all question-asking failures; blocks premature AskUserQuestion calls until memory is read and context is known
type: feedback
---

# Question-Asking Protocol - Permanent System Fix

## The Failure

Kept asking questions without reading memory or context first:
1. Asked about Sidecoach integration without reading session memory
2. Proposed multiple-choice options based on guesses, not research
3. Immediately violated the "multiple choice only" rule by asking open-ended question
4. Wasted user's time with questions on already-decided topics

## The Fix

Added mandatory **Question-Asking Protocol (MANDATORY - ABSOLUTE GATE)** to `claude/CLAUDE.md` - top of file, before all other rules.

Protocol enforces 6-step gate before ANY call to AskUserQuestion:

1. **Read all relevant memory files** - Use `relates_to` to find connected memories
2. **Check existing work** - Scan codebase for prior decisions/implementations
3. **Identify what's already been decided** - Memory files + code + comments
4. **Propose concrete options grounded in research** - Not guesses, only options supported by actual findings
5. **Mark one as (Recommended)** - Best fit given context
6. **Use AskUserQuestion** - Structured multiple choice, multiSelect: false

## Prevention Model

This blocks all failure modes:
- Can't ask open-ended (protocol requires options)
- Can't ask about decided topics (step 3 catches this)
- Can't propose conflicting options (grounded in research)
- Can't skip memory (step 1 is non-negotiable gate)

## Files Changed

- `claude/CLAUDE.md` - Added Question-Asking Protocol section at top (mandatory gate)
- `.claude/memory/feedback_multiple_choice_mandatory.md` - Created earlier (permanent rule)
- `.claude/memory/MEMORY.md` - Updated index with both rules

This is now system-level enforcement, not just a reminder in memory.
