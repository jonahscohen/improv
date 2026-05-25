# Impeccable personas.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Persona-Based Design Testing

Test the interface through the eyes of 5 distinct user archetypes. Each persona exposes different failure modes that a single "design director" perspective would miss.

**How to use**: Select 2-3 personas most relevant to the interface being critiqued. Walk through the primary user action as each persona. Report specific red flags, not generic concerns.

---

## 1. Impatient Power User: "Alex"


**Profile**: Expert with similar products. Expects efficiency, hates hand-holding. Will find shortcuts or leave.

**Behaviors**:
- Skips all onboarding and instructions
- Looks for keyboard shortcuts immediately
- Tries to bulk-select, batch-edit, and automate
- Gets frustrated by required steps that feel unnecessary
- Abandons if anything feels slow or patronizing

**Test Questions**:
- Can Alex complete the core task in under 60 seconds?
- Are there keyboard shortcuts for common actions?
- Can onboarding be skipped entirely?
- Do modals have keyboard dismiss (Esc)?
- Is there a "power user" path (shortcuts, bulk actions)?

**Red Flags** (report these specifically):
- Forced tutorials or unskippable onboarding
- No keyboard navigation for primary actions
- Slow animations that can't be skipped
- One-item-at-a-time workflows where batch would be natural
- Redundant confirmation steps for low-risk actions

---

## 2. Confused First-Timer: "Jordan"

**Profile**: Never used this type of product. Needs guidance at every step. Will abandon rather than figure it out.

**Behaviors**:
- Reads all instructions carefully
- Hesitates before clicking anything unfamiliar
- Looks for help or support constantly
- Misunderstands jargon and abbreviations
- Takes the most literal interpretation of any label

**Test Questions**:
- Is the first action obviously clear within 5 seconds?
- Are all icons labeled with text?
- Is there contextual help at decision points?
- Does terminology assume prior knowledge?
- Is there a clear "back" or "undo" at every step?

**Red Flags** (report these specifically):
- Icon-only navigation with no labels
- Technical jargon without explanation
- No visible help option or guidance
- Ambiguous next steps after completing an action
- No confirmation that an action succeeded

---

## 3. Accessibility-Dependent User: "Sam"

**Profile**: Uses screen reader (VoiceOver/NVDA), keyboard-only navigation. May have low vision, motor impairment, or cognitive differences.

**Behaviors**:
- Tabs through the interface linearly
- Relies on ARIA labels and heading structure
- Cannot see hover states or visual-only indicators
- Needs adequate color contrast (4.5:1 minimum)
- May use browser zoom up to 200%

**Test Questions**:
- Can the entire primary flow be completed keyboard-only?
- Are all interactive elements focusable with visible focus indicators?
- Do images have meaningful alt text?
- Is color contrast WCAG AA compliant (4.5:1 for text)?
- Does the screen reader announce state changes (loading, success, errors)?

**Red Flags** (report these specifically):
- Click-only interactions with no keyboard alternative
- Missing or invisible focus indicators
- Meaning conveyed by color alone (red = error, green = success)
- Unlabeled form fields or buttons
- Time-limited actions without extension option
- Custom components that break screen reader flow

---

## 4. Deliberate Stress Tester: "Riley"

**Profile**: Methodical user who pushes interfaces beyond the happy path. Tests edge cases, tries unexpected inputs, and probes for gaps in the experience.

**Behaviors**:
- Tests edge cases intentionally (empty states, long strings, special characters)
- Submits forms with unexpected data (emoji, RTL text, very long values)
- Tries to break workflows by navigating backwards, refreshing mid-flow, or opening in multiple tabs
- Looks for inconsistencies between what the UI promises and what actually happens
- Documents problems methodically

**Test Questions**:
- What happens at the edges (0 items, 1000 items, very long text)?
- Do error states recover gracefully or leave the UI in a broken state?
- What happens on refresh mid-workflow? Is state preserved?
- Are there features that appear to work but produce broken results?
- How does the UI handle unexpected input (emoji, special chars, paste from Excel)?

**Red Flags** (report these specifically):
- Features that appear to work but silently fail or produce wrong results
- Error handling that exposes technical details or leaves UI in a broken state
- Empty states that show nothing useful ("No results" with no guidance)
- Workflows that lose user data on refresh or navigation
- Inconsistent behavior between similar interactions in different parts of the UI

---

## 5. Distracted Mobile User: "Casey"

**Profile**: Using phone one-handed on the go. Frequently interrupted. Possibly on a slow connection.

**Behaviors**:
- Uses thumb only; prefers bottom-of-screen actions
- Gets interrupted mid-flow and returns later
- Switches between apps frequently
- Has limited attention span and low patience
- Types as little as possible, prefers taps and selections

**Test Questions**:
- Are primary actions in the thumb zone (bottom half of screen)?
- Is state preserved if the user leaves and returns?
- Does it work on slow connections (3G)?
- Can forms use autocomplete and smart defaults?
- Are touch targets at least 44x44pt?

**Red Flags** (report these specifically):
- Important actions positioned at the top of the screen (unreachable by thumb)
- No state persistence; progress lost on tab switch or interruption
- Large text inputs required where selection would work
- Heavy assets loading on every page (no lazy loading)
- Tiny tap targets or targets too close together

---

## Selecting Personas

Choose personas based on the interface type:

| Interface Type | Primary Personas | Why |
|---------------|-----------------|-----|
| Landing page / marketing | Jordan, Riley, Casey | First impressions, trust, mobile |
| Dashboard / admin | Alex, Sam | Power users, accessibility |
| E-commerce / checkout | Casey, Riley, Jordan | Mobile, edge cases, clarity |
| Onboarding flow | Jordan, Casey | Confusion, interruption |
| Data-heavy / analytics | Alex, Sam | Efficiency, keyboard nav |
| Form-heavy / wizard | Jordan, Sam, Casey | Clarity, accessibility, mobile |

---

## Project-Specific Personas

If `CLAUDE.md` contains a `## Design Context` section (generated by `impeccable teach`), derive 1-2 additional personas from the audience and brand information:

1. Read the target audience description
2. Identify the primary user archetype not covered by the 5 predefined personas
3. Create a persona following this template:

```
### [Role]: "[Name]"

**Profile**: [2-3 key characteristics derived from Design Context]

**Behaviors**: [3-4 specific behaviors based on the described audience]

**Red Flags**: [3-4 things that would alienate this specific user type]
```

Only generate project-specific personas when real Design Context data is available. Don't invent audience details; use the 5 predefined personas when no context exists.

## EXTENSION

### Persona-to-failure-mode cheatsheet

| Persona | Catches what? |
|---|---|
| Alex (Power User) | Inefficiency, hand-holding, lack of shortcuts, no batch ops |
| Jordan (First-Timer) | Jargon, unclear next steps, missing help, icon-only nav |
| Sam (A11y) | Keyboard inaccessibility, missing focus rings, low contrast, color-only meaning |
| Riley (Stress Tester) | Edge cases, broken states, lost user data, silent failures |
| Casey (Distracted Mobile) | Thumb-zone violations, lost state on interrupt, slow on 3G, tiny targets |

A critique that only uses Alex and Jordan misses accessibility and resilience. Always include Sam if a11y matters, Riley if data integrity matters, Casey if mobile is a primary surface.

### How to write a project-specific persona well

Bad (generic):
```
### Founder: "Pat"
**Profile**: A startup founder.
**Behaviors**: Uses the tool to do startup things.
**Red Flags**: If it's not founder-friendly.
```

Good (specific, derived from PRODUCT.md):
```
### Solo founder pre-Series A: "Pat"
**Profile**: 1-3 person team, juggling product / sales / design, 70-hr weeks, low patience for tools that add work
**Behaviors**:
- Uses 5+ tools per day; context-switches every 15 minutes
- Won't read docs; expects discovery through use
- Defaults to the cheapest free tier; tracks billing nervously
- Bookmarks everything; never deletes accounts even after churn
**Red Flags**:
- Setup that takes more than 10 minutes
- Pricing that's unclear or "Contact us" gated
- Features that require domain knowledge (DevOps, security, compliance) Pat doesn't have
- No mobile app or no mobile-friendly view for "check status from phone" moments
```

The good version is testable: "can Pat get to first value in 10 minutes?" is a real check.

### Walk-through pattern

For each selected persona:

1. State the persona's primary task on THIS surface ("Sam wants to filter the report and save the view")
2. Walk the actual UI step by step as that persona would experience it
3. List specific failures encountered, with exact element references (not generic concerns)
4. Suggest one concrete fix per failure

Example:
```
**Sam (A11y) walking through "Filter report and save view":**
1. Tabs to filter dropdown - FAIL: dropdown opens on click only, no Space/Enter handler. Fix: add keyboard handler.
2. Cycles through filter options with arrow keys - FAIL: arrow keys don't navigate within the listbox. Fix: implement roving tabindex.
3. Tabs to "Save view" button - PASS: focusable with visible ring.
4. Activates Save - FAIL: no success announcement. Screen reader silent. Fix: aria-live region for state changes.
```

The specificity is the deliverable. "Improve a11y" isn't a finding; "the filter dropdown lacks keyboard handlers on lines 47-58 of FilterDropdown.tsx" is.

## WHAT'S MISSING

- **No persona for "the buyer who isn't the user."** Enterprise software has buyer personas distinct from user personas; not addressed.
- **No "user with cognitive load" persona.** Sam covers physical accessibility but not cognitive (dyslexia, ADHD, low working memory).
- **No "user under time pressure" beyond Casey.** Emergency-room nurse using a clinical tool has a different urgency profile than distracted-mobile.
- **No persona for batch / data-entry users.** Heavy CRM data entry, transcription, moderation - distinct from Alex's power-user pattern.
- **Persona selection table is hardcoded.** Cannot encode "this product is for kids" or "this product is for elderly users" outside the 5 + 2 framework.
