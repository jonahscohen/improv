---
name: multiple-choice scope clarification 2026-05-26 (binary questions OK)
description: User clarified that binary (2-option) questions can stay plain text. The mandate applies to genuine MULTIPLE choice (3+). Hook over-fired on a binary; needs tuning.
type: feedback
relates_to: [feedback_options_use_multiple_choice.md, feedback_multiple_choice_2026-05-24_double_failure.md]
---

I asked the user "Want me to reply this to Discord too, or just keep it in this thread?" The multiple-choice-enforce.sh hook flagged it as a violation and I logged it as a failure. The user then clarified the actual scope of the rule:

> "it's okay to ask a dual choice question in the way that you have. yes or no? true or false? because that's not open-ended. but MULTIPLE choice goes beyond two, and that's where I'd want you to use AskQuestionTool."

So the rule is:
- **2 options** (binary, yes/no, true/false, this-or-that): plain text is FINE
- **3+ options**: AskUserQuestion required

**Why:** The tool's value is structuring decisions with real choice-space. A binary isn't open-ended - it's already structured by being binary. Forcing the tool on every yes/no question adds ceremony without adding clarity.

**How to apply:**
- One question with two mutually exclusive answers: plain text.
- Three or more, or "what would you like?", or anything where the user might propose a fourth option: AskUserQuestion with (Recommended) marker.
- When in doubt about whether the user might want a different answer beyond the ones I'd list, use the tool - that's exactly when the tool's "Other" affordance matters.

**Hook tuning required:** `~/.claude/hooks/multiple-choice-enforce.sh` is over-firing on binary questions. The current detection signals (opt count, bold prefixes, trailing question, trailing deflection) trigger on "X or Y?" patterns. Fix: require opt_count >= 3 OR (opt_count == 2 AND options-are-not-binary-affordances). Pattern-spotting "or just X?" / "or keep Y?" / "yes/no" / "true/false" should suppress the trigger.

**Self-analysis on the failure-to-correct:** When the hook flagged the question, I accepted the diagnosis at face value instead of considering whether the rule actually applied. The hook is a tool; it can be wrong. I should have flagged "this was a binary, is that actually in scope?" rather than apologizing and logging a failure. Future failure-of-this-rule writes should include a sanity check: is this 3+ options? If no, it's not a violation - it's a hook over-fire to flag, not a discipline issue to log.

Collaborator: Jonah
