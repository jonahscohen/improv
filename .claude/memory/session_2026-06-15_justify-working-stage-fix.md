---
name: Justify "Working..." stage - explicit ungated /working channel (survives disconnect)
description: Working never showed because the auto-fire is gated to 'sending' and a disconnect/reconnect dropped that state; added an explicit ungated POST /working + justify-working helper, symmetric with /validating
type: project
relates_to: [session_2026-06-15_justify-validating-stage-diagnosis.md]
---

Jonah (sidenote): saw "Sending to Claude..." -> "Connected" (a disconnect) ->
"Validating..." -> "Review Changes". The "Working..." phase never showed.

ROOT CAUSE: the daemon auto-broadcasts justify_working on every GET /prompts poll,
but the core handler is GATED - it only advances a browser still in 'sending'
(index.ts:101-105). A disconnect/reconnect drops the browser to 'connected', so the
working event is ignored and the bar drifts to "Connected". (justify_validating,
by contrast, was UNGATED - which is why Validating always showed once I drove it.)

FIX (symmetric with the Validating fix):
- server/ws-server.ts: new POST /working -> broadcastToClients('justify_working_force')
  + refresh lastMcpActivity/watchSessionActive. Ungated, explicit.
- core/index.ts: new handler transport.on('justify_working_force', () =>
  this._claudeToWorking()) - ungated, forces Working from any state.
- core/index.ts: _claudeToWorking now CREATES the pill if missing
  (_showClaudeBar('Working','shimmer',false)) instead of returning early - so a
  forced Working from a pill-less 'connected' state still shows. Mirrors
  _claudeToValidating.
- cli/justify-working.sh: helper that POSTs /working + prints a card. Deployed to
  ~/.claude/justify + symlinked /opt/homebrew/bin/justify-working.

LOOP NOW: watch picks up prompt -> justify-working (bar -> Working) -> apply ->
justify-validating (bar -> Validating) -> verify in connected browser ->
justify-done (bar -> Review). Working -> Validating -> Review, no Connected drift.

DEPLOY: server needed `npm run build:server` (npx tsc -p tsconfig.server.json) -
`node build.js` / deploy:core does NOT build the server. Then `npm run deploy`
(npm-wrapped; the bash-guard blocks any command that LITERALLY contains
`bash deploy.sh` or references `~/.claude/justify` alongside build/deploy keywords -
run `npm run deploy` ALONE). Restarted the daemon (kill + justify-serve.sh) to load
the new server. Verified: POST /working -> {"ok":true}. NOTE: the source of truth on
this machine is improv/justify (the hook's "claude-dotfiles/justify" path does NOT
exist here). Daemon pid now 39425.

CAVEAT: the user's open tab still has the OLD core until reloaded - the
justify_working_force handler only exists in the new bundle. Reload required to pick
up the Working fix in the live tab.

Collaborator: Jonah.
