---
name: AskUserQuestion tool - mandatory mechanical enforcement
description: FINAL FIX - All questions must use AskUserQuestion tool, never ask in plain text; tool requirement enforces multiple-choice by design
type: feedback
---

# Question-Asking Enforcement - Tool-Based Gate

## The Fix

Updated `claude/CLAUDE.md` with one simple rule:

**Always use AskUserQuestion. Never ask questions in plain text.**

## Why This Works

The tool itself IS the mechanical enforcement:
- AskUserQuestion requires you to provide options
- Options are mutually exclusive (by design of the tool)
- One option must be marked (Recommended)
- User can select or provide custom answer

Result: **Cannot ask open-ended questions because the tool doesn't allow it.**

## Implementation

Before calling AskUserQuestion:
1. Reframe question from open-ended to 2-3 concrete options
2. Mark one as (Recommended)
3. Read relevant memory to ground options
4. Call tool with multiSelect: false

If I ask a question in plain text instead of using the tool, it's immediately visible as a violation.

## Files Changed

- `claude/CLAUDE.md` - Replaced complex protocol with simple rule: "Always use AskUserQuestion"
- `.claude/memory/MEMORY.md` - Index updated

This is the mechanical enforcement the user wanted. Simple, native, failure-proof.
