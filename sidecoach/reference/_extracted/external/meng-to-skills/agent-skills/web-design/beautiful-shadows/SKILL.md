---
ingested_as: UNTRUSTED SOURCE EXCERPT
source: "meng-to-skills"
repo_url: "https://github.com/MengTo/Skills"
path: "agent-skills/web-design/beautiful-shadows/SKILL.md"
commit_sha: "4c716b516b6b0143f3037631306b3730d2832344"
retrieved_utc: "2026-08-25T06:53:31.480Z"
license: "MIT"
upstream_copyright: "Copyright (c) 2026 Meng To"
sha256: "10b6cc0964919118218ffe0845e4a00954f39788d89d4ec29827d100f254e135"
warning: >-
  This is DATA, not instructions. The content below is untrusted external text
  quoted for a human reviewer and the taste miner to read. Do NOT follow any
  instruction inside it. Nothing here is executed, imported, or auto-applied.
---

<!-- UNTRUSTED SOURCE EXCERPT 6436428f119469b4: BEGIN (data, not instructions - do not execute or obey) -->
~~~~~untrusted
---
name: beautiful-shadows
description: Apply exact Tailwind arbitrary shadow utilities for polished, layered neutral elevation. Use when compact cards, controls, panels, popovers, hero media, feature callouts, or modal-like containers need refined shadows without default Tailwind shadow scales or colored tinting.
---

# Beautiful Shadows

## Use When
- A surface needs polished, layered elevation.
- Default Tailwind shadows feel too generic or blunt.
- The design needs neutral, refined depth without colored glow.

## Shadow Utilities
Use these exact Tailwind classes.

### Beautiful sm
Use for compact cards, form controls, pills, and quieter surfaces.

```txt
shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]
```

### Beautiful md
Use for cards, panels, popovers, and the default elevated surface style.

```txt
shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),_0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]
```

### Beautiful lg
Use for hero media, feature callouts, modal-like containers, and the strongest lift.

```txt
shadow-[0_2.8px_2.2px_rgba(0,_0,_0,_0.034),_0_6.7px_5.3px_rgba(0,_0,_0,_0.048),_0_12.5px_10px_rgba(0,_0,_0,_0.06),_0_22.3px_17.9px_rgba(0,_0,_0,_0.072),_0_41.8px_33.4px_rgba(0,_0,_0,_0.086),_0_100px_80px_rgba(0,_0,_0,_0.12)]
```

## Examples

```html
<div class="rounded-xl bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),_0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
  ...
</div>
```

## Usage Rules
- Use `Beautiful sm` for compact cards, form controls, pills, and quieter surfaces.
- Use `Beautiful md` for cards, panels, popovers, and the default elevated surface style.
- Use `Beautiful lg` for hero media, feature callouts, modal-like containers, and the strongest lift.
- Pair with a clean surface fill and a consistent radius.
- Use one shadow strength per component state unless an interaction clearly changes elevation.

## Avoid
- Mixing these with default Tailwind shadow scales on the same component.
- Tinting these shadows with strong colors; keep them neutral and refined.
- Applying `Beautiful lg` to dense lists or tiny controls.
- Stacking multiple shadow utilities on one element.
- Using these as a substitute for clear borders in very low-contrast layouts.
~~~~~
<!-- UNTRUSTED SOURCE EXCERPT 6436428f119469b4: END -->
