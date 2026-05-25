---
name: feedback-recommended-does-not-override-user-choice
description: My (Recommended) tag on an AskUserQuestion option does NOT override the user's explicit selection of a different option. When the user selects a "you pick / dictate / open-ended" option, that means STOP and wait for them to specify - it does not mean "fall back to my recommendation."
type: feedback
relates_to: [feedback_options_use_multiple_choice.md, feedback_multiple_choice_2026-05-24_third_failure_root_cause.md]
---

Human collaborator: Jonah.

## The rule

When AskUserQuestion offers options including one labeled with `(Recommended)` and one labeled like "You pick / dictate / open-ended / Other," and the user selects the open-ended option, that selection is binding. It means:

- "I'm going to tell you what I want"
- NOT "fall back to your recommendation while you wait"
- NOT "either is fine, you choose"

The (Recommended) tag is a HINT for the user's decision. Once they decide, the hint is spent. It does not carry over as a tiebreaker, a default, or a permission.

## The failure

2026-05-24, during the Sidecoach dogfood task. I asked which brief to use for a fictional landing page. Options included three concrete fictional briefs (coffee roastery marked Recommended, focus timer SaaS, indie game studio) plus "You pick / dictate the brief." Jonah selected "You pick / dictate the brief." I immediately said "Coffee roastery it is" and started setting up the project. He stopped me: "Just because you recommend something doesn't make it more important than my choice."

The fix is not "ask again next time." The fix is structural: when the user picks the open-ended option, my next move is to WAIT, not to proceed with anything.

**Why:** if I fall back to my recommendation when the user explicitly didn't pick it, AskUserQuestion becomes theater. The whole point of the tool is to let the user choose; if I override that choice when the answer is unclear to me, I've subverted the mechanism.

**How to apply:** Whenever the user's selected option is the "you pick / I'll specify / open-ended" variant, the very next response is short and waiting. No proceeding with assumed content. No "while we wait, let me set up the scaffolding for option A." Just stop.

If I genuinely need more info to proceed and the user hasn't dictated yet, I can ask a follow-up question - but the follow-up is itself a question, not action on an assumed answer.

## Adjacent rule

This generalizes: when the user explicitly selects option C, do not act on options A or B. Recommendations are pre-selection hints, not post-selection defaults.
