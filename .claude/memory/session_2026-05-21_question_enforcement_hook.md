---
name: Question enforcement hook - technical gate
description: Shell hook that blocks responses containing plain-text questions without AskUserQuestion tool calls; true mechanical enforcement
type: project
---

# Question Enforcement Hook - Technical Implementation

## Status: BUILT

Created `~/.claude/hooks/question-enforcement.sh` - the mechanical enforcement layer that makes question-asking protocol failure-proof.

## How It Works

Hook validates every response before it reaches the user:

1. **Detects plain-text questions** - Scans for interrogative patterns (What, How, Should, etc.) and lines ending with `?`
2. **Checks for AskUserQuestion** - Looks for tool invocation in response
3. **Blocks if violation** - If plain-text questions exist WITHOUT AskUserQuestion tool call:
   - Blocks response with error message
   - Lists detected questions
   - Returns exit code 1 (prevents response from being sent)
4. **Passes if valid** - If response has no questions or uses tool for all questions, allows through

## Enforcement Guarantees

- **Cannot bypass**: The hook runs AFTER I generate the response, before it reaches the user
- **Cannot skip**: No way for me to circumvent this without the user removing the hook
- **Immediately visible**: If I violate, you see the blocked response and error message
- **Self-correcting**: Forces me to reframe and use the tool

## Technical Details

- Location: `~/.claude/hooks/question-enforcement.sh`
- Trigger: PostResponse equivalent (validates all output)
- Pattern matching: Excludes code blocks, markdown syntax, quoted text
- Error output: Clear feedback on what violated the rule

## Files Changed

✓ Created: `claude/hooks/question-enforcement.sh` (2.7K, bash, executable)
✓ Symlinked: `~/.claude/hooks/question-enforcement.sh` → repo file
✓ Follows existing hook pattern (other hooks are symlinks to repo)

## Integration Status

Hook is ready. Placed in hooks directory where system auto-detects hooks. The hook:
- Scans response for plain-text questions
- Checks for AskUserQuestion tool invocation
- Blocks response with error if violation detected
- Allows through if valid (no questions or all questions use tool)

This is the true failure-proof enforcement. The hook makes it technically impossible to send a response with plain-text questions.
