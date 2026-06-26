"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Stage 2 convergence: the absorbed forms-a11y checks detect correctly from markup. Proves each check's
// not_applicable guard (no form controls / no error state / no placeholder / no choice control) AND its
// pass/fail verdict. These replace ExtendedDomainValidator's FORMS_016/018/019/002/015.
const forms_checks_1 = require("../validators/checks/forms-checks");
const ctx = (markup) => ({ cssText: '', markup, files: [] });
function expect(cond, msg) { if (!cond)
    throw new Error(msg); }
function run() {
    // --- not_applicable guards: a page with no form controls ---
    const noForm = ctx('<main><h1>Hi</h1><p>No forms here.</p></main>');
    for (const [name, fn] of Object.entries({ checkFormControlLabelled: forms_checks_1.checkFormControlLabelled, checkFormErrorAssociation: forms_checks_1.checkFormErrorAssociation, checkFormPlaceholderNotLabel: forms_checks_1.checkFormPlaceholderNotLabel, checkFormInputType: forms_checks_1.checkFormInputType, checkFormChoiceLabelTarget: forms_checks_1.checkFormChoiceLabelTarget })) {
        expect(fn(noForm).status === 'not_applicable', `${name} must be N/A with no form controls`);
    }
    // --- control labelling ---
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><input name="email"></form>')).status === 'fail', 'unlabelled input must fail');
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><label for="e">Email</label><input id="e" name="email"></form>')).status === 'pass', 'labelled input must pass');
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><input aria-label="Email" name="email"></form>')).status === 'pass', 'aria-label must pass');
    // PER-CONTROL (Codex P1): one labelled control must NOT mask a sibling unlabelled one.
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><label for="e">Email</label><input id="e"><input name="phone"></form>')).status === 'fail', 'one labelled + one unlabelled control must fail (no masking by a label elsewhere)');
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><label>Email <input name="email"></label></form>')).status === 'pass', 'control wrapped in its <label> must pass');
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><label for="e">Email</label><input id="e"><button type="submit">Go</button></form>')).status === 'pass', 'non-labelable controls (submit button) are not counted against labelling');
    expect((0, forms_checks_1.checkFormControlLabelled)(ctx('<form><label-tooltip>Help</label-tooltip><input name="x"></form>')).status === 'fail', 'a custom <label-tooltip> element must NOT count as a wrapping <label> (Codex re-review)');
    // --- error association: N/A unless an error state is expressed; fail without aria; pass with aria ---
    expect((0, forms_checks_1.checkFormErrorAssociation)(ctx('<form><label>Email</label><input></form>')).status === 'not_applicable', 'no error state => N/A');
    expect((0, forms_checks_1.checkFormErrorAssociation)(ctx('<form><input class="error"><span>Invalid email</span></form>')).status === 'fail', 'error without aria must fail');
    expect((0, forms_checks_1.checkFormErrorAssociation)(ctx('<form><input aria-invalid="true" aria-describedby="err"><span id="err">Invalid</span></form>')).status === 'pass', 'aria-associated error must pass');
    // --- placeholder not label ---
    expect((0, forms_checks_1.checkFormPlaceholderNotLabel)(ctx('<form><label>Name</label><input></form>')).status === 'not_applicable', 'no placeholder => N/A');
    expect((0, forms_checks_1.checkFormPlaceholderNotLabel)(ctx('<form><input placeholder="Email"></form>')).status === 'fail', 'placeholder-as-label must fail');
    expect((0, forms_checks_1.checkFormPlaceholderNotLabel)(ctx('<form><label for="e">Email</label><input id="e" placeholder="you@example.com"></form>')).status === 'pass', 'placeholder + label must pass');
    // --- input type ---
    expect((0, forms_checks_1.checkFormInputType)(ctx('<form><input type="email"></form>')).status === 'pass', 'no bare text input => pass');
    expect((0, forms_checks_1.checkFormInputType)(ctx('<form><input type="text" name="email"></form>')).status === 'fail', 'only text inputs must fail');
    expect((0, forms_checks_1.checkFormInputType)(ctx('<form><input type="text"><input type="email"></form>')).status === 'pass', 'mixed typed + text passes');
    // --- choice label target ---
    expect((0, forms_checks_1.checkFormChoiceLabelTarget)(ctx('<form><input type="text"></form>')).status === 'not_applicable', 'no checkbox/radio => N/A');
    expect((0, forms_checks_1.checkFormChoiceLabelTarget)(ctx('<form><input type="checkbox" id="c"><span>Agree</span></form>')).status === 'fail', 'unassociated checkbox must fail');
    expect((0, forms_checks_1.checkFormChoiceLabelTarget)(ctx('<form><label><input type="checkbox"> Agree</label></form>')).status === 'pass', 'wrapped checkbox label must pass');
    // --- batch 2 (11 more): each has N/A guard + a fail case (+ pass where the rule has a pass branch) ---
    // anti-pattern detectors (paste, no-pm, no-pre-disable) fail-or-pass/N-A; presence rules fail-or-pass.
    expect((0, forms_checks_1.checkFormAutocomplete)(ctx('<form><input name="email"></form>')).status === 'fail', 'autocomplete: named field without autocomplete fails');
    expect((0, forms_checks_1.checkFormAutocomplete)(ctx('<form><input name="email" autocomplete="email"></form>')).status === 'pass', 'autocomplete present passes');
    expect((0, forms_checks_1.checkFormInputmode)(ctx('<form><input type="tel" name="p"></form>')).status === 'fail', 'inputmode: tel without inputmode fails');
    expect((0, forms_checks_1.checkFormInputmode)(ctx('<form><input type="email"></form>')).status === 'not_applicable', 'inputmode N/A without numeric intent');
    expect((0, forms_checks_1.checkFormNeverBlockPaste)(ctx('<form><input onpaste="e.preventDefault()"></form>')).status === 'fail', 'paste-block fails');
    expect((0, forms_checks_1.checkFormNeverBlockPaste)(ctx('<form><input name="x"></form>')).status === 'pass', 'no paste-block passes');
    expect((0, forms_checks_1.checkFormSpellcheckOff)(ctx('<form><input type="email"></form>')).status === 'fail', 'spellcheck: email without spellcheck=false fails');
    expect((0, forms_checks_1.checkFormSpellcheckOff)(ctx('<form><input type="text" name="x"></form>')).status === 'not_applicable', 'spellcheck N/A without sensitive field');
    expect((0, forms_checks_1.checkFormIdempotentSubmit)(ctx('<form onSubmit="send()"><button type="submit">Go</button></form>')).status === 'fail', 'idempotent: async submit without guard fails');
    expect((0, forms_checks_1.checkFormIdempotentSubmit)(ctx('<form onSubmit="send()"><button disabled={isSubmitting}>Go</button></form>')).status === 'pass', 'idempotent: async + isSubmitting guard passes');
    expect((0, forms_checks_1.checkFormIdempotentSubmit)(ctx('<form action="/x"><button type="submit">Go</button></form>')).status === 'not_applicable', 'idempotent: plain native form is N/A');
    expect((0, forms_checks_1.checkFormInlineErrors)(ctx('<form><p>The email is invalid</p><input name="email"></form>')).status === 'fail', 'inline-errors: error state but no field affordance fails');
    expect((0, forms_checks_1.checkFormInlineErrors)(ctx('<form><input aria-invalid="true"></form>')).status === 'pass', 'inline-errors: aria-invalid passes');
    expect((0, forms_checks_1.checkFormInlineErrors)(ctx('<form><input name="x" required></form>')).status === 'not_applicable', 'inline-errors: native required (no error state) is N/A');
    expect((0, forms_checks_1.checkFormFocusFirstError)(ctx('<form><input></form>')).status === 'not_applicable', 'focus-first N/A without error handling');
    expect((0, forms_checks_1.checkFormFocusFirstError)(ctx('<form><div class="error">x</div></form>')).status === 'fail', 'focus-first: error but no focus mgmt fails');
    expect((0, forms_checks_1.checkFormNoPasswordManagerNonAuth)(ctx('<form><input name="password" type="text"></form>')).status === 'fail', 'no-pm: text field named password fails');
    expect((0, forms_checks_1.checkFormNoPasswordManagerNonAuth)(ctx('<form><input name="password" type="password"></form>')).status === 'not_applicable', 'no-pm N/A for real password field');
    expect((0, forms_checks_1.checkFormTextareaSubmit)(ctx('<form><textarea></textarea></form>')).status === 'fail', 'textarea-submit: no keyboard submit fails');
    expect((0, forms_checks_1.checkFormTextareaSubmit)(ctx('<form><input name="x"></form>')).status === 'not_applicable', 'textarea-submit N/A without textarea');
    expect((0, forms_checks_1.checkFormNoPreDisableSubmit)(ctx('<form><button disabled={!isValid}>Go</button></form>')).status === 'fail', 'no-pre-disable: disabled on !isValid fails');
    expect((0, forms_checks_1.checkFormNoPreDisableSubmit)(ctx('<form><button disabled={!formState.isValid}>Go</button></form>')).status === 'fail', 'no-pre-disable: object-access validity (!formState.isValid) fails');
    expect((0, forms_checks_1.checkFormNoPreDisableSubmit)(ctx('<form><button disabled={!isDirty}>Save</button></form>')).status === 'pass', 'no-pre-disable: disable-until-dirty is a legit gate, not flagged');
    expect((0, forms_checks_1.checkFormNoPreDisableSubmit)(ctx('<form><button type="submit">Go</button></form>')).status === 'pass', 'no-pre-disable: enabled submit passes');
    expect((0, forms_checks_1.checkFormAutofocusSparingly)(ctx('<form><input autofocus><input autofocus></form>')).status === 'fail', 'autofocus: multiple autofocus fails');
    expect((0, forms_checks_1.checkFormAutofocusSparingly)(ctx('<form><input autofocus></form>')).status === 'pass', 'autofocus: single autofocus passes');
    expect((0, forms_checks_1.checkFormAutofocusSparingly)(ctx('<form><input name="x"></form>')).status === 'not_applicable', 'autofocus N/A when none used');
    console.log('forms-checks: OK (16 absorbed forms-a11y checks - N/A guards + pass/fail verdicts)');
}
run();
//# sourceMappingURL=forms-checks.test.js.map