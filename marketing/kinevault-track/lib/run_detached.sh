#!/usr/bin/env bash
# Run a long job (a render) fully detached so it survives the end of your tool call,
# then poll the log. In some agent sandboxes a plain `cmd &` is killed when the call returns.
#
#   scripts/run_detached.sh render.log python3 my_reel.py video silent.mp4 6
#   tail -n 2 render.log          # poll; the job prints 'done ...' when finished
#   pgrep -f my_reel.py           # empty output == finished (or died: check the log)
LOG="$1"; shift
setsid nohup "$@" > "$LOG" 2>&1 < /dev/null &
echo "started pid $! -> $LOG"
