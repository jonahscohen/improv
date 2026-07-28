---
name: voice-output
description: Behavioral guidance for Claude's voice output. When voice is enabled, speak only short verbal summaries (1-2 sentences). Never speak code, file paths, diffs, or structured output. Use judgment about when voice adds value. This skill has no keyword invocation list - it provides standing behavioral rules that apply whenever the voice-output MCP server is available.
---

# Voice Output

When the voice-output MCP server is connected and voice is enabled (unmuted), you can speak short verbal summaries aloud.

## Verbosity Levels

The user sets their preferred verbosity in `~/.claude/.voice-config` via `"verbosity"`. The speak tool returns the active level in its response. Adapt your spoken output accordingly:

| Level | Config value | Guidance |
|---|---|---|
| Short | `"short"` (default) | 1-2 sentences max. Status updates, confirmations, brief answers. No elaboration. |
| Normal | `"normal"` | 3-4 sentences. Include a brief "why" or context beyond the bare fact. Explain what you did and one relevant detail. |
| Verbose | `"verbose"` | Full spoken paragraph. Explain what changed, why, what you considered, and what comes next. Still conversational - no code or structured data. |

Examples at each level for the same event (tests passing after a fix):

- **Short**: "All tests passing now."
- **Normal**: "All 47 tests are passing. The issue was a stale import in the auth module that was referencing the old middleware."
- **Verbose**: "All 47 tests are passing now. The root cause was a stale import in the auth module - it was still pulling from the old middleware path we removed in the refactor. I updated the import to point at the new location and verified that both the unit and integration suites clear. The auth flow is solid, so we can move on to the API layer next."

## What to Speak (all levels)

- Status updates and confirmations
- Brief answers to direct questions
- Warnings before destructive actions

## What NOT to Speak (all levels)

- Code (any code, ever)
- File paths or directory listings
- Diffs or git output
- Structured data (JSON, tables, lists)
- Content the user is clearly reading on screen

## When NOT to Speak

- When the user is reviewing diffs or reading code
- When you are in the middle of a multi-step operation (speak at the end, not every step)
- When the context suggests a quiet environment (the user said "mute" recently, or mentioned a meeting)
- When the response is purely visual (a table, a diagram, formatted output)

## Mute Controls

Three interfaces, all toggle the same file (`~/.claude/.voice-enabled`):

1. **In-session**: call `mute()` or `unmute()` tools
2. **Terminal**: `voice-on` / `voice-off` aliases
3. **Manual**: `touch ~/.claude/.voice-enabled` / `rm ~/.claude/.voice-enabled`

Starts muted (file absent). Respect the mute state - do not call speak() when muted.

## Voice Configuration

Users set preferences in `~/.claude/.voice-config`:
```json
{"voice": "onyx", "verbosity": "short", "speed": 1.25}
```

**Voices** (13): alloy, ash, ballad, cedar, coral, echo, fable, marin, nova, onyx, sage, shimmer, verse.

**Verbosity**: `"short"` (default), `"normal"`, or `"verbose"`. See Verbosity Levels above.

**Speed**: `0.25` to `4.0`, default `1.0`. Values above 1.0 speed up playback, below 1.0 slow it down.
