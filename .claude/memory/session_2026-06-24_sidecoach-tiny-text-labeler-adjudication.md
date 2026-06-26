---
name: sidecoach-tiny-text-labeler-adjudication
description: Adjudicated the tiny-text "liberal labeler" fork - labeler is SOUND (verified), the detector's FEATURE was wrong; sets the taste-frontier posture
type: decision
relates_to: [session_2026-06-24_sidecoach-taste-prioritization.md, session_2026-06-24_sidecoach-batch2-regression-ruling.md]
---

Collaborator: Jonah Cohen.

Building tiny-text (highest-weight taste class, eval 66), the architect hit a signal-validity fork and surfaced it before building (good): it claimed the Codex labeler is LIBERAL (marks 12px captions present, tiny-text on 22/22 dev), so chasing dev recall = tuning to a liberal referee + tanking precision. It recommended (A) a precision-first min-font-size detector (body<12px OR interface<=10px) that DISAGREES with the labeler, treating the disagreement as "labeler liberality." Options offered: A (build it), B (re-label first), C (a threshold I pick).

## I VERIFIED the labeler before adjudicating (it has been wrong before) - claim REFUTED
Pulled the actual tiny-text label notes+confidence (frozen-90: 66 present / 24 absent):
- PRESENT notes: "dense lists use very small text", "dense body text appears very small", "many labels strain readability", "much text is very small", "extremely small".
- ABSENT notes: "small but generally readable", "footer is small but readable", "main text readable", "comfortably readable".
The labeler is NOT mechanically flagging 12px. It discriminates PERVASIVE/DENSE small text that strains reading (present) from ISOLATED small footer/label with a READABLE body (absent) - a faithful holistic application of the rubric's "strains readability." 24 absents prove it isn't marking everything present.

## Decision: NONE of A/B/C as framed. The labeler is sound; the FEATURE is wrong.
The architect reduced a holistic "strains readability" judgment to MIN-FONT-SIZE. Min-font-size over-fires because every page has some 12px text - but that's a DETECTOR feature defect, not labeler liberality. The labeler responds to the AMOUNT/DENSITY/PROMINENCE of small text. Build the detector on THAT: proportion of rendered text (by amount/area) below a comfort threshold, and/or small text in BODY/content regions vs only peripheral footer/labels. That is spec-grounded ("strains readability" = lots of hard-to-read text) AND it will match the labeler because both track the SAME phenomenon - agreement as CONSEQUENCE, not tuning.

**Alternatives considered:**
- A (min-font-size detector, dismiss disagreement as liberality): REJECTED. The labels are sound (verified); a detector that disagrees with a sound GT and explains it away as "liberal" is the architect tuning the GT out of its way because its chosen feature is too weak. Also "labeler is liberal whenever it disagrees with me" is unfalsifiable - the exact escape hatch to deny.
- B (re-label the frozen GT): REJECTED. The GT is correct; re-labeling sound labels = corrupting the held-out for the detector's convenience. (Re-labeling is only legitimate if the label NOTES show genuine rubric deviation, which they don't here.)

**Why this one:** the mission claim ("beat oracle's subjective recall") is only sound if measured against a GT we stand behind. The GT is sound, so we match it - with a feature that captures the real phenomenon, not a weak proxy. This is the objective-axis principle inverted: there I said "justify by spec, agreement-with-referee is a consequence"; here "match the phenomenon the rubric names, agreement-with-labeler is a consequence."

**Revisit when:** a SPECIFIC class's label NOTES show genuine rubric deviation (then I tighten that rubric + re-label that class blind via Codex on dev+frozen-90+re-measure both competitors). Default is NOT "labeler liberal."

## Posture for the whole taste frontier (this fork set it)
1. The Codex subjective labels are the GT. Disagreement is the DETECTOR's problem to solve with a better feature, UNLESS the label notes show real rubric deviation (surface the notes, I adjudicate on data).
2. Don't reduce a holistic taste idiom to a single mechanical threshold; match the signal the labeler actually uses (density/proportion/region/prominence).
3. Precision still first-class: the density/region feature also FIXES the over-fire (the 24 negatives = small footer + readable body -> low small-text proportion -> won't fire).
4. "Liberal labeler" is not a default escape hatch; it requires evidence in the notes.

Verified via: candidates.json tiny-text subjectiveLabels notes/confidence (66 present / 24 absent).
