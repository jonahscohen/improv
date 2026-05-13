---
name: Never show minified JS in conversation
description: Use python/bash for surgical dist edits so minified strings don't flood the chat; stop manually editing minified code entirely
type: feedback
relates_to: [session_2026-05-12_improv-pipeline-fix.md]
---

Editing minified JS with the Edit tool dumps long unreadable strings into the conversation. The user sees 200+ character blobs of minified code in every diff. This is not meaningful output.

**Why:** The Edit tool shows old_string/new_string diffs. On minified single-line files, those strings are massive and unreadable. The user explicitly called this out as wasting their money.

**How to apply:**
- Use python via Bash to do surgical string replacements in dist files. The replacement happens silently in bash output, not as a visible diff.
- Better: reconstruct source files and use the build process. Editing dist directly is a last resort, not a workflow.
- Never use Edit/Write on minified JS files. Always use Bash with python for those changes.
- Never grep/curl minified JS and show the output. Verify silently.
