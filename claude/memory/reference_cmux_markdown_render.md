---
name: cmux open <file.md> renders markdown natively
description: When asked to preview markdown in cmux, the right command is `cmux open <path-to-md>` - cmux has a built-in markdown renderer. Do NOT install grip/glow/markserv and serve via localhost.
type: reference
relates_to: [session_2026-05-20_readme-4-house-rewrite.md]
---

## The right command

```bash
cmux open /path/to/file.md
```

That's it. cmux has a built-in markdown renderer. Opens in a new pane, renders inline like a browser would. Confirmed via Lawrence Chen (cmux author) tweet: https://x.com/lawrencecchen/status/2057015472877650085

## The wrong path I took on 2026-05-20

Jonah asked to open the rewritten README in cmux. I assumed cmux only had a browser pane (which requires an HTTP-serving renderer) and installed `grip` via brew, started it on port 6419, then opened `http://localhost:6419/` via `cmux browser open`. This worked but was unnecessary work - cmux's native markdown view does the same job with zero installation and zero background processes.

Jonah corrected me by sharing the tweet. `cmux open README.md` rendered the README on surface:14 immediately. Killed the grip server afterward (`pkill -f "grip README.md"`).

## When to reach for what

| Want to see... | Use |
|---|---|
| A markdown file rendered | `cmux open <file>.md` |
| A localhost web app | `cmux browser open <url>` |
| A file with non-markdown rendering needs | `cmux browser open file://<path>` |

## Lesson

Check `cmux --help` for native handling of the file type before installing external renderers. cmux is broader than just "terminal + browser pane".

## Collaborator

Jonah
