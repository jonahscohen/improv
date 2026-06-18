---
name: Justify - claudebar/queue pills get launcher-style hover
description: the claudebar spark pill and queue badge now have the activation button's warm-tint + scale-pop hover
type: project
relates_to: [session_2026-06-18_justify-input-drag-and-glow-select.md]
---

Collaborator: Jonah

Jonah (with screenshots): the claudebar spark pill and the queue badge ("1") have no hover state,
unlike the Justify activation/launcher button (the & ampersand) which fills with a warm tint + a
scale-pop on hover. Wanted the bar pills to match.

Cause: both pills are 32px circles already wired with `transition:background,transform` but never
got a mouseenter handler - they only had tooltips + the ambient glow animation. The launcher
(_closeBtn, toolbar.ts) does `background:#D9775733` + _animateAmp scale on hover.

Fix: added `_addBarPillHover(hoverTarget, circle)` in index.ts - mouseenter fills the circle with
`rgba(217,119,87,0.30)` + `scale(1.08)`, mousedown `scale(0.92)`, mouseleave restores. Background
is saved/restored via a dataset key so it never clobbers the pill's state-driven background
(connected/working/review, or the queue's active fill). Applied to the claudebar spark `icon` and
the queue badge `btn`.

Gotcha fixed alongside: the queue badge's active-toggle determined active state by string-comparing
`btn.style.background === 'rgb(217, 119, 87)'`. The warm hover tint would fool that compare and
flip the toggle wrong. Replaced it with a `btn.dataset.qactive` flag.

Verified in-browser (real hover + zoom): spark pill hover -> warm tint fill + orange spark; queue
badge hover -> warm tint fill; moving off the spark reverted it to its dark base (leave-restore
works, no stuck state). Matches the activation button.

Follow-up fix (Jonah): the queue hover only fired over the icon, while Review Changes fired from
anywhere on the button. Cause: I had passed the badge circle as BOTH hover target and circle
(`_addBarPillHover(btn, btn)`), so only the 32px badge was the trigger. The claudebar pill passed
the whole pill as target (`_addBarPillHover(pill, icon)`). Fix: queue now uses
`_addBarPillHover(this._queuePill, btn)` - whole pill triggers, badge circle warms. Verified
in-browser: hovering the "Queued Task" label (away from the icon) warms the badge.

Follow-up #2 (Jonah): when the changes panel was OPEN, the spark showed the hover tint as its
"active" look - "the hover state becomes the active state." Cause: the panel-open active state sets
the icon to SOLID orange (#D97757), but `_addBarPillHover`'s save/restore painted its translucent
tint over it on hover and restored a stale value on leave, so the solid active fill never survived.
Fix: the hover helper now no-ops its background (scale only) when the pill is in its active state,
gated on `circle.dataset.barActive === '1' || circle.dataset.qactive === '1'`. The claudebar sets
`icon.dataset.barActive='1'` (+ clears justifyHovBg) at its open/active points and `''` at its
close/inactive points; the queue badge reuses its existing `qactive` flag. Verified in-browser:
panel open -> spark solid orange; hovering the open spark -> STAYS solid orange (no tint clobber);
the non-active spark still gets the warm hover.

Files: justify/core/index.ts. Rebuilt + deployed to ~/.claude/justify + public/justify-core.js.
