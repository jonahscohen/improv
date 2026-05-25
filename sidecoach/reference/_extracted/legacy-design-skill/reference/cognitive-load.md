# Impeccable cognitive-load.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Cognitive Load Assessment

Cognitive load is the total mental effort required to use an interface. Overloaded users make mistakes, get frustrated, and leave. This reference helps identify and fix cognitive overload.

---

## Three Types of Cognitive Load

### Intrinsic Load: The Task Itself
Complexity inherent to what the user is trying to do. You can't eliminate this, but you can structure it.

**Manage it by**:
- Breaking complex tasks into discrete steps
- Providing scaffolding (templates, defaults, examples)
- Progressive disclosure: show what's needed now, hide the rest
- Grouping related decisions together

### Extraneous Load: Bad Design
Mental effort caused by poor design choices. **Eliminate this ruthlessly.** It's pure waste.

**Common sources**:
- Confusing navigation that requires mental mapping
- Unclear labels that force users to guess meaning
- Visual clutter competing for attention
- Inconsistent patterns that prevent learning
- Unnecessary steps between user intent and result

### Germane Load: Learning Effort
Mental effort spent building understanding. This is *good* cognitive load; it leads to mastery.

**Support it by**:
- Progressive disclosure that reveals complexity gradually
- Consistent patterns that reward learning
- Feedback that confirms correct understanding
- Onboarding that teaches through action, not walls of text

---

## Cognitive Load Checklist

Evaluate the interface against these 8 items:

- [ ] **Single focus**: Can the user complete their primary task without distraction from competing elements?
- [ ] **Chunking**: Is information presented in digestible groups (at most 4 items per group)?
- [ ] **Grouping**: Are related items visually grouped together (proximity, borders, shared background)?
- [ ] **Visual hierarchy**: Is it immediately clear what's most important on the screen?
- [ ] **One thing at a time**: Can the user focus on a single decision before moving to the next?
- [ ] **Minimal choices**: Are decisions simplified (at most 4 visible options at any decision point)?
- [ ] **Working memory**: Does the user need to remember information from a previous screen to act on the current one?
- [ ] **Progressive disclosure**: Is complexity revealed only when the user needs it?

**Scoring**: Count the failed items. 0-1 failures = low cognitive load (good). 2-3 = moderate (address soon). 4+ = high cognitive load (critical fix needed).

---

## The Working Memory Rule

**Humans can hold at most 4 items in working memory at once** (Miller's Law revised by Cowan, 2001).

At any decision point, count the number of distinct options, actions, or pieces of information a user must simultaneously consider:
- **at most 4 items**: Within working memory limits, manageable
- **5-7 items**: Pushing the boundary; consider grouping or progressive disclosure
- **8+ items**: Overloaded; users will skip, misclick, or abandon

**Practical applications**:
- Navigation menus: at most 5 top-level items (group the rest under clear categories)
- Form sections: at most 4 fields visible per group before a visual break
- Action buttons: 1 primary, 1-2 secondary, group the rest in a menu
- Dashboard widgets: at most 4 key metrics visible without scrolling
- Pricing tiers: at most 3 options (more causes analysis paralysis)

---

## Common Cognitive Load Violations

### 1. The Wall of Options
**Problem**: Presenting 10+ choices at once with no hierarchy.
**Fix**: Group into categories, highlight recommended, use progressive disclosure.

### 2. The Memory Bridge
**Problem**: User must remember info from step 1 to complete step 3.
**Fix**: Keep relevant context visible, or repeat it where it's needed.

### 3. The Hidden Navigation
**Problem**: User must build a mental map of where things are.
**Fix**: Always show current location (breadcrumbs, active states, progress indicators).

### 4. The Jargon Barrier
**Problem**: Technical or domain language forces translation effort.
**Fix**: Use plain language. If domain terms are unavoidable, define them inline.

### 5. The Visual Noise Floor
**Problem**: Every element has the same visual weight; nothing stands out.
**Fix**: Establish clear hierarchy: one primary element, 2-3 secondary, everything else muted.

### 6. The Inconsistent Pattern
**Problem**: Similar actions work differently in different places.
**Fix**: Standardize interaction patterns. Same type of action = same type of UI.

### 7. The Multi-Task Demand
**Problem**: Interface requires processing multiple simultaneous inputs (reading + deciding + navigating).
**Fix**: Sequence the steps. Let the user do one thing at a time.

### 8. The Context Switch
**Problem**: User must jump between screens/tabs/modals to gather info for a single decision.
**Fix**: Co-locate the information needed for each decision. Reduce back-and-forth.

## EXTENSION

### Scoring rubric: how to apply the 8-item checklist

For each surface evaluated, walk the checklist:

```
[ ] Single focus          (1 = clear primary task; 0 = competing primaries)
[ ] Chunking              (1 = ≤4 per group; 0 = walls of items)
[ ] Grouping              (1 = related items visually together; 0 = scattered)
[ ] Visual hierarchy      (1 = primary obvious in 2 sec; 0 = flat)
[ ] One thing at a time   (1 = sequential decisions; 0 = parallel choices)
[ ] Minimal choices       (1 = ≤4 visible at any moment; 0 = too many options)
[ ] Working memory        (1 = no cross-screen recall; 0 = remember + act)
[ ] Progressive disclosure (1 = complexity hidden until needed; 0 = everything visible)

Sum: 8 - failures = score / 8
```

| Score | Verdict |
|---|---|
| 7-8 | Low load (good) |
| 5-6 | Moderate load (address) |
| 0-4 | High load (critical fix) |

### Working-memory thresholds, with concrete UI prescriptions

| Surface | Cap | If over, do |
|---|---|---|
| Top-level navigation | 5 items | Group under "More" or category headers |
| Form section before visual break | 4 fields | Add subhead or accordion |
| Primary/secondary action cluster | 1 primary + 2 secondary | Put rest behind "..." menu |
| Dashboard widgets above fold | 4 metrics | Make some tertiary or below-fold |
| Pricing tiers | 3 options | Hide rarely-chosen tiers; analysis paralysis is real |
| Onboarding steps | 3 steps | Compress or move to in-app discovery |
| Visible filters/facets | 4-6 | Behind "More filters" toggle |

### Progressive-disclosure pattern catalog

| Disclosure UI | Best for |
|---|---|
| Accordion / expandable | Settings sections, FAQs |
| Tabs | Equal-weight alternative views (Code / Preview / Settings) |
| Disclosure toggle ("Show advanced") | Power-user options |
| Modal / sheet | Focused secondary tasks |
| Drawer | Persistent secondary panel (filters, details) |
| Pagination | Long lists where order matters |
| Infinite scroll | Long lists where exploration matters |
| Search-and-filter | Long lists where finding matters |

Pick by user task, not by "what looks designed."

## WHAT'S MISSING

- **No measurement.** Self-scored checklist; no actual cognitive-load measurement (eye tracking, NASA-TLX surveys, task-time).
- **No connection to information architecture.** Cognitive load is mostly an IA problem; doc focuses on screen-level treatment.
- **No "is this the user's job" reframing.** Sometimes the load is intrinsic and the right fix is removing the task, not redesigning it.
- **No advice for power-user surfaces.** Some users want dense, high-cognitive-load tools; doc treats all users as load-averse.
