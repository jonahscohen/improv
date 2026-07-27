#!/bin/sh
input=$(cat)

# Graceful degradation: if jq isn't installed, render a minimal statusline
# instead of failing the hook with command-not-found errors. Claude Code
# would otherwise spam the prompt with errors on every render.
if ! command -v jq >/dev/null 2>&1; then
  printf 'no-jq | install with: brew install jq'
  exit 0
fi

# One jq pass extracts every payload-derived field. This runs on every render, so
# it is deliberately a single process rather than one jq call per field.
#
# Two sanitising rules, because every displayed value ends up in printf '%b':
#   clean - drop real control bytes. jq -r decodes JSON escapes for ESC and for
#           newline before the shell ever sees them, so an unsanitised session
#           name could inject ANSI colour or split the line across extra lines.
#   dbs   - double backslashes, so a name like "Opus \c5" renders literally
#           instead of %b reading \c as "stop output" and truncating the line.
# cwd is emitted clean but NOT doubled: it is a real path handed to git, not text.
# Every lookup is `?`-guarded so a wrong parent type (e.g. "model": true) cannot
# put a jq diagnostic on stderr, and percentages go through `numbers` so a
# non-numeric value renders no segment rather than a misleading 0%.
# Fields are joined with U+001F, which cannot survive `clean`, so an empty field
# in the middle still holds its position. The trailing "." absorbs the shell's
# stripping of trailing separators.
fields=$(printf '%s' "$input" | jq -r '
def clean: if type == "string" then (explode | map(select(. > 31 and . != 127)) | implode) else "" end;
def dbs: gsub("\\\\"; "\\\\");
def disp: clean | dbs;
def base: clean as $p
  | ($p | sub("/+$"; "") | split("/") | last // "") as $b
  | if $b == "" and ($p | startswith("/")) then "/" else $b end;
[ ( (.session_name? // "" | disp) as $s
    | if $s != "" then $s else (.workspace?.project_dir? // "" | base | dbs) end ),
  ( .model?.display_name? // .model?.id? // "" | disp | sub(" *\\([^()]*\\)$"; "") ),
  ( .effort?.level? // "" | disp ),
  ( .workspace?.current_dir? // .cwd? // "" | clean ),
  ( .workspace?.current_dir? // .cwd? // "" | base | dbs ),
  ( ((.context_window?.used_percentage? | numbers | round) // "") | tostring ),
  ( ((.rate_limits?.five_hour?.used_percentage? | numbers | round) // "") | tostring ),
  ( ((.rate_limits?.seven_day?.used_percentage? | numbers | round) // "") | tostring ),
  "."
] | join([31] | implode)')

# Split on U+001F only. `set -f` keeps a field containing * from being glob-expanded;
# word splitting never re-scans for command substitution, so payload text cannot run.
old_ifs=$IFS
IFS=$(printf '\037')
set -f
# shellcheck disable=SC2086
set -- $fields
set +f
IFS=$old_ifs

# project_name: session_name if set, else the basename of project_dir
project_name=$1
model_name=$2
effort=$3
cwd=$4
dir_name=$5
ctx_pct=$6
session_pct=$7
week_pct=$8

# Git branch and changes (skip optional locks to avoid contention).
# The braces matter: without them this parses as ([ -n ] && [ -d ]) || git, so an
# empty cwd fell through to `git -C ""`, which reports whatever directory the
# statusline process happens to be in.
branch=""
git_added=""
git_deleted=""
if [ -n "$cwd" ] && { [ -d "$cwd/.git" ] || git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; }; then
  # Ref names cannot contain control bytes or backslashes, so no sanitising needed
  branch=$(git -C "$cwd" -c core.gvfs-prune=false --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)
  git_stat=$(git -C "$cwd" --no-optional-locks diff --shortstat HEAD 2>/dev/null)
  if [ -n "$git_stat" ]; then
    git_added=$(echo "$git_stat" | sed -n 's/.* \([0-9]*\) insertion.*/\1/p')
    git_deleted=$(echo "$git_stat" | sed -n 's/.* \([0-9]*\) deletion.*/\1/p')
  fi
fi

# Line 1: project, dir, branch. No separators.
line1=""

if [ -n "$project_name" ]; then
  line1="project \033[1;36m${project_name}\033[0m"
fi

if [ -n "$dir_name" ]; then
  [ -n "$line1" ] && line1="${line1}  "
  line1="${line1}dir \033[1;36m${dir_name}\033[0m"
fi

if [ -n "$branch" ]; then
  [ -n "$line1" ] && line1="${line1}  "
  line1="${line1}branch \033[1;36m${branch}\033[0m"
  changes=""
  if [ -n "$git_added" ] && [ "$git_added" -gt 0 ] 2>/dev/null; then
    changes="\033[32m+${git_added}\033[0m"
  fi
  if [ -n "$git_deleted" ] && [ "$git_deleted" -gt 0 ] 2>/dev/null; then
    [ -n "$changes" ] && changes="${changes} "
    changes="${changes}\033[31m-${git_deleted}\033[0m"
  fi
  if [ -n "$changes" ]; then
    line1="${line1} ${changes}"
  fi
fi

# Line 2: model and effort, then usage percentages. No bars.
meta=""
if [ -n "$model_name" ]; then
  meta="model \033[1;36m${model_name}"
  [ -n "$effort" ] && meta="${meta}, ${effort}"
  meta="${meta}\033[0m"
elif [ -n "$effort" ]; then
  # No model to hang the effort off, so it stands on its own label
  meta="effort \033[1;36m${effort}\033[0m"
fi

usage_parts=""

if [ -n "$ctx_pct" ]; then
  usage_parts="ctx \033[32m${ctx_pct}%\033[0m"
fi

if [ -n "$session_pct" ]; then
  [ -n "$usage_parts" ] && usage_parts="${usage_parts}  "
  usage_parts="${usage_parts}session \033[32m${session_pct}%\033[0m"
fi

if [ -n "$week_pct" ]; then
  [ -n "$usage_parts" ] && usage_parts="${usage_parts}  "
  usage_parts="${usage_parts}week \033[32m${week_pct}%\033[0m"
fi

line2="$meta"
if [ -n "$usage_parts" ]; then
  [ -n "$line2" ] && line2="${line2}  "
  line2="${line2}usage ${usage_parts}"
fi

# Output
if [ -n "$line1" ]; then
  printf '%b\n' "$line1"
fi
if [ -n "$line2" ]; then
  printf '%b\n' "$line2"
fi
