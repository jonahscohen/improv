/**
 * MECHANICAL PRODUCT.md transform (PREREGISTRATION.md section 2.2).
 *
 * sidecoach-monitor reads PRODUCT.md from its working directory, and what it finds there changes
 * the guidance payload substantially. Running with no PRODUCT.md tests a configuration SKILL.md
 * itself calls invalid; running inside sidecoach's own project injects sidecoach's branding into
 * every brief. `/sidecoach teach` cannot resolve it because it stops to ask for brandPersonality,
 * antiReferences and strategicPrinciples - design content the trial author must not supply to one
 * arm only.
 *
 * So this transform copies brief text VERBATIM into PRODUCT.md slots and invents NOTHING. Every
 * word it emits already appears in the brief, which all three arms receive in full, so the arms
 * stay informationally equal and only sidecoach's PROCESSING of that information differs.
 *
 * Fields with no verbatim source in the brief (antiReferences, strategicPrinciples) are LEFT OUT.
 * Filling them would be authoring design direction for the treatment arm.
 *
 * The only non-brief string this module emits is the section scaffolding sidecoach's own parser
 * looks for ("## Register", "## Users", ...), which is format, not content.
 */

/** sidecoach's PRODUCT.md register vocabulary is {brand, product}; briefs use finer registers. */
const REGISTER_MAP = {
  'marketing/landing': 'brand',
  editorial: 'brand',
  flex: 'brand',
  'app-ui': 'product',
  product: 'product',
  forms: 'product',
};

/**
 * Build PRODUCT.md text from a parsed brief. Pure function of the brief; no randomness, no I/O.
 * Throws if the brief carries a register this map does not cover, rather than guessing one.
 */
export function productMdFromBrief(brief) {
  const register = REGISTER_MAP[brief.register];
  if (!register) throw new Error(`brief ${brief.id}: register "${brief.register}" has no mapping to sidecoach's {brand,product} vocabulary`);

  // Section headings and markers are the SHIPPED parser's own vocabulary, verified against
  // src/project-context.ts parseMarkdownFrontmatter: it recognises `## Register` carrying a bold
  // **Brand**/**Product** marker, `## Primary Users`, `## Brand Personality`, `## Anti-References`
  // and `## Strategic Principles`. A first version used `## Users` and a plain register word; the
  // parser silently ignored both, so the treatment arm ran with an EMPTY users field. Corrected
  // before any page was generated - the fix strengthens the treatment, which is the direction
  // that works against this trial finding a null.
  const parts = [
    '# Product',
    '',
    '## Register',
    '',
    `**${register === 'brand' ? 'Brand' : 'Product'}**`,
    '',
    '## Primary Users',
    '',
    brief.audience,
    '',
    '## Product Purpose',
    '',
    brief.goal,
    '',
    `Required content: ${brief.requiredContent.join('; ')}`,
    '',
    `Success criteria: ${brief.successCriteria.join('; ')}`,
    '',
  ];

  if (brief.brandToneInWords) {
    parts.push('## Brand Personality', '', brief.brandToneInWords, '');
  }

  parts.push('## Constraints', '');
  for (const c of brief.constraints) parts.push(`- ${c}`);
  parts.push('');
  return parts.join('\n');
}

/**
 * Every word this module emits must already exist in the brief. This checker is the guard on that
 * claim: it returns the list of alphabetic tokens present in the generated PRODUCT.md that do not
 * appear in the brief, EXCLUDING the fixed scaffolding vocabulary. A non-empty return means the
 * transform leaked authored content and the caller must fail.
 */
const SCAFFOLD_TOKENS = new Set([
  'product', 'register', 'users', 'primary', 'purpose', 'brand', 'personality', 'constraints',
  'required', 'content', 'success', 'criteria',
]);

export function authoredTokenLeak(brief, productMd) {
  const tok = (s) => (s.toLowerCase().match(/[a-z]+/g) || []);
  const briefTokens = new Set(tok(brief.raw));
  return [...new Set(tok(productMd))].filter((t) => !briefTokens.has(t) && !SCAFFOLD_TOKENS.has(t));
}
