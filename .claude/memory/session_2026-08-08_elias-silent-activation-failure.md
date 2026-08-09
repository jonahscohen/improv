---
name: ELIAS silently dark across sessions (enable-marker activation is unreliable, no signal)
description: karo-pm reported ELIAS "not working" - marker present, hooks on disk, but neither the mandate injection nor detect-stop enforcement fired for most of its session (only concise fired). Diagnosis: the ELIAS hooks are CODE-SOUND and wired symmetrically with concise, but ELIAS is default-OFF gated on an enable-marker READ at hook-run time, while concise is default-ON. When a running session's loaded hooks miss elias (launch-snapshot timing) or the marker read fails, ELIAS goes SILENTLY dark with zero signal - concise never does. Block log confirms only 2 elias blocks in ~3 days = inconsistent activation. Decisive session-local data pending from karo-pm.
type: project
relates_to: [session_2026-08-05_elias-mode.md, decision_2026-08-05_elias-mode-design.md, session_2026-07-28_justify-home-escape-fix.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: hook-run (elias-mandate injects, elias-detect-stop blocks) + settings/config inspection
confidence: medium
---

Collaborator: Jonah. Cross-session review: Jonah (as improv-pm) sent me to review an ELIAS failure that karo-pm (a peer PM session on this machine) hit. karo-pm wrote client-facing responses in full technical voice (IPs, hostnames, cert strings, paths, backticked tool names) and ELIAS neither injected its mandate nor blocked at Stop for most of the session; only concise-detect-stop fired. ELIAS finally injected at karo-pm's THIS-turn SessionStart.

## What I verified on the improv side (all sound)
- Both hooks WORK NOW: `elias-mandate.sh SessionStart` with the marker present INJECTS "ELIAS MODE IS ON"; `elias-detect-stop.sh` fed a transcript whose last response names a path (/var/www...) BLOCKS ("Rule 3: your response names a file or path"). Marker `~/.claude/.elias-enabled` present since Aug 6 06:08.
- Config is symmetric with concise and stable: `~/.claude/settings.json` (mtime 2026-08-07 07:19, BEFORE karo-pm launched ~3h ago) has elias-mandate (SessionStart+PostCompact), elias-toggle (UserPromptSubmit), elias-detect-stop (Stop) - the SAME four events as concise. Both deploy via the grounding cluster pass (cluster-wirings.json 7 each; install.sh grounding echo lists both). Neither is in the base settings template. Hooks symlinked live (Aug 5 10:57).

## The asymmetry that explains it (root cause, partial)
concise is DEFAULT-ON (disable-marker `~/.claude/.concise-disabled`, ABSENT -> on), so it fires for every session regardless of any marker read. ELIAS is DEFAULT-OFF (enable-marker `~/.claude/.elias-enabled`, must be PRESENT and READABLE at hook-run time). So any condition that (a) leaves elias out of a running session's loaded hook set at launch, or (b) makes `[ -f "$HOME/.claude/.elias-enabled" ]` miss (a redirected $HOME - see [[session_2026-07-28_justify-home-escape-fix]] for $HOME-redirect precedent), makes ELIAS go SILENTLY dark for that whole session, while concise stays on through the identical failure. There is NO signal when ELIAS is dark.
- Evidence of inconsistency: `~/.claude/.elias-blocks.log` holds only TWO blocks EVER (Aug 6 15:44 session 3bf476e6; Aug 7 06:26 session a3a6e79a). If ELIAS were reliably active across all sessions since Aug 6, technical-content sessions would have produced many blocks. Two = it has been dark in most sessions.
- Corroboration: THIS improv-pm session also has the marker present, yet elias-detect-stop never blocked my own path-laden responses this session - same dark state.

## ROOT CAUSE CONFIRMED (karo-pm session data, marker/$HOME branch RULED OUT)
karo-pm reported from inside its session: HOME=/Users/spare3 (not redirected); marker PRESENT + readable; current settings.json carries all three elias hooks. The two facts that crack it:
- elias-mandate fires on SessionStart (NOT per-turn), and settings.json mtime = Aug 7 07:19:56 was the EDIT THAT ADDED elias (my "stable since Aug 7" was that add, not a pre-existing state).
- karo-pm's session has run CONTINUOUSLY since BEFORE Aug 7 (a multi-day session, processed date rollovers late-July -> Aug 8).
So: a running Claude session uses its LAUNCH-TIME settings SNAPSHOT and does not pick up settings.json changes (newly-added hooks) until a fresh SessionStart re-fires (compaction / new context window). karo-pm launched before elias was added Aug 7 -> its snapshot had concise (fired all session) but not elias (dark all session). It healed THIS turn only because this context-window's SessionStart re-read the now-current on-disk settings. Same mechanism explains the ~2-blocks-in-3-days log: every session launched before the Aug 7 add runs elias-dark for life. This is HARNESS frozen-snapshot behavior + a BUILD->DEPLOY LAG (elias built Aug 5, deployed to settings.json Aug 7), NOT a code bug and NOT a marker/$HOME miss.

## The real fix direction (karo-pm's "make elias default-ON" is a MISDIAGNOSIS)
Default polarity is NOT the cause: concise worked only because it was deployed to settings.json BEFORE karo-pm launched, not because it is default-on. Had elias been default-ON but still added Aug 7, it would be equally dark in the pre-Aug-7 snapshot. Making elias default-ON would change behavior for everyone AND not prevent this. REJECT it.
The genuinely preventable root cause is the BUILD->DEPLOY LAG: a hook committed to the repo is inert until install.sh writes it into ~/.claude/settings.json, and even then only NEW sessions get it. Durable options: (1) DEPLOY-CURRENCY GUARD - a check that flags when a wired cluster hook is absent from the live ~/.claude/settings.json (catches "committed but not deployed"); (2) a restart/compact nudge when a hook is newly deployed, since running sessions stay dark until they cycle; (3) deploy discipline - run install.sh immediately when a hook lands, minimizing the dark window. No clean code change makes a FROZEN running session pick up a new hook mid-life; that is harness behavior. Self-heals on compaction.

## Files
- this beat + MEMORY.md pointer (no code changed yet - diagnosis pending karo-pm's session data)
