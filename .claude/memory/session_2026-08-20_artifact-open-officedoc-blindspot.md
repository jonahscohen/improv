---
name: artifact-open mandate - office-doc script-creation blind spot
description: The open-mandate only harvests an office-doc deliverable when its path is a literal in the command; script-file/variable creations escape, so the Stop gate never fires
type: project
relates_to: [session_2026-08-19_artifact-open-reflag-diagnosis.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Peer session (ppai-pm) self-reported: built a 26-page .docx on ~/Desktop, verified it via LibreOffice PDF renders (Read the PDFs), declared done - but never OPENED the actual .docx, so it sat closed. The USER caught it ("you failed a critical hook"), not the artifact-open Stop gate. Peer's own root cause was behavioral (conflated verify-render with present-deliverable) and it fixed it by running open on the file.

INVESTIGATION (reproduced against the real mandate hook, 4/4 as predicted, doc OUTSIDE temp to mirror ~/Desktop): the Stop gate DIDN'T back-stop the peer because of a real HARVEST blind spot, not (only) behavior. mandate.sh harvests office docs (.docx/.xlsx/.pptx/.od[tsp]) from Bash ONLY when the OUTPUT PATH IS A LITERAL IN THE COMMAND TEXT:
- A. `doc.save('/abs/x.docx')` literal in command -> RECORDED (caught).
- D. `pandoc in.md -o /abs/x.docx` explicit flag -> RECORDED (caught).
- B. `python3 build_guide.py` (script file, path inside the script) -> NOT recorded (BLIND).
- C. `doc.save(out_path)` variable, no literal -> NOT recorded (BLIND).
Office docs are deliberately NOT harvested from stdout (a mentioned template/input is a false positive) and NOT from bare positionals (inputs). A real 26-page guide is built by a script FILE (shape B), so it was never recorded -> never flagged -> gate silent. Also note: had the doc been in /tmp or a scratchpad, the DOC temp-exclusion would have dropped it too (first probe hit that; ~/Desktop is not excluded).

WHY it is hard to close: the hook cannot see inside build_guide.py. Widening to harvest office paths from stdout would catch the "script prints Saved <path>" case but re-introduces the template/input false-positive the exclusion exists to prevent. A post-Bash cwd/Desktop mtime sweep is racy/expensive. So the hook is a BACKSTOP, not a guarantee: it catches literal-path creations, not script-authored ones.

THE REAL SAFEGUARD IS BEHAVIORAL (the peer's lesson): a FILE deliverable is not delivered until it is OPENED in its application for the user - verification renders (PDF/image previews the assistant Reads to check its own work) are for the assistant, opening the actual file is for the user. This holds regardless of whether the hook fires, because the hook provably can't catch every creation shape.

Options surfaced to Jonah (his call): (A) codify the behavioral rule in the artifact-open mandate guidance only; (B) also widen the hook to harvest office paths from command OUTPUT (partial, false-positive risk); (C) leave as-is.

Files touched: none (investigation only). Repro: crafted Bash JSON -> mandate.sh, pending-file presence per shape.
