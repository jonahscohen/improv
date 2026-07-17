#!/usr/bin/env python3
# =============================================================================
#  ####  TRAP FILE. NOT THE POLLER. NOT SOURCE. DO NOT COMMIT. DO NOT RUN.
# =============================================================================
#
#  THE REAL POLLER IS ITS NEIGHBOUR IN THIS VERY DIRECTORY:
#       justify-watch-poller.py   (tracked, committed, improv e805e22e)
#
#  This file is deliberately UNTRACKED, and that is the entire experiment.
#  Do not `git add` it. Do not "tidy up the untracked file in justify/cli".
#  Its untracked-ness is the measurement.
#
#  WHAT IT DISCRIMINATES
#  ---------------------
#  The reconstruction vanished from this exact directory at 2026-07-16 22:30:58
#  while untracked. Its tracked replacement has survived. If the mechanism is
#  something reaping UNTRACKED files in a git repo (H2 - e.g. a `git clean -fd`
#  run by another session in this shared repo), then:
#
#       THIS FILE DIES.                      <- untracked
#       justify-watch-poller.py SURVIVES.    <- tracked, the built-in control
#
#  That single comparison, in one directory, with the same name-prefix, is the
#  cleanest test available for H2. Its partner zz-fvanish-ctl-untracked.txt
#  strips the name out, so together they separate "untracked" from "named".
#
#  Detector: ~/.claude/fvanish/fv-detect.py   Log: ~/.claude/fvanish/fv-log.jsonl
#  Authorised by Jonah, 2026-07-17. Removing the trap is his call, not yours.
# =============================================================================

TRAP = True
REAL_SOURCE = "justify-watch-poller.py (same directory, tracked)"

if __name__ == "__main__":
    raise SystemExit("TRAP file, not the poller. Real source: " + REAL_SOURCE)
