# Impeccable ux-writing.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# UX Writing

## The Button Label Problem

**Never use "OK", "Submit", or "Yes/No".** These are lazy and ambiguous. Use specific verb + object patterns:

| Bad | Good | Why |
|-----|------|-----|
| OK | Save changes | Says what will happen |
| Submit | Create account | Outcome-focused |
| Yes | Delete message | Confirms the action |
| Cancel | Keep editing | Clarifies what "cancel" means |
| Click here | Download PDF | Describes the destination |

**For destructive actions**, name the destruction:
- "Delete" not "Remove" (delete is permanent, remove implies recoverable)
- "Delete 5 items" not "Delete selected" (show the count)

## Error Messages: The Formula

Every error message should answer: (1) What happened? (2) Why? (3) How to fix it? Example: "Email address isn't valid. Please include an @ symbol." not "Invalid input".

### Error Message Templates

| Situation | Template |
|-----------|----------|
| **Format error** | "[Field] needs to be [format]. Example: [example]" |
| **Missing required** | "Please enter [what's missing]" |
| **Permission denied** | "You don't have access to [thing]. [What to do instead]" |
| **Network error** | "We couldn't reach [thing]. Check your connection and [action]." |
| **Server error** | "Something went wrong on our end. We're looking into it. [Alternative action]" |

### Don't Blame the User

Reframe errors: "Please enter a date in MM/DD/YYYY format" not "You entered an invalid date".

## Empty States Are Opportunities

Empty states are onboarding moments: (1) Acknowledge briefly, (2) Explain the value of filling it, (3) Provide a clear action. "No projects yet. Create your first one to get started." not just "No items".

## Voice vs Tone

**Voice** is your brand's personality, consistent everywhere.
**Tone** adapts to the moment.

| Moment | Tone Shift |
|--------|------------|
| Success | Celebratory, brief: "Done! Your changes are live." |
| Error | Empathetic, helpful: "That didn't work. Here's what to try..." |
| Loading | Reassuring: "Saving your work..." |
| Destructive confirm | Serious, clear: "Delete this project? This can't be undone." |

**Never use humor for errors.** Users are already frustrated. Be helpful, not cute.

## Writing for Accessibility

**Link text** must have standalone meaning: "View pricing plans" not "Click here". **Alt text** describes information, not the image: "Revenue increased 40% in Q4" not "Chart". Use `alt=""` for decorative images. **Icon buttons** need `aria-label` for screen reader context.

## Writing for Translation

### Plan for Expansion

German text is ~30% longer than English. Allocate space:

| Language | Expansion |
|----------|-----------|
| German | +30% |
| French | +20% |
| Finnish | +30-40% |
| Chinese | -30% (fewer chars, but same width) |

### Translation-Friendly Patterns

Keep numbers separate ("New messages: 3" not "You have 3 new messages"). Use full sentences as single strings (word order varies by language). Avoid abbreviations ("5 minutes ago" not "5 mins ago"). Give translators context about where strings appear.

## Consistency: The Terminology Problem

Pick one term and stick with it:

| Inconsistent | Consistent |
|--------------|------------|
| Delete / Remove / Trash | Delete |
| Settings / Preferences / Options | Settings |
| Sign in / Log in / Enter | Sign in |
| Create / Add / New | Create |

Build a terminology glossary and enforce it. Variety creates confusion.

## Avoid Redundant Copy

If the heading explains it, the intro is redundant. If the button is clear, don't explain it again. Say it once, say it well.

## Loading States

Be specific: "Saving your draft..." not "Loading...". For long waits, set expectations ("This usually takes 30 seconds") or show progress.

## Confirmation Dialogs: Use Sparingly

Most confirmation dialogs are design failures; consider undo instead. When you must confirm: name the action, explain consequences, use specific button labels ("Delete project" / "Keep project", not "Yes" / "No").

## Form Instructions

Show format with placeholders, not instructions. For non-obvious fields, explain why you're asking.

---

**Avoid**: Jargon without explanation. Blaming users ("You made an error" -> "This field is required"). Vague errors ("Something went wrong"). Varying terminology for variety. Humor for errors.

## EXTENSION

### Button-label sub-categories (prescribed verbs)

| Intent | Verb pattern | Examples |
|---|---|---|
| Create new | Create / New / Add | "Create project", "Add member" |
| Save current | Save / Update / Apply | "Save changes", "Update profile" |
| Confirm action | Specific verb + noun | "Send invitation", "Publish post" |
| Destructive | Delete / Remove + count + noun | "Delete 3 items" (Delete is permanent; Remove is reversible) |
| Cancel non-destructive | Cancel / Keep editing / Discard | "Cancel" or "Keep editing" (more specific) |
| Continue / Next | Continue to X / Go to Y | "Continue to checkout" |
| Acknowledge | Got it / OK / Dismiss | "Got it, thanks" |

For destructive batch actions, always show count: "Delete 3 items" > "Delete selected".

### Error-message anti-blame rewrites

| Blamey | Empathetic |
|---|---|
| "You entered an invalid email" | "Please enter a valid email address. Example: name@example.com" |
| "You made an error" | "This field is required" |
| "Your password is wrong" | "Password doesn't match. Forgot it?" |
| "You can't do that" | "This action isn't available right now. Try again in a moment, or contact support." |
| "Invalid input" | "[Field] needs to be [format]. You entered: [shortened value]" |

Pattern: replace "you" with the field name or system action; lead with the fix.

### Voice / tone differentiation (concrete)

Voice (consistent): "specific, earned, unmistakable"
Tone shifts by moment:

| Moment | Voice (constant) | Tone (variable) |
|---|---|---|
| Success | specific, earned, unmistakable | Brief and confident: "Done. Settings saved." |
| Error | specific, earned, unmistakable | Helpful and direct: "We hit an issue uploading. Try again." |
| Empty state | specific, earned, unmistakable | Welcoming and clear: "Nothing here yet. Add your first item." |
| Destructive confirm | specific, earned, unmistakable | Serious and specific: "Delete Project Alpha? This can't be undone." |
| Loading | specific, earned, unmistakable | Plain and informative: "Crunching last week's data..." |

Voice stays the same; only tone (warmth, brevity, register) shifts.

### Terminology glossary template (per project)

```markdown
# UX Writing Glossary

## Verbs

- **Create** (not Add, New): for first-time creation
- **Save** (not Submit, Confirm): for persistence of changes
- **Delete** (not Remove, Trash): for permanent destruction
- **Sign in** / **Sign out** (not Log in / Out, Enter / Exit)

## Nouns

- **Project** (not Workspace, Folder, Container): the user's top-level work unit
- **Member** (not User, Person, Team Member): a person in the project
- **Settings** (not Preferences, Options, Config)

## Don't use

- "Click here", "Submit", "OK", "Yes/No" buttons
- "Something went wrong" (always specify)
- "Invalid" (always explain what's valid)
```

Commit this to the repo; review at every PR.

### Pluralization recipe (i18n-friendly)

```javascript
// Bad: assumes English suffix
`${count} item${count !== 1 ? 's' : ''}`

// Better: use Intl.PluralRules
const pr = new Intl.PluralRules(locale);
const rule = pr.select(count); // 'one', 'other', etc.
const phrase = {
  one: `${count} item`,
  other: `${count} items`,
}[rule];

// Best: use a proper i18n library (i18next, react-intl, formatjs)
t('items', { count })
// Handles Polish (3 plural forms), Arabic (6 plural forms), etc.
```

## WHAT'S MISSING

- **No real microcopy library.** Empty states, error states, success states by category - implementation patterns implied but not catalogued.
- **No tone-by-product-class.** Banking vs consumer vs B2B - tone differs hugely but not addressed.
- **No relationship to PRODUCT.md brand personality.** Voice should flow from PRODUCT.md; cross-reference is light.
- **No "writing with constraints" patterns.** SMS-limit copy, push-notification length, app-store description - all have hard limits; none addressed.
- **No editorial-style guide reference.** AP Style, Chicago, internal house styles - not cross-referenced.
