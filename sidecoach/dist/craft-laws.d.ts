import type { CraftNote } from './craft-corpus';
/**
 * The law corpus, keyed `law/<domain>/<slug>`.
 *
 * `severity` is carried explicitly because these notes are not registry rules and so have no
 * registry severity to rank by. The ladder is the registry's own (blocker / major / minor /
 * advisory) so one comparator orders law notes and rule notes together.
 */
export declare const LAW_CRAFT: Record<string, CraftNote>;
/**
 * Which law notes belong to a domain.
 *
 * A flow asks for the domains it OWNS and cannot reach into another flow's material, so the
 * typography verb never teaches form autocomplete. Derived from the key prefix so adding a note
 * needs no second edit here.
 */
export declare function lawKeysForDomain(domain: string): string[];
/** Every domain the law corpus covers. */
export declare function lawDomains(): string[];
/** All law keys for a list of domains, in domain order then declaration order. */
export declare function lawKeysForDomains(domains: string[]): string[];
//# sourceMappingURL=craft-laws.d.ts.map