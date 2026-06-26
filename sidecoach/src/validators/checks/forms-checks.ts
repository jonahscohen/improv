// sidecoach/src/validators/checks/forms-checks.ts
//
// Forms-accessibility checks (Stage 2 convergence: absorbed from ExtendedDomainValidator's FORMS_* rules, which
// were the one genuinely-real, registry-uncovered domain - real markup detection of labels/aria/input-types,
// NOT the theater that made up most of that 196-rule validator). Reimplemented registry-quality: each reads the
// collected markup (ProductCheckContext.markup) and returns not_applicable when the page has no form controls,
// so a non-form page is never failed. These detect from authored markup (static, markup-evidence rules).
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable } from '../check-context';

// Lowercased markup haystack with COMMENTS STRIPPED (HTML, JS/CSS block, and JS line). The registry collects
// markup across files into ctx.markup (which for .tsx/.jsx includes JS); we also fold in the raw html field a
// unit caller may pass. Comments are removed FIRST: a comment mentioning "<label", "aria-label", "placeholder"
// etc. (a TODO or an explanatory note) would otherwise satisfy these string-level checks and cause a false pass
// (Codex P1: HTML-only stripping missed JS/JSX // and /* */ comments). The line-comment strip is guarded against
// a preceding ':' so it does not eat "https://". A registry-quality fix over the legacy haystack.
const haystack = (ctx: ProductCheckContext): string =>
  `${ctx.markup || ''}\n${(ctx as { html?: string }).html || ''}`
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n\r]*/g, '$1 ')
    .toLowerCase();

// Applicability: only meaningful when the page actually has form controls.
const hasFormMarkup = (h: string): boolean => /<input\b|<textarea\b|<select\b|<form\b|<label\b/.test(h);

export const checkFormControlLabelled = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  // PER-CONTROL, not "any label anywhere": a single labelled input must not mask a
  // sibling unlabelled control (Codex P1). Each labelable control needs its OWN
  // association - inline aria-label/aria-labelledby, an id targeted by a label `for`,
  // or a wrapping <label>.
  const NON_LABELABLE = /type\s*=\s*["']?(hidden|submit|button|reset|image)\b/;
  const controls: Array<{ tag: string; index: number }> = [];
  for (const m of h.matchAll(/<(input|textarea|select)\b[^>]*>/g)) {
    if (m[1] === 'input' && NON_LABELABLE.test(m[0])) continue; // buttons/hidden don't take a visible label
    controls.push({ tag: m[0], index: m.index ?? 0 });
  }
  if (!controls.length) return notApplicable('no labelable form controls');
  // ids referenced by a label `for`/`htmlFor` (haystack is lowercased, so htmlFor -> htmlfor).
  const labelTargets = new Set<string>();
  for (const fm of h.matchAll(/(?:\bfor|htmlfor)\s*=\s*["']?([a-z0-9_\-:.]+)/g)) labelTargets.add(fm[1]);
  // Match a REAL <label> start tag only - `<label` followed by whitespace, `>` or `/`. A bare
  // lastIndexOf('<label') also matched custom elements like <label-tooltip>/<labelgroup>, letting
  // an unlabelled control inside one falsely "pass" as wrapped (Codex re-review P1).
  const lastReIndex = (s: string, re: RegExp): number => {
    let last = -1; let mm: RegExpExecArray | null;
    const r = new RegExp(re.source, 'g');
    while ((mm = r.exec(s)) !== null) last = mm.index;
    return last;
  };
  const wrappedByLabel = (idx: number): boolean => {
    const before = h.slice(0, idx);
    return lastReIndex(before, /<label[\s>/]/) > before.lastIndexOf('</label>'); // an unclosed real <label> precedes it
  };
  const unlabelled = controls.filter(({ tag, index }) => {
    if (/aria-label\s*=|aria-labelledby\s*=/.test(tag)) return false;
    const idm = tag.match(/\bid\s*=\s*["']?([a-z0-9_\-:.]+)/);
    if (idm && labelTargets.has(idm[1])) return false;
    return !wrappedByLabel(index);
  });
  return unlabelled.length === 0
    ? pass('every form control has its own associated label')
    : fail(`${unlabelled.length} form control(s) lack an associated label`, [], 'Give EACH control a <label> (htmlFor/id or wrapping) or an aria-label/aria-labelledby; one label elsewhere does not cover another control, and a placeholder is not a label');
};

export const checkFormErrorAssociation = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const mentionsError = h.includes('error') || h.includes('invalid');
  // Only applicable once the markup expresses an error state at all; otherwise there is nothing to associate.
  if (!mentionsError) return notApplicable('no error state expressed in the markup');
  return h.includes('aria-invalid') && h.includes('aria-describedby')
    ? pass('errored fields are associated via aria-invalid + aria-describedby')
    : fail('errored fields should set aria-invalid + aria-describedby', [], 'On error set aria-invalid="true" and point aria-describedby at the message id so screen readers announce the failure');
};

export const checkFormPlaceholderNotLabel = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  if (!h.includes('placeholder')) return notApplicable('no placeholder used');
  return h.includes('<label') || h.includes('aria-label') || h.includes('aria-labelledby')
    ? pass('a label is present alongside the placeholder')
    : fail('placeholder must not stand in for a label', [], 'Keep a persistent visible label; the placeholder disappears on input and cannot serve as the accessible name');
};

export const checkFormInputType = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const usesTyped = /type\s*=\s*["'](email|tel|url|number|search|date|password)["']/.test(h);
  const onlyText = /type\s*=\s*["']text["']/.test(h);
  // N/A unless there is a typed-intent signal to judge: a page using only text inputs with no specific-type
  // candidate is not necessarily wrong, but type="text" everywhere when typed inputs exist is the smell.
  if (!onlyText) return pass('inputs use specific types (or no bare type="text")');
  return usesTyped
    ? pass('specific input types are used alongside text inputs')
    : fail('inputs should use a specific type, not type="text" for everything', [], 'Use type="email" | "tel" | "url" | "number" etc. so the browser surfaces the right keyboard and validation');
};

export const checkFormChoiceLabelTarget = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  if (!/type\s*=\s*["'](checkbox|radio)["']/.test(h)) return notApplicable('no checkbox/radio controls');
  const associated = h.includes('<label') && (h.includes('htmlfor') || h.includes('for=') || /<label[^>]*>[\s\S]*<input/.test(h));
  return associated
    ? pass('checkbox/radio shares its label hit target')
    : fail('checkbox/radio must share a single hit target with its label', [], 'Wrap the control in its <label> (or link via htmlFor) so clicking the text toggles the control - no dead zones between them');
};

// ---- second batch (FORMS_001/003/004/005/007/008/009/011/014/017/020) ----
// Reimplemented from the legacy haystack predicates, sharing the comment-stripped haystack + N/A guards. The
// weaker keyword-presence proxies (idempotency, focus-first-error, no-password-manager, autofocus) stay
// non-blocking (minor/advisory) - they advise, they do not gate, because their detection is a proxy.

export const checkFormAutocomplete = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  if (!/name\s*=/.test(h)) return notApplicable('no named fields to autocomplete');
  return h.includes('autocomplete')
    ? pass('fields declare autocomplete')
    : fail('named fields should declare an autocomplete token', [], 'Add autocomplete="email|name|..." so browsers/password managers fill correctly');
};

export const checkFormInputmode = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const numericIntent = h.includes('otp') || h.includes('one-time-code') || /type\s*=\s*["'](tel|number)["']/.test(h);
  if (!numericIntent) return notApplicable('no numeric/OTP intent that needs inputmode');
  return h.includes('inputmode')
    ? pass('numeric/OTP fields declare inputmode')
    : fail('numeric/OTP fields should declare inputmode', [], 'Add inputmode="numeric" (or "tel") so mobile surfaces the right keypad');
};

export const checkFormNeverBlockPaste = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const blocksPaste = /on?paste[^>]*preventdefault/.test(h.replace(/\s+/g, '')) || (h.includes('onpaste') && h.includes('preventdefault'));
  return blocksPaste
    ? fail('do not block paste into form fields', [], 'Remove onPaste preventDefault; blocking paste breaks password managers and accessibility')
    : pass('paste is not blocked');
};

export const checkFormSpellcheckOff = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const sensitive = /type\s*=\s*["']email["']/.test(h) || h.includes('username') || h.includes('one-time-code') || h.includes('otp');
  if (!sensitive) return notApplicable('no email/username/code fields');
  return /spellcheck\s*=\s*["{]?false/.test(h)
    ? pass('sensitive fields disable spellcheck')
    : fail('email/username/code fields should set spellcheck="false"', [], 'Add spellcheck="false" so codes/emails are not flagged or autocorrected');
};

export const checkFormIdempotentSubmit = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  // Only applicable when the form submits PROGRAMMATICALLY (async) - a plain native form post does not need an
  // in-flight guard, so we do not nag static forms. Async signals: onSubmit handler, fetch/axios, a mutation hook.
  const asyncSubmit = h.includes('onsubmit') || h.includes('handlesubmit') || h.includes('fetch(') || h.includes('axios') || h.includes('usemutation') || h.includes('mutateasync');
  if (!asyncSubmit) return notApplicable('no programmatic/async submission that needs an idempotency guard');
  return h.includes('idempotency') || h.includes('issubmitting') || h.includes('ispending') || h.includes('isloading')
    ? pass('async submit appears guarded against duplicate submission')
    : fail('guard async submission against duplicates (in-flight state)', [], 'Track an in-flight/isSubmitting state and ignore repeat submits, or use an idempotency key');
};

export const checkFormInlineErrors = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  // Only assessable once the form expresses an actual ERROR STATE; an error-free form (incl. one using native
  // `required` constraint validation) is not failed for lacking custom error UI (Codex P1: bare `required` must
  // not gate this major rule). Consistent with form-error-association. Fires when an error state exists but lacks
  // a field-level affordance.
  if (!h.includes('error') && !h.includes('invalid')) {
    return notApplicable('no error state expressed');
  }
  return h.includes('aria-invalid') || h.includes('aria-describedby') || /class\s*=\s*["'][^"']*error/.test(h) || h.includes('field-error')
    ? pass('inline error affordances present')
    : fail('forms should surface inline, field-level errors', [], 'Show errors next to the field (aria-invalid + a described message), not just a top-level summary');
};

export const checkFormFocusFirstError = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  if (!h.includes('error') && !h.includes('invalid')) return notApplicable('no error handling expressed');
  return (h.includes('focus') && (h.includes('error') || h.includes('invalid'))) || h.includes('setfocus') || h.includes('scrollintoview')
    ? pass('first error appears to receive focus')
    : fail('move focus to the first error on a failed submit', [], 'On validation failure, focus()/scrollIntoView the first invalid field so it is not missed');
};

export const checkFormNoPasswordManagerNonAuth = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const reservedName = /name\s*=\s*["']password["']/.test(h) && !/type\s*=\s*["']password["']/.test(h);
  if (!reservedName) return notApplicable('no reserved-name field that would mislead password managers');
  return fail('a non-password field is named "password"', [], 'Rename non-auth fields so password managers do not offer to fill/save them');
};

export const checkFormTextareaSubmit = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  if (!h.includes('<textarea')) return notApplicable('no textarea');
  return h.includes('metakey') || h.includes('ctrlkey') || h.includes('cmd+enter') || h.includes('⌘')
    ? pass('textarea supports a keyboard submit affordance')
    : fail('let Cmd/Ctrl+Enter submit from a textarea', [], 'Bind Cmd/Ctrl+Enter to submit so keyboard users can send without reaching for the mouse');
};

export const checkFormNoPreDisableSubmit = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx).replace(/\s+/g, '');
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  // Flag disabling submit on VALIDITY only (Codex P2). Allow an object prefix (formState.isValid) and an opening
  // paren (!(isValid && ...)). Deliberately EXCLUDES isDirty/isComplete - disabling until dirty/complete is a
  // legitimate gate, not a validity pre-disable.
  const disablesOnInvalid = /disabled=\{!\(?[a-z0-9_.]*(isvalid|formvalid|isformvalid|cansubmit)\b/.test(h);
  return disablesOnInvalid
    ? fail('do not pre-disable submit based on validity', [], 'Keep submit enabled and validate on submit; a disabled button gives no feedback on what is wrong')
    : pass('submit is not pre-disabled on validity');
};

export const checkFormAutofocusSparingly = (ctx: ProductCheckContext): RuleVerdict => {
  const h = haystack(ctx);
  if (!hasFormMarkup(h)) return notApplicable('no form controls in the markup');
  const count = (h.match(/autofocus/g) || []).length;
  if (count === 0) return notApplicable('no autofocus used');
  return count <= 1
    ? pass('autofocus used on at most one control')
    : fail(`autofocus appears ${count} times; use it on at most one control`, [], 'Keep autofocus to a single primary field; multiple autofocus targets fight each other and disorient screen readers');
};

export const FORMS_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'a11y/form-control-labelled': checkFormControlLabelled,
  'a11y/form-error-association': checkFormErrorAssociation,
  'a11y/form-placeholder-not-label': checkFormPlaceholderNotLabel,
  'a11y/form-input-type': checkFormInputType,
  'a11y/form-choice-label-target': checkFormChoiceLabelTarget,
  'a11y/form-autocomplete': checkFormAutocomplete,
  'a11y/form-inputmode': checkFormInputmode,
  'a11y/form-never-block-paste': checkFormNeverBlockPaste,
  'a11y/form-spellcheck-off': checkFormSpellcheckOff,
  'a11y/form-idempotent-submit': checkFormIdempotentSubmit,
  'a11y/form-inline-errors': checkFormInlineErrors,
  'a11y/form-focus-first-error': checkFormFocusFirstError,
  'a11y/form-no-pm-non-auth': checkFormNoPasswordManagerNonAuth,
  'a11y/form-textarea-submit': checkFormTextareaSubmit,
  'a11y/form-no-pre-disable-submit': checkFormNoPreDisableSubmit,
  'a11y/form-autofocus-sparingly': checkFormAutofocusSparingly,
};
