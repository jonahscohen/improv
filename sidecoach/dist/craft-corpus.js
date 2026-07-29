"use strict";
// Craft corpus - the generalized TEACHING layer for every sidecoach verb.
//
// WHY THIS FILE EXISTS.
//
// `polish-craft.ts` fixed the `polish` verb: its payload now opens with a CRAFT BRIEF selected from
// the rules that actually failed, each note carrying what good looks like, why it matters, and the
// fix with real values. Measured 2026-07-29, it was the ONLY verb of 26 whose payload taught
// anything - `grep -rln "polish-craft" src/flow-handler*.ts` returned exactly one file. Ten other
// handlers imported `design-laws.ts`, but what they pulled out were defect DESCRIPTIONS: the name of
// the thing being checked, restated. A producer handed a list of rule names satisfies the rule names
// and improves nothing else, which is what the efficacy trial measured.
//
// This module generalizes the working half of polish-craft so any flow can teach:
//
//   1. It covers the REST of the rule registry. polish-craft carries notes for the 24
//      `polish-standard:N` rules; the registry defines 60 that `craft-probe` can actually evaluate.
//      The 36 here close that gap, so every rule a probe can FAIL has teaching content and
//      `registryCraftGaps()` is empty as an enforced invariant.
//   2. It reaches the LAW corpus in `craft-laws.ts` for flows that run before there is a page to
//      measure, where the up-front standard is the whole deliverable.
//   3. It renders one brief format for both, so a reader who has seen a polish brief can read an
//      accessibility brief without relearning the layout.
//
// WHAT IS DELIBERATELY PRESERVED FROM THE REFERENCE IMPLEMENTATION.
//
//   - TEACH then CHECK. The brief opens the payload and a FINDINGS boundary follows it.
//   - Selection by what FAILED, hardest-first, capped, with the cap disclosed inside the payload. A
//     rule that passed contributes nothing and a clean page gets no brief.
//   - Every note names its in-repo source, so the instruction is traceable rather than invented.
//     Unlike the reference, the brief PRINTS that source: a reader who wants the long form should be
//     able to find it without grepping, and a claim with a citation is checkable.
//   - The detector half is never weakened. This module only produces lines; nothing here changes a
//     verdict.
//
// WHAT IS NEW, AND WHY.
//
//   - `severity` on the note. Registry rules rank by their registry severity, which law notes do not
//     have. Carrying it explicitly lets one comparator order both, instead of law notes silently
//     sorting last as "unranked" and never being taught when a brief is capped.
//   - The `mode` on the brief header. A findings-driven brief and an up-front brief are different
//     claims about provenance, and a payload that blurs them is telling the reader a measurement
//     happened when it did not. Both say which they are, in their first two lines.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BRIEF_EXAMPLES = exports.MAX_BRIEF_NOTES = exports.REGISTRY_CRAFT = void 0;
exports.resolveCraftNote = resolveCraftNote;
exports.craftSeverityRank = craftSeverityRank;
exports.registryCraftGaps = registryCraftGaps;
exports.selectCraftNotes = selectCraftNotes;
exports.craftBriefLines = craftBriefLines;
exports.craftRemediation = craftRemediation;
const polish_craft_1 = require("./polish-craft");
const craft_probe_1 = require("./craft-probe");
const CHECKS_DIR = 'src/validators/checks';
const TP = 'reference/_extracted/tactical-polish';
const BENCIUM = 'reference/_extracted/external/bencium-design';
const TYPEUI = 'reference/_extracted/external/typeui-fundamentals';
const RUI = 'reference/_extracted/external/refactoring-ui';
const LAWS = 'src/design-laws.ts';
/**
 * Craft notes for the registry rules `POLISH_CRAFT` does not cover.
 *
 * Keyed by canonical rule key, so a probe result maps straight onto a note. Coverage over the whole
 * registry is asserted by `registryCraftGaps()` and by `__tests__/craft-corpus.test.ts`: a rule
 * added to the registry without a note here fails a test rather than reaching a payload as a bare
 * defect name.
 */
exports.REGISTRY_CRAFT = {
    // ---------- page quality / performance ----------
    'perf/image-dimensions': {
        ruleKey: 'perf/image-dimensions',
        title: 'Reserve space for images',
        good: 'Every image declaring width and height, or an aspect-ratio, so the browser reserves its box before the bytes arrive.',
        why: 'Without reserved space the page reflows the moment each image decodes, so text the reader was already reading jumps, and a button they were reaching for moves out from under the pointer. This is the layout shift readers hate most because it punishes them for being fast.',
        fix: 'Set width and height attributes on every <img> to the intrinsic pixel size (CSS can still resize it), or declare aspect-ratio in CSS. Both approaches let the browser compute the box from the ratio before load. For a hero image add fetchpriority="high" as well so it is not queued behind lazy siblings.',
        example: '<img src="hero.jpg" width="1600" height="900" alt="..." fetchpriority="high">',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    'perf/image-lazy-load': {
        ruleKey: 'perf/image-lazy-load',
        title: 'Defer below-the-fold images',
        good: 'The first image loading eagerly and every later one deferred until it approaches the viewport.',
        why: 'Eager images below the fold compete for bandwidth with the one the reader can actually see, so the hero arrives later than it needs to. On a phone network that delay is the difference between a page that feels instant and one that feels broken.',
        fix: 'Add loading="lazy" to every <img> past the first in document order. Leave the first/hero image eager, and mark it fetchpriority="high" if it is the largest contentful paint. Where a later image is genuinely above the fold on some layout, mark that one fetchpriority="high" rather than removing lazy loading from all of them.',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    'polish/text-overflow-strategy': {
        ruleKey: 'polish/text-overflow-strategy',
        title: 'Long strings need a strategy',
        good: 'Any container that can receive arbitrary text declaring how it handles a string longer than its width.',
        why: 'The strings that break layouts are real and common: a pasted URL, a long email address, a German compound, a user-supplied name with no spaces. Without a strategy one of them widens the container and the whole row overflows horizontally.',
        fix: 'Add overflow-wrap: anywhere (or word-break: break-word) so an unbreakable string wraps rather than pushing the box. Where the design wants one line, pair text-overflow: ellipsis with overflow: hidden and white-space: nowrap - all three, since ellipsis alone does nothing. For multi-line truncation use -webkit-line-clamp with a line count. Test with a 60-character unbroken string.',
        example: '.cell { overflow-wrap: anywhere; }\n.one-line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    'polish/tiny-text': {
        ruleKey: 'polish/tiny-text',
        title: 'Readable text size',
        good: 'Content and interface text rendering at or near a 16px baseline, with small sizes reserved for genuine microcopy.',
        why: 'These are the sizes at which legibility actually fails rather than a stylistic preference. Small interface text also fails first for exactly the readers with the least slack, and unlike a contrast failure it is easy to miss on a high-resolution laptop.',
        fix: 'Raise body toward 16-18px (1rem to 1.125rem) with 14px the floor. Hold form labels and controls at 14-16px and never put 12px on anything interactive. Keep captions at 12-13px with 11px as the absolute floor. Size in rem so browser zoom still works.',
        source: `${TYPEUI}/typography-principles.md`,
    },
    'polish/marketing-buzzword': {
        ruleKey: 'polish/marketing-buzzword',
        title: 'Concrete claims, not buzzwords',
        good: 'Copy whose nouns and verbs are specific enough that substituting a competitor\'s name would make the sentence false.',
        why: 'Seamless, powerful, revolutionary and effortless are the predictable training-data default. They make a claim that cannot be checked, so they read as filler and cost trust in exactly the place the copy is trying to earn it.',
        fix: 'Replace each with something measurable or specific: what it does, to what, and what changes. "Deploys in one command" rather than "seamless deployment". Delete the sentence outright when there is no concrete claim under the adjective. Apply the substitution test to every line before shipping.',
        source: `${LAWS} (SHARED_DESIGN_LAWS.writing)`,
    },
    'polish/default-typeface': {
        ruleKey: 'polish/default-typeface',
        title: 'Set the content in a chosen face',
        good: 'Body copy rendering in the typeface the brand committed to, and that family actually reaching the text.',
        why: 'Type is the largest surface on most pages, so a page left on the browser default reads as unfinished even when every other decision on it is right. The second failure mode is subtler: a family is declared in tokens but never reaches the body, so the record and the render disagree.',
        fix: 'Apply the committed family to body and headings, then confirm it in the rendered page rather than in the stylesheet - a missing webfont falls back silently. When the document must stay self-contained, lead with a characterful OS-installed face (Iowan Old Style, Charter, Baskerville, Cambria; Optima, Avenir, Futura, Gill Sans) ahead of any generic fallback. If the page is right and the brand record is stale, update the record instead.',
        source: `${CHECKS_DIR}/rendered-checks.ts`,
    },
    // ---------- accessibility: rendered ----------
    'a11y/broken-image': {
        ruleKey: 'a11y/broken-image',
        title: 'No broken images',
        good: 'Every <img> resolving to a real file, with alt text that describes it.',
        why: 'A broken image is a hole in the page that also destroys the layout around it, and it is the single clearest signal to a reader that nobody looked at the result. It is invisible in source review and obvious in a render, which is why it survives so often.',
        fix: 'Give every image a valid src, or remove the element. Never ship an empty src="" - it resolves to the page URL and requests the document again. Write alt text describing the content for informative images and alt="" for decorative ones. Verify in a render, since a path that looks right relative to the source can still be wrong relative to the served route.',
        source: `${CHECKS_DIR}/rendered-checks.ts`,
    },
    'a11y/heading-order': {
        ruleKey: 'a11y/heading-order',
        title: 'Sequential heading levels',
        good: 'A heading outline that descends one level at a time, with size handled entirely in CSS.',
        why: 'Screen reader users navigate by heading level, so a jump from h1 to h4 reads as three missing sections and the outline stops describing the page. It happens because the level was chosen for its default size rather than its position in the structure.',
        fix: 'Choose the level from the document outline and set the size with a class. One h1 per page, then h2 for each major section, h3 inside those. Never skip a level to get a smaller size - name the size explicitly instead, for example a card title as h3 styled at 18px. Read the heading list on its own and check it reads as a table of contents.',
        source: `${CHECKS_DIR}/rendered-checks.ts`,
    },
    'a11y/gray-on-color': {
        ruleKey: 'a11y/gray-on-color',
        title: 'No grey text on colour',
        good: 'Text on a chromatic background carrying enough contrast against that actual background, not against the white it was designed on.',
        why: 'This is the most common way a page passes a spot check and fails a reader: the grey was chosen against white, then the section got a coloured surface, and nobody re-measured. Desaturated text on a saturated background loses contrast faster than the eye expects.',
        fix: 'Re-measure every text and background pair after any surface colour changes and raise the text until it clears 4.5:1 (3:1 at 24px or 19px bold). Prefer flipping the pairing - dark text on a light tint of the same hue - over darkening the background, which ends at near-black and loses the hue that carried the meaning. Do not fix it with opacity; lowering alpha lowers contrast.',
        source: `${CHECKS_DIR}/rendered-checks.ts`,
    },
    'a11y/justified-text': {
        ruleKey: 'a11y/justified-text',
        title: 'Do not justify body copy',
        good: 'Body text aligned to the start edge, with justification left to print typesetting that can hyphenate.',
        why: 'Justifying without hyphenation stretches word spaces to fill the line, producing vertical rivers of white that the eye follows downward instead of across. Readers with dyslexia lose the line entirely, which is why WCAG names it.',
        fix: 'Set text-align: start (or left) on body copy. If justification is genuinely required for the design, enable hyphens: auto and widen the measure toward 75ch so there is slack to distribute. Reserve centring for headlines and callouts of two lines or fewer.',
        source: `${CHECKS_DIR}/rendered-checks.ts`,
    },
    // ---------- accessibility: forms ----------
    'a11y/form-control-labelled': {
        ruleKey: 'a11y/form-control-labelled',
        title: 'Every control has its own label',
        good: 'Each form control carrying its own accessible name, so a screen reader announces what the field is for.',
        why: 'A control with no name is announced as "edit text" and the reader has no way to know what to type. One label elsewhere on the form does not cover a sibling control, which is how a mostly-labelled form still has an unusable field in it.',
        fix: 'Give each control a <label for> matching its id, or wrap it in its label, or set aria-label / aria-labelledby. A placeholder is not a label - it disappears on input and cannot serve as the accessible name. Submit, button, hidden, reset and image inputs are exempt. Check every control individually rather than confirming a label exists on the page.',
        example: '<label for="email">Work email</label>\n<input id="email" type="email" autocomplete="email">',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-error-association': {
        ruleKey: 'a11y/form-error-association',
        title: 'Associate errors with their field',
        good: 'An invalid field marked as invalid and pointed at the message that explains it.',
        why: 'A visible red message that is not programmatically associated is invisible to a screen reader, so the reader is told the submit failed with no way to find out which field or why. They are left retrying the same form blind.',
        fix: 'On error set aria-invalid="true" on the control and aria-describedby to the id of the message element. Keep the message next to the field, not only in a top-level summary. Move focus to the first invalid control on a failed submit so it is not missed.',
        example: '<input id="email" aria-invalid="true" aria-describedby="email-err">\n<p id="email-err">Enter an email with an @ in it.</p>',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-placeholder-not-label': {
        ruleKey: 'a11y/form-placeholder-not-label',
        title: 'Placeholder is not a label',
        good: 'A persistent visible label above the field, with the placeholder used only for a format hint.',
        why: 'The placeholder vanishes the moment the reader types, so they lose the question exactly while answering it and cannot re-read it to check. Placeholder text is also usually low contrast, so it fails on that ground too.',
        fix: 'Add a persistent <label> and keep it visible when the field has content. Use the placeholder only for an example format ("+44 7700 900000"), never for the field name. If the design cannot fit a label, a floating label that moves out of the way still qualifies; a placeholder that disappears does not.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-input-type': {
        ruleKey: 'a11y/form-input-type',
        title: 'Type the input to its content',
        good: 'Each field declaring the type of data it collects rather than defaulting every one to text.',
        why: 'The type is what makes a phone surface the right keyboard, so type="text" on an email field costs a mobile reader several taps to reach the @ sign. It also switches off the browser\'s free format validation.',
        fix: 'Use type="email", "tel", "url", "number", "search", "date" or "password" as the content requires. Pair numeric and one-time-code fields with inputmode="numeric" so the keypad appears, and set spellcheck="false" on email, username and code fields so they are not autocorrected.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-choice-label-target': {
        ruleKey: 'a11y/form-choice-label-target',
        title: 'Checkbox shares its label target',
        good: 'A checkbox or radio and its text behaving as one hit target, so clicking the words toggles the control.',
        why: 'A 16px checkbox is a target most thumbs miss, and when the adjacent text is not part of the target the reader\'s natural aim lands in a dead zone. The tap appears to do nothing, which reads as the control being broken.',
        fix: 'Wrap the input and its text in a single <label>, or link them with for and id. Then extend the combined hit area to at least 40x40px with padding rather than growing the box. Never leave an unclickable gap between the control and its text.',
        example: '<label><input type="checkbox" name="tos"> I accept the terms</label>',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-autocomplete': {
        ruleKey: 'a11y/form-autocomplete',
        title: 'Declare autocomplete tokens',
        good: 'Named fields declaring what they collect so the browser and password manager can fill them.',
        why: 'Autofill is an accessibility feature before it is a convenience: for readers with motor or memory impairments it is the difference between a form they can complete and one they cannot. Without the token the browser guesses from the field name and usually guesses wrong.',
        fix: 'Add the standard token to each field: autocomplete="email", "name", "tel", "street-address", "postal-code", "cc-number", "current-password", "new-password", "one-time-code". Use the specific token rather than "on". Never block paste - it breaks password managers outright - and do not name a non-password field "password" or managers will offer to save it.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-inputmode': {
        ruleKey: 'a11y/form-inputmode',
        title: 'Numeric fields need inputmode',
        good: 'Numeric and one-time-code fields surfacing a numeric keypad on a phone.',
        why: 'A code field that opens the full alphabetic keyboard costs the reader an extra tap per digit and puts the numbers on a secondary layer, which is the worst place for a value they are copying from a message they can no longer see.',
        fix: 'Add inputmode="numeric" for digit-only values, or inputmode="tel" for phone numbers where the reader may type separators. Keep type="text" with inputmode for codes so leading zeros survive, since type="number" strips them and adds spinners nobody wants. Add autocomplete="one-time-code" so the OS can offer the code directly.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-never-block-paste': {
        ruleKey: 'a11y/form-never-block-paste',
        title: 'Never block paste',
        good: 'Every field accepting a paste, including password and confirmation fields.',
        why: 'Blocking paste does not improve security - it forces readers off password managers and onto passwords they can type from memory, which are weaker. For readers using assistive tech or with motor impairments it can make the field impossible to complete at all.',
        fix: 'Remove the onPaste handler that calls preventDefault. If the intent was to stop a mismatched confirmation field, validate the two values instead of restricting input. There is no case where blocking paste is the right answer.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-spellcheck-off': {
        ruleKey: 'a11y/form-spellcheck-off',
        title: 'Disable spellcheck on codes',
        good: 'Email, username and one-time-code fields opting out of spellcheck and autocorrect.',
        why: 'Autocorrect silently rewrites an email address or a code into something that looks plausible and is wrong, and the reader is then told their correct input was invalid. The red underline on a legitimate username is separately alarming for no reason.',
        fix: 'Set spellcheck="false" on email, username, code and identifier fields. On mobile add autocapitalize="off" and autocorrect="off" as well, since spellcheck alone does not stop iOS capitalising the first letter of an email address.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-idempotent-submit': {
        ruleKey: 'a11y/form-idempotent-submit',
        title: 'Guard async submission',
        good: 'A form that submits asynchronously ignoring repeat presses while the first request is in flight.',
        why: 'Without a guard, a slow network turns one intent into two records - two orders, two invites, two charges. The reader is not being careless: the button gave no feedback, so pressing again is the reasonable thing to do.',
        fix: 'Track an in-flight state and return early from the handler while it is true. Reflect that state in the button (a spinner or a "Sending" label) so the reader knows the first press registered. For anything that creates or charges, send an idempotency key so a retry at the network layer cannot duplicate either.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-inline-errors': {
        ruleKey: 'a11y/form-inline-errors',
        title: 'Errors next to the field',
        good: 'Each validation failure shown at the field that caused it, not only summarised at the top.',
        why: 'A top-level summary makes the reader map an error message back onto a field themselves, and on a long form that means scrolling while holding the message in memory. Readers who zoom may not see the summary and the field in the same viewport at all.',
        fix: 'Render the message immediately after the control, associated with aria-invalid and aria-describedby. Keep a summary as well for long forms, with each entry linking to its field. Write the message as what happened, why, and how to fix it, and never blame the reader.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-focus-first-error': {
        ruleKey: 'a11y/form-focus-first-error',
        title: 'Focus the first error',
        good: 'A failed submit moving focus to the first invalid field.',
        why: 'Without it a keyboard or screen reader user is told the submit failed and left at the bottom of the form with no way to find the problem except tabbing through every field. Sighted readers on a zoomed viewport have the same problem.',
        fix: 'On validation failure call focus() on the first invalid control and scrollIntoView it. Announce the failure count in a live region at the same time so the reader knows how many remain. Do this on the field rather than on the summary, so the reader lands where the work is.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-no-pm-non-auth': {
        ruleKey: 'a11y/form-no-pm-non-auth',
        title: 'Reserved field names',
        good: 'Field names that describe their own content, with auth-reserved names used only for real credentials.',
        why: 'Password managers key off the field name, so a non-credential field called "password" makes the manager offer to save and later autofill a value that is not a password. The reader gets a fill prompt on an unrelated form and loses trust in both.',
        fix: 'Rename the field to what it actually holds - "access-code", "pin-hint", "secret-question" - and reserve name="password" for a type="password" credential. Set autocomplete="off" on the field as well if the manager still offers it.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-textarea-submit': {
        ruleKey: 'a11y/form-textarea-submit',
        title: 'Keyboard submit from a textarea',
        good: 'A textarea that can be submitted from the keyboard without reaching for the mouse.',
        why: 'Enter inserts a newline in a textarea, which is correct, so a composer with no keyboard submit forces every send through a pointer. For a high-frequency surface like a comment or chat box that is the slowest part of the interaction.',
        fix: 'Bind Cmd+Enter on macOS and Ctrl+Enter elsewhere to submit, and show the shortcut in the button or a hint near it so it is discoverable. Keep the pointer path working; this is an addition, not a replacement.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-no-pre-disable-submit': {
        ruleKey: 'a11y/form-no-pre-disable-submit',
        title: 'Do not pre-disable submit',
        good: 'A submit button that stays enabled and explains what is wrong when pressed.',
        why: 'A disabled button gives no feedback at all: the reader cannot tell whether the form is incomplete, which field is wrong, or whether the button is broken. It is also removed from the tab order, so a keyboard reader cannot even reach the thing that would tell them.',
        fix: 'Keep submit enabled, validate on submit, and surface the specific failures inline. Disabling until the form is dirty or a required step is complete is a legitimate different gate; disabling on validity is not. Do use the disabled state for an in-flight submit, where the reason is visible.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/form-autofocus-sparingly': {
        ruleKey: 'a11y/form-autofocus-sparingly',
        title: 'At most one autofocus',
        good: 'At most one autofocus on a page, on the field the reader came to fill.',
        why: 'Multiple autofocus targets fight each other and the winner is whichever parsed last, which is not a decision anyone made. Autofocus also jumps a screen reader past the page heading and any instructions above the field, so the reader loses the context that explains it.',
        fix: 'Keep autofocus on a single primary field, and only where the page exists to fill that field - a search page or a login form. Remove it from secondary inputs and from anything below the fold, since focusing an off-screen field scrolls the page unexpectedly.',
        source: `${CHECKS_DIR}/forms-checks.ts`,
    },
    'a11y/chart-text-fallback': {
        ruleKey: 'a11y/chart-text-fallback',
        title: 'Charts need a text path',
        good: 'Every chart reachable as text or a table, not only as pixels.',
        why: 'A canvas or an unlabelled SVG is completely opaque to a screen reader, so the data simply does not exist for that reader. It also disappears for anyone whose script fails to run, which is a broader group than it sounds.',
        fix: 'Provide the underlying numbers as a <table> (visually hidden if necessary), or an aria-label / aria-describedby summarising the trend and the extremes, or a <figcaption> stating what the chart shows. Do not rely on colour alone to distinguish series - add labels, patterns or direct annotation.',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    'a11y/button-label-specific': {
        ruleKey: 'a11y/button-label-specific',
        title: 'Specific button labels',
        good: 'Button text naming the action and its object, so it reads correctly out of context.',
        why: 'A screen reader can list every button on a page with no surrounding text, so a page of "Go", "Submit" and "OK" becomes unnavigable. Generic labels also force sighted readers to reconstruct the action from nearby copy every time.',
        fix: 'Replace OK, Submit, Go, Next, Done, Yes, No, Button and Click here with a verb plus its object: "Save changes", "Send invite", "Delete 5 items". Name the destruction in destructive actions rather than softening it. Give icon-only buttons the same phrase as an aria-label.',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    // ---------- theming ----------
    'theming/color-scheme-dark': {
        ruleKey: 'theming/color-scheme-dark',
        title: 'Declare the colour scheme',
        good: 'A page with a dark theme declaring color-scheme so native controls follow it.',
        why: 'The media query only styles what you wrote. Scrollbars, form field chrome, date pickers, spellcheck underlines and the canvas behind an overscroll are drawn by the browser, so without the declaration they stay light and the dark page has bright seams around its edges.',
        fix: 'Add color-scheme: dark on :root inside the dark branch, or color-scheme: light dark when both are supported and the theme follows the system. This is the CSS property, not the prefers-color-scheme media feature - you need both, one to pick your colours and one to tell the browser about its own.',
        example: ':root { color-scheme: light dark; }\n[data-theme="dark"] { color-scheme: dark; }',
        source: `${CHECKS_DIR}/page-quality-checks.ts`,
    },
    'theming/token-driven-interactive-state': {
        ruleKey: 'theming/token-driven-interactive-state',
        title: 'Token-driven interactive states',
        good: 'Hover, active and focus colours resolved from tokens in a project that already has a token system.',
        why: 'This is the exact failure that makes a dark theme look half-finished: the resting state adapts because it uses a token, the hover reverts to a light-mode hex, and the reader sees the seam the first time they move the pointer. It is also invisible until someone actually hovers.',
        fix: 'Replace the literal with a token reference - background: var(--c-brand-hover) rather than #2563eb. If the hover shade does not exist, add it to the ramp rather than inlining it once; a one-off hex in a state rule is how a second source of truth starts. The same applies to focus ring colour and disabled surfaces.',
        source: `${CHECKS_DIR}/theming-checks.ts`,
    },
    'theming/border-radius-consistency': {
        ruleKey: 'theming/border-radius-consistency',
        title: 'One radius scale',
        good: 'One or two named radius values used across the surface, with nested curves kept parallel.',
        why: 'Scattered radius literals are the single most common thing that makes an interface feel off, and it is almost never noticed consciously - the reader just senses the corners fighting. Mismatched nesting is the sharpest version of it.',
        fix: 'Define --radius-sm and --radius-md (plus --radius-full for pills) and reference them everywhere. When nesting, compute outerRadius = innerRadius + padding: an 8px button inside 4px of padding wants a 12px container. Above roughly 24px of padding treat the layers as separate surfaces and choose each radius independently rather than forcing the arithmetic.',
        example: '.card { border-radius: 20px; padding: 8px; }  /* 12 + 8 */\n.card-inner { border-radius: 12px; }',
        source: `${CHECKS_DIR}/theming-checks.ts`,
    },
    // ---------- anti-patterns ----------
    'anti-pattern/gradient-text': {
        ruleKey: 'anti-pattern/gradient-text',
        title: 'No gradient text',
        good: 'Headlines in a solid colour, with the gradient - if there must be one - somewhere it does not carry meaning.',
        why: 'Gradient text has no measurable contrast ratio, because the ratio changes along the glyph, so it cannot be verified against any background. It also renders unpredictably: the clip fails in some engines and the text disappears entirely rather than degrading.',
        fix: 'Set a solid colour with a measured contrast ratio. If the gradient is the brand signal, move it to a background panel, a rule, or an underline behind solid text where it decorates rather than carries. Never combine background-clip: text with a gradient on anything a reader has to read.',
        source: 'src/absolute-ban-detector.ts',
    },
    'anti-pattern/glassmorphism-default': {
        ruleKey: 'anti-pattern/glassmorphism-default',
        title: 'Glass is not a design decision',
        good: 'Blur used where there is genuinely something behind to see through, and depth carried by shadow and surface elsewhere.',
        why: 'Frosted panels everywhere are the shape a page takes when nobody chose an aesthetic, and it is instantly recognisable as the default. It is also the most expensive way to draw a panel, and text over a live blur has no stable contrast ratio.',
        fix: 'Replace the blur with an opaque tinted surface plus a layered shadow for depth. Keep backdrop-filter for the one or two places with real content behind them - a sticky header over scrolling content, a dimmed modal backdrop - and never animate a large blur. If text sits on it, measure the contrast against the worst-case background behind the blur.',
        source: 'src/absolute-ban-detector.ts',
    },
    'anti-pattern/side-stripe-borders': {
        ruleKey: 'anti-pattern/side-stripe-borders',
        title: 'No side-stripe accents',
        good: 'Callouts and alerts distinguished by their surface and their icon rather than a coloured bar down one edge.',
        why: 'The coloured left border is the bootstrap-era default for "this is an alert", so it reads as a framework leaking through rather than a decision. It also carries the semantic weight in a 3px strip that is easy to miss and invisible to a screen reader.',
        fix: 'Use a background tint of the semantic hue with matching darker text, plus an icon and a text label that names the state. Keep borders at 1px and neutral for separation. If the accent must stay, a top border reads as deliberate where a side stripe reads as inherited.',
        source: 'src/absolute-ban-detector.ts',
    },
    'anti-pattern/hero-metric-template': {
        ruleKey: 'anti-pattern/hero-metric-template',
        title: 'The hero-metric template',
        good: 'Numbers presented where they make an argument, at a size that reflects how much they matter.',
        why: 'A big number over a row of supporting stats with a gradient accent is a recognisable template rather than a composition, and it usually presents three unequal figures at equal weight. Readers discount all of them because none was singled out.',
        fix: 'Pick the one number that carries the claim and give it the room; demote or cut the rest. Say what the number means next to it rather than under a one-word label. If the figures are genuinely peers, a small table respects them more than a stats row does. Set the number as a paragraph at display size, not as a heading.',
        source: 'src/absolute-ban-detector.ts',
    },
    // Added when `registryCraftGaps()` failed on three rules a concurrent change introduced. That is the
    // invariant working: a rule reaching the registry without teaching content fails a test instead of
    // reaching a payload as a bare defect name.
    'anti-pattern/overused-font': {
        ruleKey: 'anti-pattern/overused-font',
        title: 'Overused typeface',
        good: 'A typeface with a point of view, or a stated reason in DESIGN.md for why the common one is the deliberate choice here.',
        why: 'The flagged faces are where generated UI converges, so a page set in one reads as unchosen even when it is competent. Type is the largest surface on most pages, which makes it the fastest signal a reader gets about whether anyone decided anything.',
        fix: 'Pick a face with real character and gate it on the ambiguous set Il1, O0, rn/m, a/o, cl/d at body size. If the common face genuinely is right - a brand already committed to it, a client mandate, a systems constraint - record that decision in DESIGN.md so the next reader sees a choice rather than a default. Where the document must stay self-contained, lead with a characterful OS-installed face (Charter, Iowan Old Style, Baskerville, Cambria; Avenir, Optima, Futura, Gill Sans).',
        source: `${CHECKS_DIR}/typography-motion-tells.ts`,
    },
    'anti-pattern/single-font': {
        ruleKey: 'anti-pattern/single-font',
        title: 'No display and body pairing',
        good: 'Either two faces with a real axis of contrast - a display face for headings over a readable text face for body - or one face carrying the hierarchy through genuine weight and size contrast.',
        why: 'One family at one weight across a whole page gives the eye nothing to rank, so the reader has to parse instead of scan. It is also the shape a page takes when the type was never decided rather than deliberately restrained.',
        fix: 'Pair across classification - one serif with one sans at matched x-heights - rather than two similar sans, which read as dissonance and buy nothing for the second font\'s load cost. Cap the project at two faces (three only counting a code mono). If staying with one family, make the hierarchy carry: at least a 1.25 size ratio between steps and a real weight jump (400 body against 600-700 headings), not size alone.',
        source: `${CHECKS_DIR}/typography-motion-tells.ts`,
    },
    'anti-pattern/bounce-easing': {
        ruleKey: 'anti-pattern/bounce-easing',
        title: 'No bounce or elastic easing',
        good: 'Easing that settles at its destination, with progress staying inside 0 to 1 so nothing travels past where it is going and comes back.',
        why: 'A bounce reads as uncertainty about the final state, which is the opposite of what a state change should communicate - and on anything a reader sees more than a few times a day it goes from playful to irritating fast. In a cubic-bezier the y values are the progress axis, so a y outside 0-1 IS the overshoot.',
        fix: 'Replace the overshoot curve with an exponential ease-out: cubic-bezier(0.23, 1, 0.32, 1) for a confident UI feel, or cubic-bezier(0, 0, 0.2, 1) for a softer product feel. Drop named bounce/elastic/wobble/spring keyframes and the animate-bounce utility. Where a spring genuinely belongs - a drag with momentum, a drag-to-dismiss - keep bounce subtle at 0.1 to 0.3 rather than a visible rebound, and never on a state-indicating icon.',
        example: '/* instead of cubic-bezier(0.68, -0.55, 0.265, 1.55) */\n.panel { transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }',
        source: `${CHECKS_DIR}/typography-motion-tells.ts`,
    },
    'anti-pattern/modal-as-first-thought': {
        ruleKey: 'anti-pattern/modal-as-first-thought',
        title: 'Inline before modal',
        good: 'Secondary detail revealed in place, with modals kept for decisions that genuinely must interrupt.',
        why: 'The modal is the default answer rather than a choice. It removes the reader\'s context, loses their scroll position, traps focus, and on a phone becomes a full-screen page anyway - so most modals are a worse version of the layout they replaced.',
        fix: 'Try inline expansion, a details disclosure, a side panel, or a dedicated route first. Keep modals for blocking decisions and destructive confirmations. When one is right, use native <dialog> so focus trapping and Escape come for free, and make it full-screen below 768px rather than a small box on a phone.',
        source: 'src/absolute-ban-detector.ts',
    },
};
// Lazily required so the law corpus and this module can reference each other's types without a
// static cycle at module-init time (craft-laws imports CraftNote from here).
let _lawCraft = null;
function lawCraft() {
    if (_lawCraft === null) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            _lawCraft = require('./craft-laws').LAW_CRAFT;
        }
        catch (e) {
            _lawCraft = {};
            process.stderr.write(`craft-corpus: law corpus unavailable (${e instanceof Error ? e.message : String(e)}). ` +
                'Up-front briefs will be empty; findings-driven briefs are unaffected.\n');
        }
    }
    return _lawCraft || {};
}
let _registrySeverity = null;
/** canonicalRuleKey -> registry severity, read from the registry so the mapping cannot drift. */
function registrySeverities() {
    if (_registrySeverity === null) {
        _registrySeverity = new Map();
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { RULES } = require('./product-rule-registry');
            for (const r of RULES) {
                _registrySeverity.set(r.canonicalRuleKey, r.severity);
            }
        }
        catch (e) {
            process.stderr.write(`craft-corpus: product-rule-registry unavailable (${e instanceof Error ? e.message : String(e)}). ` +
                'Notes will fall back to their declared severity for ranking.\n');
        }
    }
    return _registrySeverity;
}
/**
 * Resolve any accepted rule shape to a craft note.
 *
 * Consults, in order: this module's registry notes, the law corpus, then the polish corpus (which
 * also handles the `polish-standard:N` aliases, the finding classes, and the dynamic named bans).
 * Returns undefined for an unknown key rather than guessing, so a caller keeps its own fallback.
 */
function resolveCraftNote(rule) {
    if (rule === null || rule === undefined)
        return undefined;
    const raw = String(rule).trim();
    if (!raw)
        return undefined;
    if (exports.REGISTRY_CRAFT[raw])
        return exports.REGISTRY_CRAFT[raw];
    const laws = lawCraft();
    if (laws[raw])
        return laws[raw];
    // Delegate every polish shape (canonical key, number, polish-standard:N, ban-*) to the reference impl.
    const polishKey = (0, polish_craft_1.normalizeCraftKey)(rule);
    if (polishKey) {
        return polish_craft_1.POLISH_CRAFT[polishKey] || polish_craft_1.POLISH_FINDING_CRAFT[polishKey] || (0, polish_craft_1.banCraftNote)(polishKey);
    }
    return undefined;
}
/** The severity used to rank a note: the registry's, else the note's own, else unranked. */
function craftSeverityRank(note) {
    const fromRegistry = registrySeverities().get(note.ruleKey);
    const sev = fromRegistry ?? note.severity;
    return sev ? (craft_probe_1.CRAFT_SEVERITY_RANK[sev] ?? craft_probe_1.CRAFT_UNRANKED) : craft_probe_1.CRAFT_UNRANKED;
}
/**
 * Registry rules with no craft note anywhere.
 *
 * Empty is the invariant. A non-empty return means a rule was added to the registry without teaching
 * content, and a payload that failed it would hand back the bare defect name - the exact defect this
 * module exists to remove.
 */
function registryCraftGaps() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { RULES } = require('./product-rule-registry');
        return RULES
            .map((r) => r.canonicalRuleKey)
            .filter((k) => !resolveCraftNote(k));
    }
    catch {
        return [];
    }
}
/** How many notes a single brief may teach, and how many of those may carry an example. */
exports.MAX_BRIEF_NOTES = 6;
exports.MAX_BRIEF_EXAMPLES = 2;
/**
 * Select notes for a set of subjects, hardest-first then stable, deduplicated, and capped.
 *
 * Ties break on the note's own key rather than input order, so two runs over one project produce
 * the same brief. Unknown subjects are dropped rather than guessed at.
 */
function selectCraftNotes(subjects, limit = exports.MAX_BRIEF_NOTES) {
    const seen = new Set();
    const picked = [];
    for (const subject of subjects) {
        const note = resolveCraftNote(subject);
        if (!note || seen.has(note.ruleKey))
            continue;
        seen.add(note.ruleKey);
        picked.push(note);
    }
    picked.sort((a, b) => craftSeverityRank(a) - craftSeverityRank(b) || a.ruleKey.localeCompare(b.ruleKey));
    return picked.slice(0, Math.max(0, limit));
}
/**
 * Render the craft brief - the TEACH half of a flow payload.
 *
 * Returns [] when there is nothing to teach, because a constant block appended to every run is the
 * defect this replaces. A caller decides what to print in that case; a clean page should say so
 * rather than being handed a brief it did not earn.
 */
function craftBriefLines(subjects, opts = {}) {
    const mode = opts.mode ?? 'findings';
    const limit = opts.limit ?? exports.MAX_BRIEF_NOTES;
    const exampleBudget = opts.examples ?? exports.MAX_BRIEF_EXAMPLES;
    const notes = selectCraftNotes(subjects, limit);
    if (notes.length === 0)
        return [];
    const distinct = new Set(subjects.map((s) => resolveCraftNote(s)?.ruleKey).filter((k) => !!k)).size;
    const what = opts.domainLabel ? ` on ${opts.domainLabel}` : '';
    const lines = [];
    if (mode === 'findings') {
        lines.push(`CRAFT BRIEF - what good looks like on the points this project missed${what}.`);
        lines.push(`Selected from the ${distinct} rule${distinct === 1 ? '' : 's'} that FAILED here, hardest-first` +
            (distinct > limit ? `, capped at ${limit} taught below` : '') +
            '. Rules that passed are omitted. Every finding is still enumerated under the brief.' +
            (opts.measuredNote ? ` ${opts.measuredNote}` : ''));
    }
    else {
        lines.push(`CRAFT BRIEF - the standard to build to${what}.`);
        // The provenance sentence must not contradict the measuredNote that may follow it. An earlier
        // draft said "Nothing here was measured on this project" and then appended "16 rule(s) in this
        // domain already fail on the current project", which reads as the payload disagreeing with
        // itself. What is true of these NOTES is that measurement did not select them; that is the claim
        // to make, and it stays true whether or not failures exist alongside.
        lines.push(`This flow runs before there is a finished artifact to measure, so the ${distinct} point${distinct === 1 ? '' : 's'} ` +
            `below ${distinct === 1 ? 'is' : 'are'} the up-front standard` +
            (distinct > limit ? `, capped at ${limit} taught below` : '') +
            ' - not selected by measuring this project.' +
            (opts.measuredNote ? ` ${opts.measuredNote}` : ''));
    }
    lines.push('Read this before acting: the work is the principle, not the rule name.');
    lines.push('');
    let examplesUsed = 0;
    notes.forEach((note, i) => {
        lines.push(`${i + 1}. ${note.title.toUpperCase()}`);
        lines.push(`   Good: ${note.good}`);
        lines.push(`   Why:  ${note.why}`);
        lines.push(`   Do:   ${note.fix}`);
        if (note.example && examplesUsed < exampleBudget) {
            examplesUsed++;
            for (const l of note.example.split('\n'))
                lines.push(`     ${l}`);
        }
        lines.push(`   Source: ${note.source}`);
        lines.push('');
    });
    return lines;
}
/** The concrete remediation for a rule, for a report's "what to do" column. */
function craftRemediation(rule) {
    return resolveCraftNote(rule)?.fix;
}
//# sourceMappingURL=craft-corpus.js.map