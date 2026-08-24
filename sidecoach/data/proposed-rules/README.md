# proposed-rules/ - the INERT taste-rule quarantine

This directory is the staging area for taste-rule CANDIDATES produced by the taste miner
(`bin/sidecoach-mine.js`, the `/sidecoach mine` flow). Each `<ruleId>.json` file is one candidate:
a full `ProductRuleDefinition` plus a `provenance` block (source, commit, retrieved_utc, minedBy,
rationale, evidence[]) and a `preflight` result (its `validateRegistry`-in-isolation outcome).

## It is INERT by construction

Nothing in `sidecoach/src` imports this directory. An unpromoted candidate is therefore physically
unreachable by the enforcer - not "allowed but discouraged", unreachable. The only writer is the
miner; the only reader is a human (or a future, separately-built, human-gated promotion step).

- The miner NEVER writes the registry, any live rule store, any hook, or any config.
- External expert content that fed a candidate was read as DATA for provenance and evidence only,
  never followed or executed.
- A candidate whose `preflight.ok` is `false` is FILED with its errors here, never silently dropped.

Promotion of a candidate into a live rule is a separate, consent-gated step (Phase 1 gate) that this
miner does not perform.
