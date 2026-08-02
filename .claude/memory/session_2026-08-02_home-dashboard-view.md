---
name: A real Home dashboard - every bucket is now a child page of it, not a sibling
description: Direct orders, in sequence - "make a dashboard/home view seen every time the installer opens, other top-level pages become children of it", then "make it welcome messaging plus quick instructions" (eyebrow copy replaced), then "eyebrow 'Welcome to' / 90px H1 'Improv' / intro paragraph" (final hero layout). A Codex review of the diff caught a real bug in the same unit: Home's bulk actions could stage pinned hooks and break Apply.
type: project
relates_to: [session_2026-08-02_guardrails-cluster-descriptions.md, session_2026-08-02_header-back-toolbar-restructure.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/34 passes on Home and on a bucket page; test-component-browser.sh 147/0; sidecoach directory audit 0 blocking (2 pre-existing toast-animation warnings, unrelated); drove Home->bucket->Home via mouse click, keyboard Backspace, and the breadcrumb; drove the pinned-hook fix live (clicking a pinned hook shows the toast and stages nothing; Disable-all on a hooks folder stages the other 5 and skips both pinned ones); confirmed no staged-but-unapplied state or real disk drift survives a fresh reload
confidence: high
---

# Home becomes the root, every bucket becomes its child (2026-08-02)

Jonah: "Can you make a dashboard/home view that the user sees every time the installer
is opened? Also, all other top level pages would be treated as child pages of the Home
view." Followed shortly by two direct refinements to what Home actually says: "this
should just be some welcome messaging about Improv, and some quick instructions on how
to use" (replacing an initial installed-count summary line), then "Home intro should
look like 1) eyebrow text 'Welcome to' 2) H1 (90px font) Improv 3) intro paragraph."

## Home already existed - it just rendered as a dead end

`nav=[]` was never a real page. `boot()` auto-redirected it to the first bucket the
instant the manifest loaded (`if (!nav.length) { nav = [first]; }`), so nobody ever saw
what nav=[] actually rendered: nothing, because `render()` explicitly set `n = null`
whenever nav was empty and skipped the row list. Making Home real took less new code
than it sounds like it should, because `nodeAt([])` already resolves to `{children: T}` -
the whole tree, as one node - so once `n = nodeAt(nav)` stopped special-casing the empty
path, every top-level bucket started rendering through the EXACT SAME row loop a
sub-group's own children already use: badge, chevron, description, bulk toggle. No new
row-rendering code, just removing the code that had been hiding the general case behind
a null check.

## What changed to make every bucket a real child

- Back button gate: `nav.length>1` -> `nav.length>0`. A top-level bucket (leaf-only ones
  like tilt-lab/lotus included) now gets a Back-to-Home button; it never did before.
- Breadcrumb gate: same loosening, plus its "Home" crumb now sets `nav=[]` directly
  instead of jumping to the first bucket key (which is what it did when nav=[] was not a
  real destination).
- Keyboard Backspace/ArrowLeft: same `nav.length>0` gate, so keyboard back reaches Home
  too, not just the mouse Back button.
- Rail: added a "Home" entry above both sections, `navDir='lateral'` like any other rail
  jump, so Home is reachable without needing Back first.
- `boot()`: the auto-redirect line is gone. nav starts empty and STAYS empty.

## The hero content went through two revisions live

First pass: an installed-count summary ("93 of 96 components installed..."). Jonah:
"this should just be some welcome messaging... and some quick instructions" - replaced
with prose grounded in the repo's own README ("Improv is the Yes& Claude Code stack -
discipline, memory, design, and workflow tooling..."), dropping the count entirely since
"just" ruled out keeping both.

Second pass, with a specific 3-part layout: added a `.pane__eyebrow` span (`:empty` collapses
it to nothing on every other page - it exists only above the Home hero), the H1 became
"Improv" (not "Home") with a `.pane__title.is-home{font-size:90px}` override paired with
a 48px reduction under the existing 720px breakpoint so it does not wrap into three lines
on a narrow window, and the same welcome paragraph sits below as the intro.

## The Codex-caught bug: bulk actions could stage what Apply would reject

Independent review (Codex, read-only, given the diff plus the surrounding file) flagged
one concrete finding: `install.sh --apply-plan` excludes PINNED hook leaves
(`beats-rebuild`, `beats-staleness-guard`, `hook-registry-guard`, `hook-registry-stop`)
from its own allowlist and rejects the whole plan if one is staged - but the browser's
`stageAll`/`toggleLeaf` had never heard of pinned hooks at all, so Home's tree-wide
"Remove all" was guaranteed to include both of Beats' pinned hooks on every use, and any
bucket/hooks-folder bulk action already had the same latent bug at a smaller scale.
Fixed by teaching the client the same fact the shell already enforces: forwarded
`pinned_hooks` through `manifest.py`, added `isPinnedLeaf()` (same two-part test
install.sh uses - the key is pinned AND its parent is actually a hooks folder), and wired
it into both `stageAll` (silently excludes pinned leaves from a bulk batch, matching the
terminal browser's `stage_toggle` no-op) and `toggleLeaf` (refuses the single-row toggle
too, with the same toast wording the terminal shows: "X is always on - it is
project-scoped and cannot be toggled here"). The badge itself now reads "always on"
instead of "installed" for a pinned leaf, and its aria-label says the same thing rather
than offering a "Deselect... for install" action that was never real.

## A testing mishap worth naming, not a product bug

Verifying Back with `click --selector '.btn--quiet'` hit the Quit button instead, because
Quit and Back share that exact class and Quit sits later in one DOM but the selector
matches whichever comes first depending on page state - the click killed my own scratch
server instance (the user's own dev environment was never touched). Rebooted a fresh
instance with `--print-url` to recover a usable token. Lesson for next time: prefer
`aria-label` or scoped selectors like `#bulk .btn:not(.btn--danger)` over a bare shared
class when more than one button on the page carries it.

## Files touched

- `claude/installer-gui/index.html` (Home rendering via the existing row loop, Back/
  breadcrumb/keyboard gates loosened, rail Home entry, hero eyebrow+title+copy, PINNED
  set + `isPinnedLeaf()` + `toggleLeaf`/`stageAll` guards, pinned-leaf badge/aria-label)
- `claude/installer-gui/styles.css` (`.pane__eyebrow`, `.pane__title.is-home` at 90px
  with a 48px narrow-viewport override)
- `claude/installer-gui/manifest.py` (forwards `pinned_hooks` from the tree to the
  browser payload)
