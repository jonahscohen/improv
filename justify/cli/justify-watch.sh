#!/usr/bin/env bash
# justify-watch: the forever Justify watch poller.
# Polls the daemon's /prompts every 2s. NEVER exits on idle - its ONLY exit
# is a real prompt arriving (written to /tmp/justify-inbox.json), which wakes
# the Claude session that launched it. The session relaunches it after
# handling the task; the justify-watch-guard Stop hook enforces that the
# relaunch cannot be forgotten while ~/.claude/.justify-watch-on exists.
# Ending the watch for real = user consent + removing that flag.
while true; do
  R=$(curl -s -m 3 http://localhost:9223/prompts 2>/dev/null)
  if [ -n "$R" ] && [ "$R" != "[]" ]; then
    printf '%s' "$R" > /tmp/justify-inbox.json
    echo "JUSTIFY_TASK_RECEIVED"
    exit 0
  fi
  sleep 2
done
