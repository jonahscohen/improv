---
colors:
  brand:
    red: "#DC2618"
    ink: "#1A1F1B"
    cream: "#F4EFE4"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  scale: "4px"
  sizes:
    "2": "8px"
    "4": "16px"
    "6": "24px"
motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
  duration:
    fast: "180ms"
    medium: "260ms"
---

# DESIGN.md - drift fixture

A minimal but valid design-system baseline used to prove drift detection: the CSS
below defines five tokens that MATCH these values (must not flag) and five that do
NOT (must flag, one per category).

## Colors

Brand red `{colors.brand.red}`, ink `{colors.brand.ink}`, cream `{colors.brand.cream}`.
