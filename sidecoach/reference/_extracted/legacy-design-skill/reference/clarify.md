# Impeccable clarify.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

> **Additional context needed**: audience technical level and users' mental state in context.

Find the unclear, confusing, or poorly written interface text and rewrite it. Vague copy creates support tickets and abandonment; specific copy gets users through the task.


---

## Assess Current Copy

Identify what makes the text unclear or ineffective:

1. **Find clarity problems**:
   - **Jargon**: Technical terms users won't understand
   - **Ambiguity**: Multiple interpretations possible
   - **Passive voice**: "Your file has been uploaded" vs "We uploaded your file"
   - **Length**: Too wordy or too terse
   - **Assumptions**: Assuming user knowledge they don't have
   - **Missing context**: Users don't know what to do or why
   - **Tone mismatch**: Too formal, too casual, or inappropriate for situation

2. **Understand the context**:
   - Who's the audience? (Technical? General? First-time users?)
   - What's the user's mental state? (Stressed during error? Confident during success?)
   - What's the action? (What do we want users to do?)
   - What's the constraint? (Character limits? Space limitations?)

**CRITICAL**: Clear copy helps users succeed. Unclear copy creates frustration, errors, and support tickets.

## Plan Copy Improvements

Create a strategy for clearer communication:

- **Primary message**: What's the ONE thing users need to know?
- **Action needed**: What should users do next (if anything)?
- **tone**: How should this feel? (Helpful? Apologetic? Encouraging?)
- **Constraints**: Length limits, brand voice, localization considerations

**IMPORTANT**: Good UX writing is invisible. Users should understand immediately without noticing the words.

## Improve Copy Systematically

Refine text across these common areas:

### Error Messages
**Bad**: "Error 403: Forbidden"
**Good**: "You don't have permission to view this page. Contact your admin for access."

**Bad**: "Invalid input"
**Good**: "Email addresses need an @ symbol. Try: name@example.com"

**Principles**:
- Explain what went wrong in plain language
- Suggest how to fix it
- Don't blame the user
- Include examples when helpful
- Link to help/support if applicable

### Form Labels & Instructions
**Bad**: "DOB (MM/DD/YYYY)"
**Good**: "Date of birth" (with placeholder showing format)

**Bad**: "Enter value here"
**Good**: "Your email address" or "Company name"

**Principles**:
- Use clear, specific labels (not generic placeholders)
- Show format expectations with examples
- Explain why you're asking (when not obvious)
- Put instructions before the field, not after
- Keep required field indicators clear

### Button & CTA Text
**Bad**: "Click here" | "Submit" | "OK"
**Good**: "Create account" | "Save changes" | "Got it, thanks"

**Principles**:
- Describe the action specifically
- Use active voice (verb + noun)
- Match user's mental model
- Be specific ("Save" is better than "OK")

### Help Text & Tooltips
**Bad**: "This is the username field"
**Good**: "Choose a username. You can change this later in Settings."

**Principles**:
- Add value (don't just repeat the label)
- Answer the implicit question ("What is this?" or "Why do you need this?")
- Keep it brief but complete
- Link to detailed docs if needed

### Empty States
**Bad**: "No items"
**Good**: "No projects yet. Create your first project to get started."

**Principles**:
- Explain why it's empty (if not obvious)
- Show next action clearly
- Make it welcoming, not dead-end

### Success Messages
**Bad**: "Success"
**Good**: "Settings saved! Your changes will take effect immediately."

**Principles**:
- Confirm what happened
- Explain what happens next (if relevant)
- Be brief but complete
- Match the user's emotional moment (celebrate big wins)

### Loading States
**Bad**: "Loading..." (for 30+ seconds)
**Good**: "Analyzing your data... this usually takes 30-60 seconds"

**Principles**:
- Set expectations (how long?)
- Explain what's happening (when it's not obvious)
- Show progress when possible
- Offer escape hatch if appropriate ("Cancel")

### Confirmation Dialogs
**Bad**: "Are you sure?"
**Good**: "Delete 'Project Alpha'? This can't be undone."

**Principles**:
- State the specific action
- Explain consequences (especially for destructive actions)
- Use clear button labels ("Delete project" not "Yes")
- Don't overuse confirmations (only for risky actions)

### Navigation & Wayfinding
**Bad**: Generic labels like "Items" | "Things" | "Stuff"
**Good**: Specific labels like "Your projects" | "Team members" | "Settings"

**Principles**:
- Be specific and descriptive
- Use language users understand (not internal jargon)
- Make hierarchy clear
- Consider information scent (breadcrumbs, current location)

## Apply Clarity Principles

Every piece of copy should follow these rules:

1. **Be specific**: "Enter email" not "Enter value"
2. **Be concise**: Cut unnecessary words (but don't sacrifice clarity)
3. **Be active**: "Save changes" not "Changes will be saved"
4. **Be human**: "Oops, something went wrong" not "System error encountered"
5. **Tell users what to do**, not just what happened
6. **Be consistent**: Use same terms throughout (don't vary for variety)

**NEVER**:
- Use jargon without explanation
- Blame users ("You made an error" -> "This field is required")
- Be vague ("Something went wrong" without explanation)
- Use passive voice unnecessarily
- Write overly long explanations (be concise)
- Use humor for errors (be empathetic instead)
- Assume technical knowledge
- Vary terminology (pick one term and stick with it)
- Repeat information (headers restating intros, redundant explanations)
- Use placeholders as the only labels (they disappear when users type)

## Verify Improvements

Test that copy improvements work:

- **Comprehension**: Can users understand without context?
- **Actionability**: Do users know what to do next?
- **Brevity**: Is it as short as possible while remaining clear?
- **Consistency**: Does it match terminology elsewhere?
- **Tone**: Is it appropriate for the situation?

When the copy reads cleanly, hand off to `/impeccable polish` for the final pass.

## EXTENSION

### Cut-by-half rule, applied

Take any sentence in the UI. Cut it in half. Did clarity suffer? If no, the original was bloated.

Worked example:

- Original: "Your changes have been saved successfully and will take effect the next time you refresh the page."
- Halved: "Your changes are saved. Refresh to see them."
- Halved again: "Saved. Refresh to apply."

The third version is usually right. Sometimes the first cut is enough.

### Button-label template

Pattern: `verb + object` (or just verb for unambiguous contexts)

| Bad | Good |
|---|---|
| OK | Save changes |
| Submit | Create account |
| Yes | Delete message |
| Continue | Continue to checkout |
| Click here | Download invoice |
| Cancel | Keep editing |

For destructive actions, name the destruction: "Delete project" not "Remove" (remove implies recoverable).

For destructive batch actions, show count: "Delete 5 items" not "Delete selected".

### Error-message formula

Every error answers:
1. **What happened?** (in plain English)
2. **Why?** (when not obvious)
3. **How to fix it?** (concrete next action)

Templates:

| Class | Template |
|---|---|
| Format error | "[Field] needs to be [format]. Example: [example]" |
| Missing required | "Please enter [what's missing]" |
| Permission denied | "You don't have access to [thing]. [What to do instead]" |
| Network error | "We couldn't reach [thing]. Check your connection and [action]." |
| Server error | "Something went wrong on our end. We're looking into it. [Alternative action]" |
| Rate limit | "Too many tries. Wait [N] seconds and try again." |
| Validation | "[Field] must [requirement]. You entered: [shortened value]" |

### Terminology consistency map (build per project)

Pick one term and use it everywhere. Common decisions to make once:

| Choose one | Don't mix with |
|---|---|
| Delete | Remove, Trash |
| Sign in | Log in, Enter |
| Settings | Preferences, Options |
| Create | Add, New |
| Account | Profile, User |
| Team | Workspace, Organization |
| Subscription | Plan, Membership |

Build this into the project's voice guidelines, then enforce in PRs.

## WHAT'S MISSING

- **No tone-by-moment template.** Says "match the user's emotional moment" but no library of moments mapped to tone shifts.
- **No internationalization-of-copy.** Translation-friendly patterns mentioned in ux-writing.md; not cross-referenced.
- **No A/B test patterns.** Copy is high-leverage to test; doc treats it as solo work.
- **No micro-copy catalog (success-toasts, hover-tooltips).** Patterns enumerated but no canonical phrasing library.
- **No voice / tone document handoff.** A brand has voice; how does that bake into copy? Not addressed.
