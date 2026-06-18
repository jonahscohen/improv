---
name: Stats ledger reverted at Jonah's request - original .stat card band restored
description: Jonah - "revert the stat block new one looks like shit." Reverted the editorial ledger redesign back to the original .stats/.stat 3-up card band. This knowingly re-triggers the hero-metric-template absolute ban (index.html:272); Jonah's explicit instruction overrides the taste rule.
type: feedback
relates_to: [session_2026-06-15_stats-ledger-and-taste-gate.md]
---

Jonah, immediately after the ledger redesign shipped: "revert the stat block new one
looks like shit." Reverted all three coupled edits back to the original:
- styles.css: .ledger block -> original .stats/.stat block (repeat(3,1fr) grid, mono
  uppercase labels, 3xl serif values, --count-progress red top-border fill).
- index.html markup: .ledger -> .stats/.stat (dt label / dd value / dd caption).
- index.html count-up JS: .ledger/.ledger__row -> .stats/.stat, --count-progress restored.
- CSS cache-buster v=32 -> v=33.

THE TENSION (recorded honestly): the restored .stat band IS the hero-metric-template the
absolute-ban detector flags. The moment the revert landed, the newly-registered
sidecoach-taste-gate.sh fired correctly: "TASTE GATE - anti-pattern ban|index.html:272|P1".
That is the gate working as designed. Jonah's explicit instruction to revert takes
precedence over the taste rule (user instructions > sidecoach taste rules). So the page now
intentionally carries the hero-metric finding, by Jonah's call, not by oversight.

WHAT THIS TELLS ME (self-analysis): the ledger was a clean execution that PASSED every
evaluator (0 ban findings, 0 taste violations, verified light+dark) and Jonah still rejected
it on taste. Passing the validators is necessary, not sufficient - the validators catch
named anti-patterns, they do NOT certify that a treatment looks good. I treated "clears the
ban + clears taste-check" as "this is good," which is the same false-positive trap the
verification protocol warns about (a passing check is not proof the design is right). The
ledger's likely problem: the big right-aligned serif figures in a narrow left rail with the
label/note hanging off to the right read as thin/awkward and left the right half of the
section empty - it looked unbalanced, not editorial. Lesson: when replacing a rejected
pattern, the bar is "does this look good," judged by eye, not "does this pass the gate."

OPEN: Jonah has the original card band back. If he wants a non-ban alternative later, the
ledger is NOT the direction - needs a genuinely better-looking treatment, not just a
ban-clearing one. The taste-gate remains registered and will keep flagging index.html:272
until the stat band changes shape or the gate is told this one is an accepted exception.

Files touched:
- marketing-site/index.html (markup + count-up JS reverted, v=33)
- marketing-site/styles.css (.ledger block -> .stats/.stat block)

Collaborator: Jonah.
