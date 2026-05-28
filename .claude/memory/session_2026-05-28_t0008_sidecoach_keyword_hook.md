---
name: T-0008 sidecoach keyword UserPromptSubmit hook (Jonah)
description: UserPromptSubmit hook intercepts prompts, regex-matches 22 sidecoach verbs on sanitized body, injects additionalContext routing to the matched flow
type: project
relates_to: [session_2026-05-22_multiple_choice_hook.md, feedback_hooks_evolve_over_time.md]
---

T-0008 delivered. Hook intercepts user prompts BEFORE Claude sees them, regex-matches sidecoach verbs against a sanitized prompt body, and on hit injects an additionalContext block routing to the matched flow. This bypasses the skill auto-trigger layer (2026-05-20 finding: unreliable in real builds) and forces verb-intent detection at the shell hook layer.

**Why:** Skill auto-triggers depend on Claude's own decision to load a skill. When the model under-fires or rationalizes around the trigger, the QA gate never runs. The hook layer is mechanical - if the regex matches and the prompt is not informational, the routing fires regardless of model behavior.

**How:**
- `claude/hooks/sidecoach-verbs.json` - canonical 22-verb registry (verb, pattern, phase, description, oneLineExplanation). T-0010 will consume this for the cheatsheet so verbs only live in one place.
- `claude/hooks/sidecoach-keyword.sh` - bash entry that pipes stdin into an inline python3 block. Steps: parse JSON payload, extract prompt from `.prompt` or `.tool_input.user_message`, sanitize (strip fenced code blocks, inline backticks, URLs, XML tag bodies, transcript markers like `[MAGIC KEYWORD:]` and `[TURN N:]`), check informational suppression (what is/how to use/how do I/tell me about/X is a/explain/define), regex match each verb with hyphen-aware boundaries `(?<![\w-])PATTERN(?![\w-])`, tie-break to first verb in registry order on multi-match, emit `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"User intends to invoke the sidecoach <verb>NAME</verb> flow. Route accordingly."}}`.
- `claude/hooks/test-sidecoach-keyword.sh` - 74 assertions: 22 verb fires + 4 fenced + 4 inline-tick + 4 URL + 3 XML + 3 transcript markers + 11 informational framings + 13 word-boundary substring rejections (polished/audit-trail/extraction/live-blog/alive/delivery/documentation/etc) + 3 multi-verb tie-breaks + 3 zero-match passthroughs + 4 mixed-sanitization realistic prompts. All green.
- `claude/settings.json` - wired under `hooks.UserPromptSubmit` after `multiple-choice-inject-prompt.sh`. Symlinks added to `~/.claude/hooks/` (the dotfiles use symlinks, not copies - new files need explicit `ln -sf`).

**Key design calls:**
- Word-boundary uses `(?<![\w-])` / `(?![\w-])` instead of `\b`. Plain `\b` would let "audit-trail" match. Hyphen-aware boundary correctly rejects both `polished` (word-char after) and `audit-trail` (hyphen after).
- Informational suppression is per-verb (frame must contain the verb), not a global pre-filter. A prompt that mixes "what is polish? also audit this page" still fires audit - the informational frame only kills the polish match.
- Sanitization order: fenced code blocks BEFORE inline backticks (they overlap), URLs before XML (URLs can contain `<` in queries), transcript markers last.
- Tie-break is registry order (audit at index 12 beats polish at index 13; shape at 0 beats everything). This is predictable - the cheatsheet T-0010 generates can document the order.

**Sample firing output:**
```
{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "User intends to invoke the sidecoach <verb>audit</verb> flow. Route accordingly."}}
```

**Files touched:**
- claude/hooks/sidecoach-verbs.json (new)
- claude/hooks/sidecoach-keyword.sh (new, chmod +x)
- claude/hooks/test-sidecoach-keyword.sh (new, chmod +x)
- claude/settings.json (UserPromptSubmit array)
- ~/.claude/hooks/{sidecoach-keyword.sh, sidecoach-verbs.json, test-sidecoach-keyword.sh} (symlinks)
- TASKS.md (T-0008 marked done)
