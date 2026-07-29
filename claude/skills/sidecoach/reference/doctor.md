# doctor: does sidecoach's own capability graph hold together

Load this when a sidecoach tool named in a document does not seem to exist, when a verb
resolves to nothing, when someone asks what sidecoach actually ships, or before adding a new
capability - so the new one does not join the pile nobody can reach.

Dispatch: `/sidecoach doctor`, or `sidecoach doctor` from a terminal.

This is maintenance, not design. Do not redesign anything and do not open files the report
does not name.

## The question it answers

For every capability sidecoach ships, three separate things have to be true, and shipping only
the first two is how work disappears:

- **DISCOVERABLE** - the capability is named, with its invocation, in a document the model
  actually loads at runtime. Not in the repo README, not in a beat, not in a source comment.
- **REACHABLE** - something invokes it: a flow spawns it, another tool requires it, a hook
  wires it, or the resolver lists it for a human.
- **VERIFIED** - a test, a hook suite, or a mutation control covers it.

A capability that is reachable and verified but not discoverable scores zero in practice,
because the thing meant to call it cannot read that it exists. That is not a theory: it is
what happened to `sidecoach-image` and to `sidecoach-detect`, the engine behind
`/sidecoach audit`, both of which shipped working and were named in zero loadable documents.

## Step 1. Run the pass

```
node <sidecoach-repo>/bin/sidecoach-doctor.js [--json] [--quiet] [--surface <dir>]
```

- `--json` gives the structured report: `rows` (one per capability), `findings`, `inconclusive`.
- `--quiet` prints only the capabilities with a verdict other than OK.
- `--surface <dir>` measures a specific installed skill directory. By default it reads
  `~/.claude/skills/sidecoach` and falls back to the repo copy.

Exit codes: **0** everything discoverable, reachable and verified. **1** findings. **2** usage
or a required input unreadable. **3** inconclusive.

**Exit 3 is not a pass.** It means a check could not run - no loadable surface, an unbuilt
`dist/`, an unreadable source tree - so the result is unknown rather than clean. Read the
`INCONCLUSIVE` block, fix what it names (usually `npm run build`), and run it again. A tool
that exits 0 on a check it never performed is the failure this whole command exists to catch,
so it declines to do that to you.

## Step 2. Act by finding id

- **`capability-unnamed`** - it ships and no loadable document names it. Fix by naming it, with
  its literal invocation, in a reference document under the installed skill directory, and
  linking that document from `SKILL.md`. A file that nothing links to is present, not reachable.
- **`capability-unreached`** - nothing imports it, spawns it, wires it, or lists it. Two honest
  outcomes: wire it into a flow or the resolver registry, or retire it. Leaving it is a third
  option that costs maintenance and returns nothing. Say which one you chose.
- **`tool-not-in-resolver-registry`** - it ships in `bin/` but `sidecoach list` and
  `sidecoach help` do not enumerate it, so a person at a terminal cannot find it. Add it to the
  registry, or move it out of `bin/` if it was never meant to be user-facing.
- **`verb-unnamed`** - the verb dispatches but no loadable document shows how to invoke it. Add
  it to a routing table with an example.
- **`doc-contradicts-registry`** - a loadable document asserts something the registry disproves.
  **Treat this as the most urgent class in the report.** A gap makes a model miss a capability;
  a false statement makes it act on something untrue. Fix the claim, then derive it from the
  registry rather than restating it, or it drifts back the next time someone adds a tool.

## Step 3. Do not launder a count into a verdict

The report is a graph check, not a quality judgement. It cannot tell you a tool is good, only
that something can find and call it. Three specific restraints:

- **UNVERIFIED is a gap in coverage, not a claim the tool is broken.** Say "nothing covers it",
  never "it does not work".
- **A capability with docs=1 is discoverable, not well documented.** The count is mentions, and
  one mention in a table is the floor rather than the goal.
- **A green run means the graph closes.** It does not mean the capabilities are any good, and
  it says nothing about whether they get selected on real requests. That question needs real
  inputs, and green tests have already stood in for it once in this project at 0% real recall.

## Step 4. Fix the surface, not the number

The tempting fix for a page of `capability-unnamed` findings is one document listing every tool
name so the count goes green. That satisfies the check and helps nobody: a name with no
invocation and no exit contract is not selectable. Each entry needs the literal command, what
its exit codes mean, and which verb or flow reaches for it. `tools.md` is that document and is
the right place to add to.

## What it deliberately does not check

- Whether a capability is ever actually selected on real requests. That needs a corpus, not a
  file sweep.
- Whether a document's prose is *good*. It only proves a claim it can evaluate against the
  registry; a claim it cannot evaluate is left alone rather than guessed at.
- Project artifacts. `PRODUCT.md` and `DESIGN.md` drift belongs to `teach` and `document`.

## Related

- `tools.md` - the loadable index of every shipped tool, which is what fixes `capability-unnamed`.
- `harnesses.md` - which agent harnesses receive the loadable surface, and how to prove one loads it.
- `new-work.md` - the flow that invokes most of the tools this report inventories.
