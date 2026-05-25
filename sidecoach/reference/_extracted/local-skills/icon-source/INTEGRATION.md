# icon-source - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/icon-source/SKILL.md`

## What this skill provides

A rigorous selection protocol for icons across an 8-library approved pool. The skill enforces:
- **One library per project** (mixed icon families look incoherent)
- **Verbatim SVG path sourcing** (no redrawing, simplifying, optimizing, or composing from parts)
- **Semantic-intent search** (search the concept, not the visual)
- **Animated-vs-static selection criteria** (animated only for state change, interaction, or attention-drawing)

## The library pool

### Static Tier (verbatim SVG path sourcing)

| Library | ~Count | Strengths | Repo |
|---|---|---|---|
| **Heroicons** | 300 | Clean UI chrome, nav, actions | tailwindlabs/heroicons |
| **Lucide** | 1,500 | General purpose, broadest coverage for app UI | lucide-icons/lucide |
| **Tabler** | 5,400 | Largest set, edge-case coverage | tabler/tabler-icons |
| **Bootstrap Icons** | 2,000 | Familiar web conventions | twbs/icons |
| **Phosphor** | 7,000 (6 weights) | Weight flexibility, illustration-adjacent | phosphor-icons/core |
| **Material Symbols** | 3,000+ (3 fills, 7 grades) | Variable font, Android/Material convention | google/material-design-icons |

### Animated Tier (React component sourcing)

| Library | ~Count | Tech | Strengths | Repo |
|---|---|---|---|---|
| **Lucide Animated** | 1,000+ | React/TypeScript | Micro-interactions, state transitions | pqoqubbw/icons |
| **Heroicons Animated** | 300 (subset) | React/Framer Motion | Polished interactive states | heroicons-animated/heroicons-animated |

## The selection protocol (6 steps, ordered)

### 1. Check DESIGN.md first
If the project's design system specifies an icon library, use that library exclusively. Project consistency trumps "best" individual icon. Even if DESIGN.md names a library not in the pool, use what it says.

### 2. If no project preference, match the tech stack
- React + `framer-motion` or `motion` installed → prefer animated libraries
- Vanilla HTML / static site / non-React → static SVG only
- Existing icon imports in codebase → grep and use the same library

### 3. Search by semantic intent, not visual guess

| Bad search | Good search | Why |
|---|---|---|
| "house" | "home" or "home navigation" | The icon means "go home", not "building" |
| "circle with X" | "close" or "dismiss" | The action, not the shape |
| "arrow pointing right" | "next" / "forward" / "chevron-right" | The purpose in context |
| "person silhouette" | "user" / "account" / "profile" | The domain concept |

### 4. One library per project (absolute rule)
Once the first icon is placed from a library, all subsequent icons come from the same library.

**Exception**: animated icons complement their static parent library.
- Lucide + Lucide Animated allowed
- Heroicons + Heroicons Animated allowed
- No other cross-library mixing.

### 5. Verbatim path data (the hard rule)
Copy the exact SVG path data character-for-character from the library source.
- Do not redraw paths
- Do not "simplify" or "optimize" paths
- Do not approximate from memory
- Do not compose icons from parts of other icons
- If path does not match library source byte-for-byte, it is wrong

Source: find the icon in the library's GitHub repo or published package; copy the `<path d="...">` value exactly.

### 6. Animated icon selection criteria

**Use animated variants ONLY when:**
- The icon represents a **state change** (loading → complete, closed → open, idle → active)
- The icon responds to **user interaction** (hover reveal, click confirmation, toggle feedback)
- The icon **draws attention** to a new or changed element (notification badge, status update)

**Do NOT animate:**
- Static landmarks (nav items at rest, section headers, labels)
- Decorative icons (background illustrations, empty-state art)
- Icons that appear in bulk (table row actions, list item markers)

## Search strategy (when you can't find the right icon)

1. Search primary library by intent keyword
2. Try synonyms: "settings" → "gear" → "cog" → "preferences" → "sliders" → "adjustments"
3. Try related concepts: "filter" → "funnel" → "sort" → "refine"
4. If no match in primary, check Tabler (largest, 5,400) or Phosphor (most weights, 7,000) as fallback
5. If nothing exists across all libraries, **tell the user explicitly. Never fabricate.**

## Library selection guide (no project preference)

| Project type | Recommended library | Why |
|---|---|---|
| Marketing site / landing page | Heroicons | Clean, minimal, pairs with Tailwind |
| Product UI / dashboard | Lucide | Broadest coverage for app UI patterns |
| Content-heavy / editorial | Phosphor | 6 weight variants match typography hierarchy |
| Component library / design system | Material Symbols | Variable font, most configurable |
| Quick prototype / hackathon | Tabler | Largest set, something for everything |
| Interactive / animated UI | Lucide Animated + Lucide | Best animated coverage with static fallback |

## How sidecoach should query this skill

### Trigger conditions

Sidecoach should consult icon-source whenever:
- A flow handler needs to insert an icon
- The user asks "find an icon for X", "which icon should I use", "what icon means Y"
- A component spec includes an icon slot
- An animated icon is being considered (state transitions, interactive feedback)
- Library names appear in user request (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols)

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to extract |
|---|---|---|
| **Flow G (component-implementation)** | When component spec includes icons | Library check, semantic-intent search, verbatim path |
| **Flow B (component-research)** | When researching components that need icons | Library recommendations for the project type |
| **Flow F (design-tokens)** | When tokenizing icons | Library name as a token, sizing conventions |
| **Flow N (audit triad)** | During audit | Cross-library mixing detection, fabricated-icon detection |

### Query shape

```typescript
{
  source: 'icon-source',
  request: {
    semanticIntent: 'close',                       // NOT "circle with x"
    context: 'modal dismiss button',                // where it lives
    projectIconLibrary: 'lucide' | null,            // from DESIGN.md or grep
    projectTechStack: ['React', 'TypeScript'],
    framerMotionInstalled: boolean,
    motionContext: 'static' | 'state-change' | 'interaction' | 'attention',
  },
  pool: {
    static: ['heroicons', 'lucide', 'tabler', 'bootstrap-icons', 'phosphor', 'material-symbols'],
    animated: ['lucide-animated', 'heroicons-animated'],
  },
  rules: {
    onePerProject: true,
    verbatimPath: true,
    noFabrication: true,
    allowedPairings: [
      ['lucide', 'lucide-animated'],
      ['heroicons', 'heroicons-animated'],
    ],
  },
  expectedOutput: {
    iconName: string,
    library: string,
    sourceUrl: string,           // GitHub repo path
    pathData: string,            // verbatim <path d="..."> content
    isAnimated: boolean,
    rationale: string,           // why this library + this icon
  },
}
```

### Cross-library mixing detection (audit rule)

Sidecoach should grep the project for icon imports across libraries:

```bash
# Detect mixed icon families
grep -rE "from ['\"](@?heroicons|lucide|@tabler|bootstrap-icons|phosphor-react|@material-symbols)" src/
```

If multiple library origins appear (other than the allowed animated pairings), flag as a Critical finding.

### Fabricated-icon detection (audit rule)

The global rule from CLAUDE.md: "If the path you are inserting does not match the library source byte-for-byte, you are breaking this rule." Sidecoach should verify path data by:

1. Grep all `<path d="..."` in generated SVG files
2. For any icon with a comment or filename naming the library, cross-check the path against the library source
3. Flag any mismatch as a fabricated icon (Critical)

## What sidecoach is currently missing

1. **Flow G (component-implementation) does not enforce verbatim paths.** Generated components sometimes embed approximated SVGs. Need a `verify-icon-against-library.ts` utility.
2. **No cross-library mixing detector.** Multiple icon families can land in a project without a guardrail catching it.
3. **No semantic-intent vs visual-guess check.** Sidecoach does not currently validate that the icon NAME matches the intent it should represent (e.g., a "home" icon used for "building").
4. **Animated-vs-static decision logic is absent.** Sidecoach does not currently route animated icons only to state-change / interaction / attention contexts.
5. **No DESIGN.md `iconLibrary` token check.** Sidecoach should read DESIGN.md's icon library token first and route all icon decisions through it.

## Gaps in the skill itself

- The skill describes the protocol but ships no programmatic enforcement. Sidecoach can implement the enforcement layer.
- No structured data for which icons exist in each library at which weight - lookups still require live web/repo fetches.
- No fingerprint/hash file for known-good library paths (would enable byte-for-byte verification offline).
