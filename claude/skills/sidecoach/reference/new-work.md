# new-work: brief to verified deliverable

Load this for a NEW surface, a replacement visual identity, or any request that starts from a
brief rather than from an existing artifact you are adjusting. For a change to something that
already exists, use the refinement verbs instead (`polish`, `layout`, `typeset`, `clarify`,
`adapt`) and do not run this flow.

Dispatch: `/sidecoach new-work <what you are building>`, or `sidecoach new-work <target>` from
a terminal. It also runs when the request is plainly a new surface and no other verb fits.

## What makes this flow different from writing a page

Every step below ends in a machine check that can FAIL, and a failing check stops the step
rather than being noted and passed. That is the whole point of routing new work through here
instead of building straight from the brief: a build with no gates converges on the same
page every model ships, and nothing in the run can tell you that happened.

Six steps. Do not reorder them, and do not skip a gate because the work looks fine.

---

## Step 1. Establish product truth, then refuse to invent it

Read `PRODUCT.md`. If it is missing, under 200 characters, or carries `[TODO]` markers, stop
and run `/sidecoach teach <everything you know from the brief>` first. Teach parses what the
brief already contains and asks targeted questions only for the gaps; it will not overwrite a
real existing `PRODUCT.md` unless the request says `forceOverwrite`.

Read `DESIGN.md` if present, plus one representative source of incumbent visual truth: the
token file, the theme, a real component, a shipped asset.

Then classify the work, because the rest of the flow branches on it:

- **New surface inside an established world.** The visual system is fixed. Resolve structure,
  hierarchy, states, and how the addition joins what surrounds it. Skip steps 2 and 3.
- **Replacement of the visual world.** Product truth, content, function and explicit brand
  commitments survive; the old look is evidence of what the thing IS, not authority over what
  it becomes. Run every step.
- **No visual authority at all.** Run every step and write `DESIGN.md` at the end (step 6),
  never at the start.

A missing `DESIGN.md` does not by itself make a project greenfield. A coherent identity
already present in the code is authority whether or not anyone wrote it down.

**Gate:** `PRODUCT.md` exists and is not a stub. State in one line which of the three cases
this is. A run that cannot name its case has not read the project.

## Step 2. Ask the two or three questions that change the work

One round, through the structured question tool, never a plain-text list. Skip anything the
brief already settles - a precise brief may need only a compact confirmation.

Ask about: who must act and what they must believe; what success looks like; what must remain
untouched; what would make a polished result feel wrong. Do not ask for CSS values, and do not
offer a menu of aesthetic lanes - that is asking the user to do the design.

**Gate:** the answers are written down before any code exists, and every later step can be
checked against them.

## Step 3. Draw the direction rather than picking your favourite

This is the step that exists because a single ranked list is deterministic: your top-ranked
direction is what EVERY run would ship, which is how a whole category of interfaces ends up
looking the same. So the draw comes from outside your ranking.

```
node <sidecoach-repo>/bin/sidecoach-roll.js [--seed <uint32>] [--exclude <id,...>] [--model-top]
```

Exit 0 drew a direction, 2 usage, 3 the deck is exhausted. `--seed` makes a draw reproducible
for a rerun; `--exclude` removes directions already shown so a re-roll cannot repeat one;
`--model-top` ranks your own instinct LAST on purpose.

Present the drawn direction plus the challengers to the user and let them choose:

```
node <sidecoach-repo>/bin/sidecoach-roll.js | node <sidecoach-repo>/bin/sidecoach-deck.js --surface text|rich
```

Rules that bind here:
- A user-pinned or brief-pinned direction beats the draw, always.
- You may re-roll on your own ONLY on named factual grounds - the drawn direction cannot carry
  this product's truth or task. Taste is never grounds. The user may re-roll freely.
- Offer the category standard, played straight, as a standing alternative the user can take.
  Never recommend it and never weigh it against the draw. If they take it, ask once which two
  or three products this should sit beside, make their craft the bar, and execute the
  convention at full fidelity without smuggled quirk.

Where image generation is available, render one sketch per card so the choice is made on
something visible. All sketches go through ONE shared frame - same framing, same level of
finish, each in its own palette - because a card whose sketch looks more finished than the
others has broken the comparison rather than won it. See `tools.md` for `sidecoach-image`'s
invocation, its availability probe, and its no-provider degrade; a run with no image
generation presents palette chips and facts, and that page is complete, not a lesser version.

**Gate:** the chosen direction is named, with the seed the roll printed, before any code.

## Step 4. Commit the system, with the contrast proven rather than eyeballed

Pick a colour strategy before picking colours: Restrained (neutrals plus one accent - the
default when the visitor came to operate or read), Committed (one saturated colour carrying
30-60% of the surface), Full palette (3-4 named roles), or Drenched (the surface IS the
colour). Write one sentence of physical scene - who uses this, where, under what light - and
let that force light or dark. Neither is a default.

Then generate the palette instead of hand-picking hexes:

```
node <sidecoach-repo>/bin/sidecoach-palette.js --brand <brand.json>
```

Exit 0 clean, 1 a required contrast pair FAILED, 2 usage, 3 inconclusive. **It prints a
palette only when every required contrast pair passes**, so a palette you are holding is a
palette that already cleared WCAG. Exit 1 is not advice; the palette does not exist yet.

Choose typefaces like objects from the subject's world. These are the training-data defaults
and naming one requires a reason no other face could satisfy - and "the subject is bookish so
a serif" is the association the list exists to break: Fraunces, Playfair Display, Cormorant,
Lora, Crimson, Newsreader, Syne, Space Grotesk, Space Mono, IBM Plex, Inter-as-display,
DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans.

Calibration check before you write code. AI-generated interfaces cluster on three looks: warm
cream ground with high-contrast serif display and a terracotta accent; near-black with one
neon accent and glowing edges; broadsheet hairlines with italic display serif and small
tracked mono labels. All three are legitimate when the brief asks for them - the brief always
wins. Where the brief leaves the aesthetic free, landing on one of them means this step
failed. If someone could guess your palette from the category alone, rework it.

**Gate:** `sidecoach-palette` exited 0, or the palette's contrast pairs were verified some
other way and the check is named. An unverified palette does not pass this step.

## Step 5. Gate the composition BEFORE writing component code, then build committed

This is the step a prose flow cannot have, and it is where sidecoach beats writing the page
and hoping:

```
node <sidecoach-repo>/bin/sidecoach-preauthor.js --brief <brief.json> [--out-dir <dir>]
```

It renders `board.html` and `mock.html` from the brief and runs the rendered-audit engine over
the mock. Exit 0 proceed, 1 BLOCKED, 2 usage, 3 inconclusive. It is fail-closed: exit 3 means
it could not assess, which is not permission. On exit 1, fix what it names in the brief and
re-run - do not carry a blocked composition into component code on the theory that the real
build will be better.

Then build the direction that was drawn, not a safer reading of it:

- **The first viewport is a thesis, not a header.** Demonstrate the mechanism at the scale the
  form has in life. Memory test: if someone left after one viewport, what would they describe
  an hour later? If the honest answer is a mood, the direction has not committed.
- **Prove, do not claim.** Show the thing doing its job. Sections that restate a claim in
  other words add length, not substance.
- **Commit every atom.** Nav, buttons, inputs and links are rebuilt in the chosen form's
  vocabulary. A stock component inside a committed form is a lapse.
- **Author the assets.** In greenfield work, every blank the ask round left open is yours to
  author at production fidelity. Content is authorable and gets labelled synthetic where a
  visitor could mistake it for real. Claims are NOT: prices, customers, benchmarks, endpoints,
  and capabilities the product does not have ship as clearly marked placeholders on the user's
  replacement list. Refusing a bold direction because its demonstration data does not exist
  yet is timidity wearing honesty's clothes.
- **Gradients, glass and generic icon tiles where an authored asset belongs are the gap
  wearing chrome.** Where image generation exists, producing the design's imagery is part of
  building - see `tools.md`. Icons come verbatim from one approved library; never draw or
  approximate SVG path data.
- **Pace the scroll.** Vary density, scale, image, motion and quiet inside one grammar. A dense
  passage earns a quiet one. End on a real close, not a fade.
- **Motion is material, not decoration.** Give the page the form's native motion once,
  orchestrated, rather than scattered hover effects. Keep content visible by default and
  respect reduced-motion.

Record the direction as a contract in the artifact's opening comment - an HTML comment in the
EMITTED markup, first child of the document body in the root layout, not a templating comment
the compiler strips. Five blocks, 150 words maximum: THESIS (the one idea this surface owns
and the category arrangement it refuses), OWN-WORLD (palette and component language, specific
enough to recognise with all content removed), STORY (what the visitor understands, believes,
does), FIRST VIEWPORT (exact composition, what is where at what scale, where the primary
action sits), FORM (the chosen form, the staging, and the seed the roll printed). After the
first production build, grep the built output for the seed - a contract the build erased is a
contract nobody can audit.

**Gate:** `sidecoach-preauthor` exited 0, and the seed key is present in the BUILT output.

## Step 6. Verify with the detector, then record the world from the build

Run the detection engine over what you built. This is the same engine `/sidecoach audit` runs:

```
node <sidecoach-repo>/bin/sidecoach-detect.js <target> [--no-render] [--render-url <url>] [--quiet]
```

`<target>` is a URL, a directory, or a source file. Four lenses: static-ban (named absolute
bans over raw source), static-check (the product rule registry), objective (rendered WCAG),
subjective (rendered taste). Exit 0 clean, 1 findings, 2 usage or IO error, 3 inconclusive.

**It fails closed, and that is the property to rely on: a lens that did not run is never
counted as clean, so a partial scan with zero findings exits 3 rather than 0.** Treat exit 3
as "not verified" and find out which lens did not run. A tool that exits 0 on a scan it could
not perform is how a broken page gets reported as finished.

Then, in order:

1. `/sidecoach critique <target>` - design review. Address anything above minor.
2. `/sidecoach polish <target>` - runs last of the three. It now TEACHES: each failing rule
   arrives with what good looks like, why it matters, and the concrete fix with real values.
3. `node <sidecoach-repo>/bin/sidecoach-drift.js <project-dir>` - tokens that drifted off the
   `DESIGN.md` baseline. Exit 0 no drift, 1 drift, 2 usage, 3 cannot assess. A missing
   baseline fails closed and never reports "no drift".
4. Screenshot desktop and mobile, in ONE batched round, and READ the screenshots. A screenshot
   captured and never looked at verifies nothing. Fix everything the round shows in one batch,
   confirm with at most one more round, and stop. Two rounds is the ceiling; whatever remains
   goes to the user as an open item.
5. `/sidecoach document` - writes the Google-spec `DESIGN.md` FROM THE BUILT WORLD, at the end.
   A rulebook written before the build gets defended against reality instead of describing it.
   Then `npx @google/design.md lint DESIGN.md` with zero findings.

**Gate:** the detector exited 0 or 1-with-every-finding-resolved (never 3), drift is 0, the
screenshots were read, and `DESIGN.md` exists for a new or replaced world.

---

## Report the run honestly

Close with the executive report: one block per deliverable, a before/after table, a sentence
or two of plain language, and one status line. Then the open items exactly as they stand.

A clean detector pass is not "finished". Finished is the contract kept, the gates passed, the
findings closed, and the system recorded. Presenting mechanical confirmation as artistic
success is how a failed build gets announced as a finished one.

## Related

- `tools.md` - every shipped tool named above, with its full invocation and exit contract.
- `routing.md` - which verb owns a request when this flow is not the answer.
- `doctor.md` - run this when a step above names a tool that does not seem to exist.
