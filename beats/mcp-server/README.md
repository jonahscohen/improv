# beats-mcp

A thin, read-only MCP server over the beats memory corpus (`.claude/memory/`).
It lets any MCP client - Claude Code, Codex CLI, Gemini CLI, or anything else
that speaks the Model Context Protocol - query the same beats that Claude Code
reads through the harness.

## What it is

The markdown beats in `.claude/memory/` are the source of truth for a project's
accumulated decisions, sessions, and references. `beats.py` compiles them into a
searchable index. This server wraps that index (and the corpus files) behind
four MCP tools so a non-Claude agent can search and read the same record.

## Read-only contract

This server never writes. It only reads:

- `beats.py` is invoked with `search` and `verify` - both read-only.
- Beats are read straight off disk from the corpus dir.
- There is no create/update/delete tool, by design.

Beats are authored as markdown through the Claude Code harness, and that stays
the only way in. A retrieval surface for other agents does not change the write
path: writes stay markdown-through-harness.

## Tools

| Tool | Args | Returns |
|---|---|---|
| `beats_search` | `query: string`, `top?: number` (default 5) | Ranked, supersession-resolved JSON array of beats (filename, name, description, score). Surfaces the index STALE warning as a `note`. |
| `beats_get` | `file: string` (bare `.md` filename) | The beat's full markdown plus its parsed frontmatter. Rejects any path that escapes the corpus dir. |
| `beats_related` | `file: string` (bare `.md` filename) | The beats linked via `relates_to` / `supersedes` / `superseded_by`, each with its name and description. Missing targets are noted, not errored. |
| `beats_status` | (none) | Index health from `beats.py verify`: `healthy`, `stale`, or `broken`, plus the corpus file count. |

## Corpus resolution

By default the corpus dir is resolved relative to the server's own location:
`beats/mcp-server/dist/server.js` -> repo root -> `<repo-root>/.claude/memory`.

Environment overrides:

- `BEATS_CORPUS` - the markdown corpus dir (absolute, or relative to the process
  working directory). Default `<repo-root>/.claude/memory`.
- `BEATS_BUILD` - the compiled-index dir that `search` and `verify` read.
  Default `<repo-root>/beats/.build`. If you point `BEATS_CORPUS` at a different
  corpus, set `BEATS_BUILD` to that corpus's own build dir and compile it there
  (`python3 beats/beats.py compile --corpus <dir> --build <build>`); otherwise
  `beats_get` reads the new corpus while `beats_search` still returns the default
  corpus's compiled results.
- `BEATS_PYTHON` - the python interpreter used to run `beats.py` (default
  `python3`).

## Build

```bash
cd beats/mcp-server
npm install
npm run build      # tsc -> dist/server.js
```

Requires Node >= 18 and a `python3` that can run `beats/beats.py`. If the
compiled beats index is missing or stale, run `python3 beats/beats.py compile`
from the repo root first (`beats_status` will report `stale`/`broken` until you
do).

## Registration

All three clients launch the server the same way: `node <absolute path to
dist/server.js>`. Use an absolute path - MCP clients do not resolve relative
paths against the repo. On this machine the absolute path is:

```
/absolute/path/to/improv/beats/mcp-server/dist/server.js
```

Replace `/absolute/path/to/improv` with your checkout's absolute path
(`git rev-parse --show-toplevel` prints it).

### (a) Claude Code

Add to your Claude Code MCP settings (project `.mcp.json`, or the `mcpServers`
block of `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "beats": {
      "command": "node",
      "args": ["/absolute/path/to/improv/beats/mcp-server/dist/server.js"]
    }
  }
}
```

To point it at a different corpus, add an `env` block (pair the corpus with its
own compiled build dir - see Corpus resolution):

```json
{
  "mcpServers": {
    "beats": {
      "command": "node",
      "args": ["/absolute/path/to/improv/beats/mcp-server/dist/server.js"],
      "env": {
        "BEATS_CORPUS": "/absolute/path/to/other/.claude/memory",
        "BEATS_BUILD": "/absolute/path/to/other/beats/.build"
      }
    }
  }
}
```

### (b) Codex CLI

Codex reads TOML from `~/.codex/config.toml`. Add an `mcp_servers` table:

```toml
[mcp_servers.beats]
command = "node"
args = ["/absolute/path/to/improv/beats/mcp-server/dist/server.js"]

# optional: point at a different corpus (with its own compiled build dir)
[mcp_servers.beats.env]
BEATS_CORPUS = "/absolute/path/to/other/.claude/memory"
BEATS_BUILD = "/absolute/path/to/other/beats/.build"
```

### (c) Gemini CLI

Gemini CLI reads JSON from `~/.gemini/settings.json` (or a project
`.gemini/settings.json`). Add an `mcpServers` block:

```json
{
  "mcpServers": {
    "beats": {
      "command": "node",
      "args": ["/absolute/path/to/improv/beats/mcp-server/dist/server.js"],
      "env": {
        "BEATS_CORPUS": "/absolute/path/to/other/.claude/memory",
        "BEATS_BUILD": "/absolute/path/to/other/beats/.build"
      }
    }
  }
}
```

The `env` block is optional in every client; omit it to use the default corpus
resolved from the server's own location.

## Smoke test

`smoke.mjs` drives a full stdio JSON-RPC session (initialize, tools/list, one
real call of each tool, plus a path-traversal rejection) against the built
server and exits non-zero if any check fails:

```bash
npm run build
node smoke.mjs
```
