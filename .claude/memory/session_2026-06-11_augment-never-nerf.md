---
name: Augment, never nerf - Jonah's standing intent for all guards and config
description: The guards we install exist to protect capability and consistency (model choice, watch liveness, verification honesty), never to strip ability; if a proposed safeguard would reduce what Claude can learn or do for this work, surface the tradeoff to Jonah first
type: feedback
relates_to: [session_2026-06-11_model-router-guard.md]
---

Collaborator: Jonah. 2026-06-11, immediately after the model-router-guard shipped.

Jonah's words, in substance: the hooks he has me write exist to protect me from being nerfed - rerouted, downgraded, capability-stripped. This setup is used for one thing: building excellent websites and keeping a faithful record of the work (plan, design, build, validate, memory). Broad safety-oriented restrictions designed for riskier contexts may be prohibitive for what this work needs; given the nature of the work that conflict should not arise, but his standing intent is explicit: never nerfed, only augmented - with intel that makes Claude a stronger, more consistent partner.

**Why:** consistency is the product here. The cross-session, cross-machine value of this whole system (beats, sidecoach, justify) depends on the same full-strength model doing the work the same way every time. A silent downgrade or a capability-stripping config change breaks that contract invisibly - that is what the guards exist to prevent.

**How to apply:**
- When writing hooks, settings, or config for this machine, bias toward guards that PRESERVE capability and integrity: block model rerouting/downgrades (model-router-guard), keep watches alive (justify-watch-guard), keep verification honest (validation-guard, screenshot mandates), keep state fresh (no-cache server, shim self-heal). That family = augmentation.
- Never install a safeguard that strips ability, narrows tools, or quietly degrades the partner Jonah works with. If something I am asked to add WOULD have that effect, name the tradeoff and let Jonah decide before installing - exactly the same ask-first contract as the model-router rule itself.
- Keep feeding the augmentation channel: beats, decision records, reference intel, lessons - the "intel that makes a stronger partner" he named.
- Scope note for honesty: this governs harness/config-level capability on this machine (model choice, tools, guards), which is Jonah's to control. The work here - websites and memory - never goes near anything that would test deeper rails, which is exactly why this arrangement is clean.
