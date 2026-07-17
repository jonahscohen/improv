#!/usr/bin/env python3
"""justify-watch-poller - the detached, durable leg of the justify-watch design.

RECONSTRUCTION FROM SPEC (2026-07-16). THIS IS NOT A FAITHFUL RESTORATION.
==========================================================================
The original lived at /tmp/justify-watch-poller.py and was DELETED from disk at an
unknown time by an unknown actor. The process (pid 56045, started 2026-07-10 00:49)
kept running from memory, because CPython compiles a script at startup and never
rereads it - so the watch stayed healthy while its own source no longer existed, and
the "durable" leg of a three-leg design had no recovery path.

This file is that recovery path. It was rebuilt from:
  - the live process's own artifacts (heartbeat JSON, inbox lines, seen file, argv),
    which are EVIDENCE and were preferred over any beat's remembered description
  - /tmp/justify-watch-check, whose assertions are the real contract
  - session_2026-07-10_justify-watch-heartbeat.md (the three-leg design rationale)

Read "WHAT COULD NOT BE RECOVERED" below before trusting any detail marked UNKNOWN.

WHY THIS EXISTS (do not put it "back" in /tmp)
----------------------------------------------
The three-leg design's whole argument is that the poller outlives agents: it is
detached (ppid 1, own session), so a harness task-group SIGTERM cannot reach it.
That durability argument silently assumed the poller could be RESTARTED. It could
not. /tmp was always the bug: the one leg that had to survive was the one leg living
in the directory that guarantees it does not.

The RUNTIME paths below still point at /tmp on purpose - the health check, the ack
script, and wake channel A all read those exact paths, and changing them would break
the live contract. The SOURCE is what had to become durable, not the state.

LAUNCHING IT (deliberately not automatic)
-----------------------------------------
This script does NOT self-daemonize and MUST NOT be started casually. As of
2026-07-16 the ORIGINAL POLLER IS STILL RUNNING as pid 56045. Starting a second one
is worse than having no spare: session_2026-07-10_justify-watch-heartbeat.md records
two pollers racing on the same heartbeat file, `cycle` flip-flopping between two
independent counters, and justify-watch-check printing HEALTHY throughout - because a
fresh heartbeat proves a poller is cycling, never WHICH poller wrote it. The flock
below is the guard, but check by hand first anyway:

    pgrep -fl justify-watch-poller.py      # MUST show no live poller before starting

Then, detached (start_new_session=True is setsid(2); the `setsid` BINARY does not
exist on macOS, so `nohup setsid ...` fails):

    python3 - <<'EOF'
    import subprocess
    subprocess.Popen(
        ["python3", "-u", "<abs-path-to-this-file>"],
        stdin=subprocess.DEVNULL,
        stdout=open("/tmp/justify-watch-poller.err", "ab"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    EOF

`-u` matters: the original ran unbuffered, and buffered stderr on a crash is a lost
postmortem.

FILENAME IS LOAD-BEARING. justify-watch-check finds the poller with
`pgrep -f justify-watch-poller.py` (POLLER_PAT). Renaming this file makes a live
poller report DEAD, which is the exact false-negative that makes someone go restart
or kill a healthy thing.

Related caveat, measured 2026-07-16: that same POLLER_PAT matches ANY process whose
argv mentions this filename - a reviewer, an editor, a grep. The check printed
`poller process : ALIVE (4)` while exactly ONE poller ran, because a Codex review of
this file was in flight. The health VERDICT is unaffected (it keys off heartbeat age),
but never read that count as a poller census. Resolve by command line and ppid instead.

WHAT COULD NOT BE RECOVERED (documented holes, NOT guesses presented as facts)
-----------------------------------------------------------------------------
1. **/prompts polling cadence.** UNKNOWN. Every observed DAEMON-DOWN line names
   `/status` ("DAEMON-DOWN /status unreachable"), so /status is certainly the
   reachability probe. But whether the original ALSO fetched /prompts every 2s, or
   only when /status reported pendingCount > 0, is not recoverable from any artifact.
   A ws-server.ts comment ("Do not rewrite the file on every 2s poll") hints that
   something did poll /prompts at 2s. This reconstruction GATES the /prompts fetch on
   `pendingCount > 0`. That is a DELIBERATE CHOICE, not a recovered fact - see the
   headless hazard below, which is the reason.
2. **BEACON wording when the queue is NOT empty.** UNKNOWN. All 171 observed beacons
   read `queue-empty liveness probe` because the queue was empty for every one of
   them. The non-empty wording below is INVENTED. Nothing reads it (the check only
   requires the literal " BEACON " and a parseable leading ISO timestamp), so this is
   cosmetic - but it is not recovered.
3. **The original's HTTP client.** UNKNOWN (urllib vs curl). urllib is used here: no
   subprocess per cycle, and it keeps the argv clean.
4. **/tmp/justify-watch-poller.err contents.** UNRECOVERABLE. The file was unlinked
   while pid 56045 still held it open (fd 1w/2w), so its inode is alive but
   unreachable by path. Any crash history the original wrote is gone.
5. **Starting cycle number / exact loop drift.** The live poller's beacons land every
   ~3616s of wall time rather than exactly 3600s, which is consistent with a plain
   `sleep(2)` at the end of each cycle (2s + work time) rather than a drift-corrected
   schedule. Reproduced as a plain sleep. This is inference from measurement, not a
   recovered constant.

WHAT IS MEASURED, NOT REMEMBERED
--------------------------------
  BEACON_EVERY_CYCLES = 1800   - derived empirically: the last 6 beacon cycles were
                                 286200/288000/289800/291600/293400/295200, i.e. five
                                 consecutive deltas of exactly 1800, and every one is
                                 divisible by 1800 (so the trigger is `cycle % 1800`).
  heartbeat shape              - copied from the live file, NOT from the beat. The
                                 2026-07-10 beat documents `"announcedIds": []`; the
                                 live poller actually writes `"announcedCount": 10`.
                                 The format changed after that beat was written. The
                                 live process wins.
  INTERVAL_SECONDS = 2         - live heartbeat says "intervalSeconds": 2.
  DAEMON-DOWN -> DAEMON-UP     - observed 2s apart (13:03:34 -> 13:03:36), i.e. ONE
                                 failed cycle flips the state. No retry/backoff.

THE HEADLESS HAZARD (found during reconstruction; applies to the LIVE poller too)
--------------------------------------------------------------------------------
`GET /prompts` stamps `servedToOwnerAt` on every prompt it serves - but ONLY when the
daemon is headless (ws-server.ts gates on `dispatcher.status().headless === true`,
refreshing the stamp at most every 5s). dispatcher.isClaimable() then treats a fresh
stamp as a claim:

    if (p.servedToOwnerAt && now - p.servedToOwnerAt <= this.claimTtlMs) return false;

So a poller that GETs /prompts every 2s while the daemon is HEADLESS would keep that
stamp permanently fresh, isClaimable() would return false forever, the dispatcher
would never claim, and THE QUEUE WOULD WEDGE PERMANENTLY - with justify-watch-check
still printing HEALTHY, because the poller is cycling perfectly the whole time.

This is harmless today: the ppai daemon is in OWNER mode (`headless:false`), where the
stamping branch never runs. It becomes real the moment anyone runs
`justify-serve --headless`. So this reconstruction refuses to touch /prompts when
/status reports `headless: true`.

FLAGGED FOR REVIEW: that guard is an ADDITION. The original may not have had it, and
if the original did poll /prompts unconditionally, then the live pid 56045 carries
this hazard right now.

DELIBERATE DEVIATIONS FROM THE ORIGINAL (additions, not recoveries)
-------------------------------------------------------------------
Each of these is a choice this reconstruction makes. None is a recovered fact, and a
future session should feel free to overrule any of them:
  - the headless /prompts guard + HEADLESS-ON/HEADLESS-OFF inbox lines
  - announce-before-persist ordering, so a crash re-announces rather than loses
  - a failed /prompts fetch counts as a FAILED cycle (no heartbeat), not a quiet skip
  - an outer try/except so a transient OSError cannot kill the watchdog
  - POLLER-ERROR inbox lines on error transitions
  - flock() for single-instance rather than a pid file (see acquire_lock)
  - HTTP_TIMEOUT 3s, so a worst-case cycle stays under the check's 10s HB_MAX_AGE

If this is ever started, WAKE CHANNEL A SHOULD GREP FOR THE NEW VERBS. The current
channel A pattern is "PROMPT|BEACON|DAEMON-DOWN|DAEMON-UP|SELFTEST", which would not
surface POLLER-ERROR, HEADLESS-ON, or HEADLESS-OFF. Add them, or those lines land in
the inbox and wake nobody.

REVIEW HISTORY: two adversarial Codex rounds (2026-07-16) found 9 real defects between
them, including the announce/persist ordering (a silent prompt-loss window), keying the
headless guard off `autoApply` when the server stamps on `headless`, and three separate
races in a pid-file lock that flock made moot. A tenth (os.kill EPERM read as "dead")
was caught by falsifying the lock against pid 1.
"""
import datetime
import fcntl
import json
import os
import sys
import time
import urllib.error
import urllib.request

# Runtime paths stay in /tmp because justify-watch-check, justify-watch-ack.py, and
# wake channel A all read these exact paths. Overridable so a test can exercise every
# branch against fixtures instead of the live watch (same rationale as the check's own
# JW_* overrides - a branch that has never run is not a branch).
HEARTBEAT = os.environ.get("JW_HB", "/tmp/justify-watch-heartbeat.json")
INBOX = os.environ.get("JW_INBOX", "/tmp/justify-watch-inbox.log")
SEEN = os.environ.get("JW_SEEN", "/tmp/justify-watch-seen.txt")
LOCK = os.environ.get("JW_LOCK", "/tmp/justify-watch-poller.lock")

PORT = int(os.environ.get("JUSTIFY_PORT", "9223"))
STATUS_URL = "http://localhost:%d/status" % PORT
PROMPTS_URL = "http://localhost:%d/prompts" % PORT

INTERVAL_SECONDS = 2
BEACON_EVERY_CYCLES = 1800  # 1800 * 2s = hourly. Measured, not remembered.

# MUST keep (status + prompts + sleep) under justify-watch-check's HB_MAX_AGE of 10s,
# or a healthy poller reads POLLER DOWN and someone goes and "fixes" it. At 5s this
# was 5 + 5 + 2 = 12s worst case: a false DEAD on a perfectly live poller, which is
# the single most dangerous thing this probe can say. 3 + 3 + 2 = 8s leaves headroom.
# Found by Codex review, 2026-07-16.
HTTP_TIMEOUT = 3

OWNER = "justify-watch"

# The flock fd. Module-level because it MUST outlive acquire_lock(): flock is released
# the moment the fd closes, so a local would unlock as soon as the function returned.
_LOCK_FD = None


def now_iso():
    """'2026-07-16T21:48:03-04:00' - the format justify-watch-check parses.

    The check does `datetime.fromisoformat(line.split(" ", 1)[0])`, so the timestamp
    must be the FIRST whitespace-delimited token and must contain no spaces.
    """
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def write_atomic(path, text):
    """Temp file in the SAME dir + os.replace.

    A reader must never see a partial heartbeat. os.replace is atomic only within a
    filesystem, hence same-dir temp. This is the property that lets anyone cat the
    heartbeat and get an uncontaminated answer: reading it never writes it.

    Not fsync'd: this is deliberate. The heartbeat is rewritten every 2s and the seen
    file's worst case on power loss is a duplicate announcement, which the design
    already calls harmless. Paying an fsync every cycle to protect state that is
    regenerated every cycle would buy nothing.
    """
    tmp = "%s.tmp.%d" % (path, os.getpid())
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)


def append_inbox(line):
    """The inbox is durable and APPEND-ONLY.

    That is what makes a dead wake channel survivable: prompts keep accumulating on
    disk, so a channel dying DELAYS a prompt and can never LOSE one.
    """
    with open(INBOX, "a") as f:
        f.write(line + "\n")
        f.flush()


def acquire_lock():
    """Single-instance guard. Exit 3 rather than race a live poller.

    Two pollers on one heartbeat file make `cycle` meaningless (it flip-flops between
    two counters) while the health check reports HEALTHY throughout, because a fresh
    heartbeat says nothing about WHO wrote it. That happened on 2026-07-10 and is the
    reason this exists.

    HOW THIS IS LOCKED, AND WHY NOT A PID FILE
    ------------------------------------------
    The original used a pid file plus an os.kill(pid, 0) liveness test. Two rounds of
    review took that approach apart, and it could not be patched into correctness:

      - check-then-write is a TOCTOU race: two restarts both see no lock and both
        proceed; the second pid merely overwrites the file, it does not stop the first
        process (Codex round 1);
      - O_CREAT|O_EXCL fixed the create, but NOT the rest: process A can win the create
        and be pre-empted before writing its pid, so B reads an EMPTY file, concludes
        "unreadable/stale", unlinks A's lock and creates its own - both run. The stale
        path has the mirror race (B reclaims and creates, then A's delayed unlink
        deletes B's LIVE lock), and the bounded retry can even exit 3 in a case where
        it should have acquired (Codex round 2);
      - os.kill(pid, 0) cannot tell dead from not-mine: EPERM means the process EXISTS.
        Reading `except OSError` as "dead" started a second poller. My own falsification
        caught that one against pid 1.

    Every one of those is a symptom of the same disease: a pid file is DATA describing
    a lock, not a lock. flock() is the lock. The kernel arbitrates, so there is no
    window to race in, and - the property that deletes the entire stale-lock problem -
    THE KERNEL RELEASES IT WHEN THE PROCESS DIES. A crashed poller leaves no stale
    lock to reclaim, no pid to second-guess, and no way to block a legitimate restart.

    The fd is deliberately held for the process lifetime: closing it releases the lock.
    The pid is still written INTO the file, purely so a human running
    `cat /tmp/justify-watch-poller.lock` gets a useful answer - it is documentation
    now, not the mechanism.

    DEVIATION: the original did not do this (lsof shows pid 56045 holds no lock fd).
    This is a deliberate correctness upgrade, not a recovered behaviour.
    """
    global _LOCK_FD
    fd = os.open(LOCK, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        try:
            with open(LOCK) as f:
                holder = f.read().strip() or "unknown"
        except OSError:
            holder = "unknown"
        os.close(fd)
        sys.stderr.write(
            "REFUSING TO START - another poller holds %s (pid %s).\n"
            "A second poller corrupts the heartbeat while justify-watch-check still\n"
            "reports HEALTHY, because a fresh heartbeat proves a poller is cycling but\n"
            "never WHICH one. Verify by command line before doing anything:\n"
            "    pgrep -fl justify-watch-poller.py\n" % (LOCK, holder)
        )
        sys.exit(3)

    os.ftruncate(fd, 0)
    os.write(fd, str(os.getpid()).encode())
    _LOCK_FD = fd  # MUST stay open for the process lifetime - closing unlocks.


def get_json(url):
    """Return parsed JSON, or None on ANY failure. None means 'unreachable'.

    The except clause is deliberately `Exception`, not a curated tuple. The curated
    version missed http.client.HTTPException cases (IncompleteRead, BadStatusLine) -
    a truncated or malformed response from a daemon dying mid-write would escape and
    kill the watchdog. Enumerating every exception a stack can raise is a game you
    lose silently, and the cost of losing it is the whole watch. Here, "anything went
    wrong" and "the daemon is unreachable" are the same actionable state, so collapsing
    them is correct rather than lazy. Flagged by Codex review, 2026-07-16.
    """
    try:
        with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def load_seen():
    try:
        with open(SEEN) as f:
            return [ln.strip() for ln in f if ln.strip()]
    except OSError:
        return []


class State:
    """Loop state, so the cycle body can live in its own function under a guard."""

    def __init__(self):
        self.seen = load_seen()
        self.seen_set = set(self.seen)
        # None = no reading yet, so the first cycle cannot emit a spurious
        # DAEMON-UP/DOWN transition for a state nobody has observed. (It also means
        # transitions that happened while the poller was DOWN are never reconstructed
        # - unavoidable, and the beacon is what covers that gap.)
        self.daemon_reachable = None
        self.headless_noted = None
        self.cycle = 0


def cycle_body(st):
    st.cycle += 1
    status = get_json(STATUS_URL)
    # A daemon that returns valid JSON of the WRONG top-level type (a list, a string)
    # would sail past `is not None` and then blow up on status.get(...) with an
    # AttributeError, killing the watchdog. Treat a non-dict body as unreachable: we
    # cannot read pendingCount from it, which is the only reason we called. Flagged by
    # Codex review, 2026-07-16.
    if not isinstance(status, dict):
        status = None
    reachable = status is not None

    # Emit on TRANSITIONS only. A poller that reports only prompts is silent both
    # when there is no work and when the daemon has died; those two must never
    # look the same.
    if st.daemon_reachable is not None and reachable != st.daemon_reachable:
        if reachable:
            append_inbox("%s DAEMON-UP /status responding again" % now_iso())
        else:
            append_inbox("%s DAEMON-DOWN /status unreachable" % now_iso())
    st.daemon_reachable = reachable

    pending = 0
    if reachable:
        try:
            pending = int(status.get("pendingCount", 0) or 0)
        except (TypeError, ValueError):
            pending = 0

    # Only reach for /prompts when there is something to fetch, and never while
    # the daemon is headless. See THE HEADLESS HAZARD in the module docstring:
    # polling /prompts under headless keeps servedToOwnerAt fresh and wedges the
    # queue forever while the health check still reads HEALTHY.
    #
    # KEY OFF `headless`, NOT `autoApply`. They are NOT the same field:
    #     headless:  dispatch.headless === true
    #     autoApply: armed && dispatcherRunning && dispatch.headless === true
    # and ws-server.ts stamps servedToOwnerAt on `dispatcher.status().headless === true`.
    # So a daemon that is headless but DISARMED (or whose dispatcher is momentarily
    # not running) reports headless:true, autoApply:false - and this guard, keyed on
    # autoApply, would have happily polled /prompts while the server stamped every
    # one. The prompts then look handed-to-an-owner and are not claimable until the
    # claim TTL expires: exactly the wedge the guard exists to prevent, reintroduced
    # by reading the friendlier-sounding field. Match the stamping condition EXACTLY.
    # Codex round 2, 2026-07-16.
    headless = bool(status.get("headless")) if reachable else False

    # The skip must never be SILENT. Suppressing announcements without saying so
    # would make "headless mode is handling it" look identical to "the poller has
    # gone blind" - the exact ambiguity the DAEMON-UP/DOWN transitions exist to kill.
    # Emitted on transition only, so it cannot spam.
    if reachable and headless != st.headless_noted:
        if headless:
            append_inbox(
                "%s HEADLESS-ON /prompts polling suspended; daemon is headless "
                "(polling it would wedge the queue via servedToOwnerAt)" % now_iso()
            )
        elif st.headless_noted is not None:
            append_inbox("%s HEADLESS-OFF /prompts polling resumed; owner mode" % now_iso())
        st.headless_noted = headless

    if reachable and pending > 0 and not headless:
        prompts = get_json(PROMPTS_URL)
        # A FAILED /prompts FETCH IS A FAILED CYCLE, not a quiet skip. Silently
        # continuing here wrote a fresh heartbeat while pending prompts went
        # unannounced: the check reads HEALTHY, the queue sits, and nobody is told.
        # That is the precise "green while broken" failure this whole watch exists to
        # make impossible. Raising sends it to main()'s handler, which logs
        # POLLER-ERROR and - by skipping the heartbeat write - lets the heartbeat go
        # stale so the check reports POLLER DOWN. One transient blip costs ~4s of
        # heartbeat age (well under the 10s HB_MAX_AGE), so this cannot false-alarm;
        # only a persistent failure trips it. Codex round 2, 2026-07-16.
        if not isinstance(prompts, list):
            raise RuntimeError(
                "/prompts unreadable while /status reports pendingCount=%d" % pending
            )
        new_ids = []
        for p in prompts:
            if not isinstance(p, dict):
                continue
            pid = str(p.get("id", "") or "")
            if not pid or pid in st.seen_set:
                continue
            # ANNOUNCE FIRST, THEN PERSIST. The reverse order (which this file
            # originally had) marks a prompt seen and can then die before the inbox
            # line lands - so a restart never announces it and the prompt is LOST
            # SILENTLY. This order can instead re-announce a prompt after a crash,
            # which the design explicitly calls harmless: dedup plus claim-before-work
            # make double-application impossible, and
            # session_2026-07-10_justify-watch-heartbeat.md states the invariant
            # directly - a failure may DELAY a prompt, it must never LOSE one.
            # I had that backwards; Codex caught it, 2026-07-16.
            append_inbox("%s PROMPT %s :: %s" % (now_iso(), pid, json.dumps(p)))
            st.seen_set.add(pid)
            st.seen.append(pid)
            new_ids.append(pid)
        # One rewrite per batch, not per prompt: a full-file rewrite inside the
        # per-prompt loop turns seen-file growth into cycle latency, which shows up as
        # a stale heartbeat and a false POLLER DOWN.
        if new_ids:
            write_atomic(SEEN, "\n".join(st.seen) + "\n")

    # The beacon is what makes a STALE ACK MEAN SOMETHING. An empty queue means
    # nothing arrives, means nothing to ack, so without a beacon a healthy-but-idle
    # agent and a deaf agent are indistinguishable. Hourly: the 10-minute version woke
    # Jonah ~50 times a night.
    if st.cycle % BEACON_EVERY_CYCLES == 0:
        # "queue-empty" is the observed wording; the non-empty form is INVENTED (the
        # queue was empty for all 171 recorded beacons). Cosmetic only.
        qtext = "queue-empty" if pending == 0 else "queue-%d pending" % pending
        append_inbox("%s BEACON cycle %d %s liveness probe" % (now_iso(), st.cycle, qtext))

    # Heartbeat LAST, and only on a cycle that got this far. Shape copied from the
    # LIVE file, not from the beat - the beat's `announcedIds` is out of date; the
    # live poller writes `announcedCount`. justify-watch-check reads only `cycle` and
    # `epoch`, but the rest is kept byte-compatible so any other reader keeps working.
    #
    # Deliberately NOT written on a failed cycle: a poller that is spinning but not
    # doing its job must not advertise a fresh heartbeat. Letting it go stale makes
    # the check say POLLER DOWN, which is the truth.
    write_atomic(
        HEARTBEAT,
        json.dumps(
            {
                "owner": OWNER,
                "pid": os.getpid(),
                "cycle": st.cycle,
                "at": now_iso(),
                "epoch": int(time.time()),
                "intervalSeconds": INTERVAL_SECONDS,
                "daemonReachable": reachable,
                "pendingCount": pending,
                "announcedCount": len(st.seen_set),
            }
        ),
    )


def main():
    acquire_lock()
    st = State()
    last_error = None

    while True:
        # A WATCHDOG MUST NOT DIE OF A TRANSIENT ERROR. Without this guard an OSError
        # from a full disk (ENOSPC), an EIO, a PermissionError, or any other one-off
        # would exit the process permanently - and since nothing supervises this poller
        # (it is reparented to launchd, not managed by it), "exits" means "the watch is
        # blind until a human notices". That is precisely the failure this file exists
        # to prevent, so it must not be the way it fails.
        # Flagged by Codex review, 2026-07-16.
        #
        # `Exception` (not BaseException) on purpose: KeyboardInterrupt and SystemExit
        # must still terminate, including the sys.exit(3) from the lock guard.
        try:
            cycle_body(st)
            last_error = None
        except Exception as e:
            # Report on CHANGE only, or a persistent fault would append every 2s and
            # bury the inbox. The heartbeat is already going stale on this path, which
            # is the signal that actually matters.
            #
            # str(e), NOT repr(e): repr of an OSError DROPS the filename
            # (`PermissionError(13, 'Permission denied')`), so a failing seen-file
            # write and a failing heartbeat write collapse to the SAME key and the
            # second is silently suppressed - two different faults reported as one.
            # str() keeps the path (`[Errno 13] Permission denied: '/tmp/...'`).
            # Codex round 2, 2026-07-16.
            current = "%s: %s" % (type(e).__name__, e)
            if current != last_error:
                try:
                    append_inbox("%s POLLER-ERROR %s" % (now_iso(), current))
                    # Only latch AFTER the append lands. Latching first meant a single
                    # failed inbox write permanently suppressed that error, so it was
                    # never re-reported once the inbox recovered.
                    last_error = current
                except Exception:
                    pass  # inbox itself is failing; the stale heartbeat still tells
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
