#!/usr/bin/env python3
"""fv-detect - catch the file-vanishing phenomenon IN THE ACT.

Two files named justify-watch-poller.py have vanished in one week from two
unrelated directories (/tmp on ~Jul 10-16, and the improv working tree at
2026-07-16 22:30:58). Neither deletion was observed. This detector exists to
make the NEXT one observable, with a timestamp and a process context.

It NEVER deletes anything. It only stats and logs.

NAMING: nothing here contains "poller". If deletion-by-name (H1) is the real
mechanism, a detector named after its quarry could be eaten alongside it.

DURABILITY: lives in ~/.claude/fvanish/, not /tmp (which ate the original) and
not as an untracked file in a git repo (which ate the reconstruction). Created
via a shell heredoc rather than the Write tool, deliberately - see H4.

HYPOTHESES THIS DISCRIMINATES
-----------------------------
  H1  deletion by NAME            -> only name-matching traps die
  H2  reaps UNTRACKED files in a git repo (a `git clean -fd`)
                                  -> only the repo-untracked traps die; the
                                     TRACKED real poller survives (built-in control)
  H3  reaps by directory or AGE   -> largely FALSIFIED already: /tmp/justify-watch-ack.py
                                     (Jul 10 00:14) is OLDER than the poller and
                                     survived, and there is no clean-tmps script.
                                     Recorded as prior evidence, not re-derived.
  H4  the harness's own checkpoint/rewind, which reverts files created with the
      Write tool -> only the Write-tool-created traps die, regardless of name or
      location. This is why creation METHOD is an axis: the vanished
      reconstruction was written with the Write tool.

The matrix is factorial across (name matches, location, creation method), so a
single deletion event votes for exactly one hypothesis.
"""
import datetime
import json
import os
import subprocess
import time

BASE = os.path.expanduser("~/.claude/fvanish")
LOG = os.path.join(BASE, "fv-log.jsonl")
HB = os.path.join(BASE, "fv-heartbeat.json")
SNAPDIR = os.path.join(BASE, "snapshots")
INTERVAL = 2

REPO = os.path.expanduser("~/Documents/Github/improv/justify/cli")

# path -> (label, name_matches, location, creation_method)
TRAPS = {
    "/tmp/justify-watch-poller.py":
        ("T1-exact-name-tmp-write", True, "tmp", "write-tool"),
    "/tmp/zz-fvanish-ctl-write.txt":
        ("T2-control-tmp-write", False, "tmp", "write-tool"),
    "/tmp/justify-watch-poller-bashmade.py":
        ("T3-name-tmp-bash", True, "tmp", "bash"),
    "/tmp/zz-fvanish-ctl-bash.txt":
        ("T4-control-tmp-bash", False, "tmp", "bash"),
    os.path.join(REPO, "justify-watch-poller-untracked-trap.py"):
        ("T5-name-repo-untracked-write", True, "repo-untracked", "write-tool"),
    os.path.join(REPO, "zz-fvanish-ctl-untracked.txt"):
        ("T6-control-repo-untracked-bash", False, "repo-untracked", "bash"),
    # BUILT-IN CONTROL: tracked + committed. If this ever dies, H2 is dead and
    # something far more aggressive is loose.
    os.path.join(REPO, "justify-watch-poller.py"):
        ("C0-REAL-tracked-committed", True, "repo-TRACKED", "write-tool"),
}


def now_iso():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def log(rec):
    rec["at"] = now_iso()
    rec["epoch"] = int(time.time())
    with open(LOG, "a") as f:
        f.write(json.dumps(rec) + "\n")
        f.flush()


def probe(path):
    """Existence + inode + mtime. An inode CHANGE means replaced, not deleted -
    those are different events and conflating them would waste the whole trap."""
    try:
        st = os.stat(path)
        return {"exists": True, "inode": st.st_ino, "mtime": int(st.st_mtime), "size": st.st_size}
    except OSError:
        return {"exists": False, "inode": None, "mtime": None, "size": None}


def capture(path, label, prev):
    """The correlation IS the point. A log that says 'it vanished at some point'
    is worthless, so grab the process table before the culprit exits."""
    os.makedirs(SNAPDIR, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
    snap = os.path.join(SNAPDIR, "ps-%s-%s.txt" % (label, stamp))
    ps_ok, hist_ok = False, False
    try:
        with open(snap, "w") as f:
            f.write(subprocess.run(["ps", "aux"], capture_output=True, text=True, timeout=15).stdout)
        ps_ok = True
    except Exception:
        pass
    hist = os.path.join(SNAPDIR, "hist-%s-%s.txt" % (label, stamp))
    try:
        h = os.path.expanduser("~/.zsh_history")
        with open(h, "rb") as src:
            data = src.read()[-20000:]
        with open(hist, "wb") as dst:
            dst.write(data)
        hist_ok = True
    except Exception:
        pass
    log({
        "event": "VANISHED",
        "label": label,
        "path": path,
        "prev": prev,
        "ps_snapshot": snap if ps_ok else None,
        "history_snapshot": hist if hist_ok else None,
    })


def main():
    state = {p: probe(p) for p in TRAPS}
    log({"event": "DETECTOR-START", "pid": os.getpid(),
         "initial": {TRAPS[p][0]: state[p]["exists"] for p in TRAPS}})
    cycle = 0
    while True:
        cycle += 1
        for path, meta in TRAPS.items():
            label = meta[0]
            cur = probe(path)
            prev = state[path]
            if prev["exists"] and not cur["exists"]:
                capture(path, label, prev)
            elif prev["exists"] and cur["exists"] and prev["inode"] != cur["inode"]:
                log({"event": "REPLACED", "label": label, "path": path,
                     "old_inode": prev["inode"], "new_inode": cur["inode"]})
            elif not prev["exists"] and cur["exists"]:
                log({"event": "REAPPEARED", "label": label, "path": path})
            state[path] = cur
        # A detector that is silent when idle cannot prove it is alive - the exact
        # lesson from session_2026-07-10_justify-watch-heartbeat.md. Reading this
        # never writes it.
        tmp = HB + ".tmp"
        with open(tmp, "w") as f:
            json.dump({"owner": "fv-detect", "pid": os.getpid(), "cycle": cycle,
                       "at": now_iso(), "epoch": int(time.time()),
                       "alive": sum(1 for p in state if state[p]["exists"]),
                       "of": len(TRAPS)}, f)
        os.replace(tmp, HB)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
