# routing: which verb owns this request

Load this first when a design request arrives and it is not obvious which verb it is. Pick ONE
entry verb, load that verb's playbook, and let it drive. Running three verbs because the
request touched three things produces three partial passes and no finished work.

## The one question that settles most requests

**Does the visual world already exist, and is it staying?**

- **No, or it is being replaced** -> `new-work`. See `new-work.md`. This is the only flow with
  direction selection and a pre-build composition gate in it, and those are exactly the steps
  that matter when the world is the open question.
- **Yes, and the request extends it** -> a build verb (`craft`, `layout`, `typeset`, `animate`).
- **Yes, and the request judges it** -> a review verb (`audit`, `critique`, `polish`).
- **Yes, and the request changes its temperature** -> a tone verb (`bolder`, `overdrive`,
  `delight`, `colorize`, `quieter`, `distill`).

## Routing table

| The request sounds like | Verb |
|---|---|
| "build me a landing page / a new dashboard / this whole screen", a brief with no existing surface, "redesign this from scratch", "give it a new identity" | `new-work` |
| "add a component / build this feature" inside a surface that already exists | `craft` |
| "plan the design first, no code yet" | `shape` |
| "what's wrong with this page", "how does this look", "it feels off, take a look", "is the copy real or fluff" | `audit`, then `critique` |
| "make the spacing / hierarchy / structure better" | `layout` |
| "fix the type", "the fonts are wrong", "pick a typeface" | `typeset` |
| "add motion / animate this" | `animate` |
| "it's too plain / too safe / not memorable" | `bolder`, then `overdrive` if it needs to go further |
| "it's too loud / too busy / too much" | `quieter`, then `distill` |
| "add personality / delight" | `delight` |
| "the colours are wrong" | `colorize` |
| "make the copy and labels clearer" | `clarify` |
| "it's slow" | `optimize` |
| "get it production-ready", "error states, i18n, edge cases" | `harden` |
| "make it work on mobile / at every breakpoint" | `adapt` |
| "first-run experience / empty states / activation" | `onboard` |
| "pull the tokens and components into the design system" | `extract` |
| "write / update DESIGN.md" | `document` |
| "set up the project", no PRODUCT.md yet | `teach` |
| "which sidecoach tools exist", "this tool doesn't seem to exist", "what is dead weight" | `doctor` |

## Three routing rules that are not negotiable

**A diagnosis is an audit, not an opinion.** When asked to look at, review, diagnose or critique
an existing page, run `/sidecoach audit <target>` FIRST, before forming or stating a view. It
does not need a pending change: the audit renders the page and runs the detection engine, which
catches objective and taste defects a freeform read provably misses. The eyeball read is the
opinion; the audit is the measurement. Reaching for a screenshot to hand-critique a page instead
of running the audit is the specific failure this rule exists to prevent.

**No PRODUCT.md, no design.** If `PRODUCT.md` is missing, under 200 characters, or carries
`[TODO]` markers, run `/sidecoach teach <what you know from the brief>` before anything else.
Sidecoach without project context produces generic output, and generic output is the thing every
verb here is trying to avoid.

**`polish` runs last.** It aligns against the design system, so running it before `audit` and
`critique` polishes work that is about to change.

## When two verbs are a close call

Ask ONE clarifying question through the structured question tool, with the two candidate verbs
as the options and your recommendation marked. A single confirm is a path to specificity. What
is not acceptable is silently picking one and running eleven flows on a guess.

## After the entry verb

For any substantive UI change, the QA triad is not optional: `audit`, then `critique`, then
`polish`, in that order, plus the tactical-polish checklist and a `DESIGN.md` lint if the
project has one. Trivial edits (a one-line copy tweak, a named-token swap) can skip it. If you
skip it for any other reason, write `QA triad SKIPPED because <reason>` in the session record -
an unrecorded skip is indistinguishable from a gate that passed.

## Related

- `new-work.md` - the brief-to-deliverable flow, with a gate per step.
- `tools.md` - every tool a verb reaches for, with exit contracts.
- `doctor.md` - when a verb or tool named here does not seem to exist.
