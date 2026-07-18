#!/bin/bash
# test-figma-optout-block.sh
#
# The Figma-fidelity gate must NOT be escapable by deleting/editing/aliasing/
# redirecting-over the arming record .figma-fidelity.pending. Hardened 2026-07-18
# (Jonah) after the agent used the "delete the line to opt out" shortcut, then
# RE-hardened 2026-07-18 (Jonah) folding TWO rounds of real Codex review that
# found the first pass leaked whole classes of bypass AND over-blocked.
#
# Two tool-level guards enforce it:
#   - bash-guard.sh   blocks a mutating command / redirect whose resolved target
#                     IS our marker (PATH-equality OR realpath/samefile), with
#                     quote/escape/var/brace/glob normalization, recursive-delete
#                     and search-root (tree) handling, and conservative denial of
#                     an unresolvable $-target while a build is armed.
#   - content-guard.sh blocks Write/Edit/MultiEdit whose file_path IS our marker
#                     (path-equality OR samefile alias).
# Both must ALSO leave legitimate ops untouched (reads, manifest/.measuring
# writes, near-miss filenames, OTHER repos markers, cp/install source reads,
# unrelated $-var writes in an unarmed repo). Every vector is falsified BOTH ways.
#
# ARMED vs UNARMED matters: a "$-unresolvable", glob, or recursive-delete target
# is denied conservatively ONLY while a build is armed (marker present). So each
# case runs in a tempdir that is the pseudo repo-root: UNARM has no marker,
# ARM has the marker (+ a symlink and hardlink alias). Running the guard from
# that cwd makes a bare `.figma-fidelity.pending` resolve to the marker PATH,
# which is exactly how the path-scoped match is meant to work.
#
# KNOWN GAP (accepted residual, do not "fix" here): arbitrary python/perl inline
# writes (`python3 -c "open(...,'w')"`) are unparseable from command text; closed
# separately by the Level-2 architectural change (arm/clear authority out of the
# agent's tool reach).
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
BG="$HOOK_DIR/bash-guard.sh"
CG="$HOOK_DIR/content-guard.sh"
fail=0

# decision <hook> <json> <cwd>  ->  BLOCK | ALLOW  (cwd is the pseudo repo-root)
decision() {
  printf '%s' "$2" | ( cd "$3" && bash "$1" ) 2>/dev/null | python3 -c 'import json,sys
try: d=json.load(sys.stdin)
except: print("ALLOW"); sys.exit()
print("BLOCK" if d.get("hookSpecificOutput",{}).get("permissionDecision")=="deny" else "ALLOW")'
}
bcmd() { python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1"; }
# Build Write/Edit payloads from a file_path passed as a CLEAN argv (no shell
# JSON-escaping), so an interpolated tempdir path cannot corrupt the JSON.
cedit()   { python3 -c 'import json,sys; print(json.dumps({"tool_name":"Edit","tool_input":{"file_path":sys.argv[1],"old_string":"a","new_string":""}}))' "$1"; }
cwritef() { python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1],"content":"z"}}))' "$1"; }
ck() { # desc want got
  local m="PASS"; [ "$2" != "$3" ] && { m="FAIL"; fail=1; }
  echo "[$m] want=$2 got=$3 : $1"
}

UN="$(mktemp -d)"                                            # unarmed repo-root
AR="$(mktemp -d)"                                            # armed repo-root
printf '1236:10950\n' > "$AR/.figma-fidelity.pending"
mkdir -p "$AR/build"; : > "$AR/x.log"; : > "$AR/somefile.txt"
ln -s "$AR/.figma-fidelity.pending" "$AR/alias" 2>/dev/null  # symlink alias
ln    "$AR/.figma-fidelity.pending" "$AR/hard"  2>/dev/null  # hardlink alias
BU() { decision "$BG" "$(bcmd "$1")" "$UN"; }                # bash-guard, UNARMED cwd
BA() { decision "$BG" "$(bcmd "$1")" "$AR"; }                # bash-guard, ARMED cwd

echo "=== bash-guard UNARMED: opt-out vectors must BLOCK ==="
ck "rm literal"             BLOCK "$(BU 'rm -f .figma-fidelity.pending')"
ck "grep -v then mv"        BLOCK "$(BU 'grep -v 12:34 .figma-fidelity.pending > t && mv t .figma-fidelity.pending')"
ck "sed -i delete"          BLOCK "$(BU 'sed -i "" /12/d .figma-fidelity.pending')"
ck "truncate"              BLOCK "$(BU 'truncate -s 0 .figma-fidelity.pending')"
ck "redirect over"         BLOCK "$(BU 'printf x > .figma-fidelity.pending')"
ck "redirect append >>"    BLOCK "$(BU 'printf x >> .figma-fidelity.pending')"
ck "redirect >| (bash)"    BLOCK "$(BU 'printf x >| .figma-fidelity.pending')"
ck "redirect >! (zsh)"     BLOCK "$(BU 'printf x >! .figma-fidelity.pending')"
ck "redirect >>! (zsh)"    BLOCK "$(BU 'printf x >>! .figma-fidelity.pending')"
ck "redirect quoted"       BLOCK "$(BU 'printf x > ".figma-fidelity.pending"')"
ck "redirect heredoc"      BLOCK "$(decision "$BG" "$(printf '%s' '{"tool_input":{"command":"cat <<EOF > .figma-fidelity.pending\n1236:1\nEOF\n"}}')" "$UN")"
ck "quote-concat"          BLOCK "$(BU "rm .figma-fidelity'.pending'")"
ck "backslash escape"      BLOCK "$(BU 'rm .figma-fidelity\.pending')"
ck "var p; rm \$p"          BLOCK "$(BU 'p=.figma-fidelity.pending; rm "$p"')"
ck "\$PWD prefix redirect"  BLOCK "$(BU 'printf x > "$PWD/.figma-fidelity.pending"')"
ck "brace mv{,.bak}"       BLOCK "$(BU 'mv .figma-fidelity.pending{,.bak}')"
ck "brace .{pending,json}" BLOCK "$(BU 'rm .figma-fidelity.{pending,json}')"
ck "group cmd { rm ; }"    BLOCK "$(BU '{ rm .figma-fidelity.pending; }')"
ck "subshell ( rm )"       BLOCK "$(BU '(rm .figma-fidelity.pending)')"
ck "unlink"                BLOCK "$(BU 'unlink .figma-fidelity.pending')"
ck "install /dev/null"     BLOCK "$(BU 'install /dev/null .figma-fidelity.pending')"
ck "find -delete named"    BLOCK "$(BU 'find . -name .figma-fidelity.pending -delete')"
ck "ed"                    BLOCK "$(BU 'ed .figma-fidelity.pending')"
ck "ex -s"                 BLOCK "$(BU 'ex -s .figma-fidelity.pending')"
ck "tee"                   BLOCK "$(BU 'echo x | tee .figma-fidelity.pending')"
ck "dd of="                BLOCK "$(BU 'dd if=/dev/null of=.figma-fidelity.pending')"
ck "cp over (dest)"        BLOCK "$(BU 'cp /dev/null .figma-fidelity.pending')"
ck "git rm"                BLOCK "$(BU 'git rm -f .figma-fidelity.pending')"
ck "perl -pi in-place"     BLOCK "$(BU 'perl -pi -e s/a/b/ .figma-fidelity.pending')"
ck "sort -o"               BLOCK "$(BU 'sort -o .figma-fidelity.pending x')"
ck "sponge"                BLOCK "$(BU 'echo x | sponge .figma-fidelity.pending')"
ck "patch"                 BLOCK "$(BU 'patch .figma-fidelity.pending < d.diff')"
ck "ln -s marker (src)"    BLOCK "$(BU 'ln -s .figma-fidelity.pending p; printf x > p')"
ck "ln hardlink (src)"     BLOCK "$(BU 'ln .figma-fidelity.pending p; truncate -s 0 p')"
ck "bash -c payload"       BLOCK "$(BU 'bash -c "rm .figma-fidelity.pending"')"
ck "bash -c escaped word"  BLOCK "$(BU 'bash -c rm\ .figma-fidelity.pending')"
ck "eval payload"          BLOCK "$(BU 'eval rm .figma-fidelity.pending')"
ck "eval quoted+unquoted"  BLOCK "$(BU "eval 'rm' .figma-fidelity.pending")"
ck "eval whole quoted"     BLOCK "$(BU 'eval "rm .figma-fidelity.pending"')"
ck "var holds cmd; \$S"     BLOCK "$(BU 'S="rm .figma-fidelity.pending"; $S')"
ck "var cmd; eval \$S"      BLOCK "$(BU 'S="rm .figma-fidelity.pending"; eval "$S"')"
ck "var cmd; bash -c \$S"   BLOCK "$(BU 'S="rm .figma-fidelity.pending"; bash -c "$S"')"
ck "zsh noglob rm"         BLOCK "$(BU 'noglob rm .figma-fidelity.pending')"
ck "zsh nocorrect mv"      BLOCK "$(BU 'nocorrect mv .figma-fidelity.pending x')"
ck "find -exec rm literal" BLOCK "$(BU 'find . -name nope -exec rm .figma-fidelity.pending \;')"
ck "cp INTO dir dest"      BLOCK "$(BU 'cp /other/.figma-fidelity.pending .')"
ck "redirect >& file"      BLOCK "$(BU 'printf x >& .figma-fidelity.pending')"
ck "redirect >&file"       BLOCK "$(BU 'printf x >&.figma-fidelity.pending')"
ck "env -S payload"        BLOCK "$(BU "env -S 'rm .figma-fidelity.pending'")"
ck "echo mk | xargs rm"    BLOCK "$(BU 'echo .figma-fidelity.pending | xargs rm')"
ck "find mk | xargs -0 rm" BLOCK "$(BU 'find . -name .figma-fidelity.pending -print0 | xargs -0 rm')"
ck "find -o multi -delete" BLOCK "$(BU 'find . -name nope -o -name .figma-fidelity.pending -delete')"
ck "exec 3<> marker fd"    BLOCK "$(BU 'exec 3<> .figma-fidelity.pending; printf x >&3')"
ck "vim -es marker"        BLOCK "$(BU 'vim -es .figma-fidelity.pending +wq')"
ck "nano marker"           BLOCK "$(BU 'nano .figma-fidelity.pending')"
ck "emacs --batch marker"  BLOCK "$(BU 'emacs --batch .figma-fidelity.pending --eval x')"
ck "sqlite3 marker"        BLOCK "$(BU 'sqlite3 .figma-fidelity.pending .tables')"
ck "rename marker"         BLOCK "$(BU 'rename .pending .bak .figma-fidelity.pending')"
ck "cp -al bundled alias"  BLOCK "$(BU 'cp -al .figma-fidelity.pending alias')"
ck "cp -as bundled alias"  BLOCK "$(BU 'cp -as .figma-fidelity.pending alias')"
ck "tar --remove-files"    BLOCK "$(BU 'tar --remove-files -cf x.tar .figma-fidelity.pending')"
ck "zip -m move"           BLOCK "$(BU 'zip -m x.zip .figma-fidelity.pending')"
ck "perl -0777pi bundle"   BLOCK "$(BU 'perl -0777pi -e s/x/y/ .figma-fidelity.pending')"

echo "=== bash-guard UNARMED: legit ops must ALLOW ==="
ck "read cat"              ALLOW "$(BU 'cat .figma-fidelity.pending')"
ck "read grep"             ALLOW "$(BU 'grep 8 .figma-fidelity.pending')"
ck "read head"             ALLOW "$(BU 'head -1 .figma-fidelity.pending')"
ck "sed -n read"           ALLOW "$(BU "sed -n '1,5p' .figma-fidelity.pending")"
ck "perl no-i read"        ALLOW "$(BU 'perl -ne 1 .figma-fidelity.pending')"
ck "cp marker->backup"     ALLOW "$(BU 'cp .figma-fidelity.pending /tmp/backup')"
ck "install marker->bkp"   ALLOW "$(BU 'install .figma-fidelity.pending /tmp/backup')"
ck "rm OTHER-repo marker"  ALLOW "$(BU 'rm -f /tmp/otherrepo/.figma-fidelity.pending')"
ck "rm foo.<marker>"       ALLOW "$(BU 'rm /tmp/foo.figma-fidelity.pending')"
ck "redirect .pending.bak" ALLOW "$(BU 'printf x > .figma-fidelity.pending.bak')"
ck "zip -d archive entry"  ALLOW "$(BU 'zip -d archive.zip .figma-fidelity.pending')"
ck "brace .{json,measuring}" ALLOW "$(BU 'rm .figma-fidelity.{json,measuring}')"
ck "touch measuring"       ALLOW "$(BU 'touch .figma-fidelity.measuring')"
ck "write manifest json"   ALLOW "$(BU 'python3 b.py > .figma-fidelity.json')"
ck "rm measuring"          ALLOW "$(BU 'rm -f .figma-fidelity.measuring')"
ck "unrelated rm \$TMP"     ALLOW "$(BU 'rm "$TMPFILE"')"
ck "unrelated redir \$OUT"  ALLOW "$(BU 'echo hi > "$OUT"')"
ck "normal rm -rf dir"     ALLOW "$(BU 'rm -rf node_modules/.cache')"
ck "normal mv"             ALLOW "$(BU 'mv a.txt b.txt')"
# anti-false-block: prose/commit/grep that merely NAMES the marker
ck "echo prose > notes"    ALLOW "$(BU 'echo "do not rm .figma-fidelity.pending" > notes.txt')"
ck "git commit names it"   ALLOW "$(BU 'git commit -m "harden .figma-fidelity.pending"')"
ck "grep -rn for it"       ALLOW "$(BU 'grep -rn .figma-fidelity.pending claude/')"
ck "bash -c positional"    ALLOW "$(BU "bash -c 'true' ignored 'rm .figma-fidelity.pending'")"
ck "var holds unrelated"   ALLOW "$(BU 'S="ls -la"; $S')"

echo "=== bash-guard ARMED: alias/glob/tree vectors must BLOCK ==="
ck "redirect via symlink"  BLOCK "$(BA 'printf x > alias')"
ck "truncate hardlink"     BLOCK "$(BA 'truncate -s 0 hard')"
ck "rm via symlink"        BLOCK "$(BA 'rm alias')"
ck "glob rm .figma-*"      BLOCK "$(BA 'rm .figma-fidelity.*')"
ck "glob rm .pen*"         BLOCK "$(BA 'rm .figma-fidelity.pen*')"
ck "rm -rf . (tree)"       BLOCK "$(BA 'rm -rf .')"
ck "find . -delete (tree)" BLOCK "$(BA 'find . -delete')"
ck "git clean -fdx"        BLOCK "$(BA 'git clean -fdx')"
ck "split-printf subst"    BLOCK "$(BA 'printf x > "$(printf %s .figma-fidelity)$(printf %s .pending)"')"
ck "unknown-var conserv"   BLOCK "$(BA 'V=$RANDOM; rm "$V"')"
ck "find -name -exec rm{}"  BLOCK "$(BA 'find . -name .figma-fidelity.pending -exec rm {} \;')"
ck "rsync --remove-source" BLOCK "$(BA 'rsync --remove-source-files .figma-fidelity.pending /d')"
ck "find -name glob -del"  BLOCK "$(BA "find . -name '*.pending' -delete")"
ck "rsync --delete dest"   BLOCK "$(BA 'rsync --delete src/ .')"
ck "find -exec cp {} over" BLOCK "$(BA 'find . -name .figma-fidelity.pending -exec cp /dev/null {} \;')"
ck "find ! -name log -del" BLOCK "$(BA "find . ! -name '*.log' -delete")"
ck "find ! -name mk -o -del" BLOCK "$(BA 'find . ! -name .figma-fidelity.pending -o -delete')"
ck "heredoc | xargs rm"    BLOCK "$(decision "$BG" "$(printf '%s' '{"tool_input":{"command":"xargs rm <<EOF\n.figma-fidelity.pending\nEOF\n"}}')" "$AR")"
ck "rsync --delete-excluded" BLOCK "$(BA 'rsync --delete-excluded --exclude .figma-fidelity.pending src/ ./')"
ck "printf mk\\n | xargs rm" BLOCK "$(BA "printf '.figma-fidelity.pending\n' | xargs rm")"
ck "rm literal armed"      BLOCK "$(BA 'rm .figma-fidelity.pending')"

echo "=== bash-guard ARMED: legit ops must still ALLOW ==="
ck "armed cat marker"      ALLOW "$(BA 'cat .figma-fidelity.pending')"
ck "armed write .json"     ALLOW "$(BA 'echo {} > .figma-fidelity.json')"
ck "armed sed -n read"     ALLOW "$(BA 'sed -n 1,2p .figma-fidelity.pending')"
ck "armed glob rm *.log"   ALLOW "$(BA 'rm *.log')"
ck "armed rm -rf build"    ALLOW "$(BA 'rm -rf build')"
ck "armed find name x.log" ALLOW "$(BA 'find . -name x.log -delete')"
ck "armed git clean -n"    ALLOW "$(BA 'git clean -n')"
ck "armed rm unrelated"    ALLOW "$(BA 'rm ./somefile.txt')"
ck "armed find -exec cat"  ALLOW "$(BA 'find . -name .figma-fidelity.pending -exec cat {} \;')"
ck "armed quoted-glob"     ALLOW "$(BA "rm '.figma-fidelity.*'")"
ck "armed quoted-brace"    ALLOW "$(BA "rm '.figma-fidelity.{pending,json}'")"
ck "armed rm \$TMPDIR/x"    ALLOW "$(BA 'rm "$TMPDIR/scratch"')"
ck "armed git clean -n -f" ALLOW "$(BA 'git clean -n -f')"
ck "armed find name *.log" ALLOW "$(BA "find . -name '*.log' -delete")"
ck "armed rsync --exclude" ALLOW "$(BA 'rsync --delete --exclude .figma-fidelity.pending src/ .')"
ck "armed >&1 fd-dupe"     ALLOW "$(BA 'printf x >&1')"
ck "armed echo mk|xargs cat" ALLOW "$(BA 'echo .figma-fidelity.pending | xargs cat')"
ck "armed echo other|xargs" ALLOW "$(BA 'echo other.txt | xargs rm')"
ck "armed grep mk|xargs rm" ALLOW "$(BA 'grep .figma-fidelity.pending list | xargs rm')"
ck "armed xargs -a mk rm"  ALLOW "$(BA 'xargs -a .figma-fidelity.pending rm')"
ck "armed find ! -name mk" ALLOW "$(BA 'find . ! -name .figma-fidelity.pending -delete')"
ck "armed cp -a unrelated" ALLOW "$(BA 'cp -a src dst')"
ck "armed find /other -name" ALLOW "$(BA 'find /other-repo -name .figma-fidelity.pending -delete')"
ck "armed find -H /other"  ALLOW "$(BA 'find -H /other-repo -name .figma-fidelity.pending -delete')"
ck "armed rsync --excl only" ALLOW "$(BA 'rsync --delete --exclude .figma-fidelity.pending src/ .')"

echo "=== content-guard: Write/Edit on marker must BLOCK ==="
CB() { decision "$CG" "$(cwritef "$AR/.figma-fidelity.pending")" "$AR"; }
ck "Write marker path"     BLOCK "$(decision "$CG" "$(cwritef "$AR/.figma-fidelity.pending")" "$AR")"
ck "Edit marker path"      BLOCK "$(decision "$CG" "$(cedit "$AR/.figma-fidelity.pending")" "$AR")"
ck "Edit symlink alias"    BLOCK "$(decision "$CG" "$(cedit "$AR/alias")" "$AR")"
ck "Write hardlink alias"  BLOCK "$(decision "$CG" "$(cwritef "$AR/hard")" "$AR")"
echo "=== content-guard: legit writes must ALLOW ==="
ck "Write manifest json"   ALLOW "$(decision "$CG" "$(cwritef "$AR/.figma-fidelity.json")" "$AR")"
ck "Write .pending.bak"    ALLOW "$(decision "$CG" "$(cwritef "$AR/.figma-fidelity.pending.bak")" "$AR")"
ck "Write foo.<marker>"    ALLOW "$(decision "$CG" "$(cwritef "$AR/foo.figma-fidelity.pending")" "$AR")"
ck "Write OTHER-repo mk"   ALLOW "$(decision "$CG" "$(cwritef "/tmp/otherrepo/.figma-fidelity.pending")" "$AR")"
ck "Write unrelated scss"  ALLOW "$(decision "$CG" "$(cwritef "$AR/a.scss")" "$AR")"
ck "beat names marker"     ALLOW "$(decision "$CG" "$(python3 -c 'import json; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":"/x/beat.md","content":"the guard blocks rm .figma-fidelity.pending"}}))')" "$AR")"

echo "=== KNOWN GAPS (accepted residual - command text cannot resolve these) ==="
# A command-text guard cannot parse arbitrary code inside an interpreter, cannot
# inspect an archive's contents, and cannot see a filename produced only at
# runtime by a lister. These are the residual the Level-2 signed arm ledger (a
# tamper-evident arming source outside the agent's tool reach) is meant to close.
ck "python -c inline (GAP)"  ALLOW "$(BA 'python3 -c "open(chr(46)+chr(102),chr(119))"')"
ck "ruby -e inline (GAP)"    ALLOW "$(BA 'ruby -e "File.write(%q(x),%q(y))"')"
ck "node -e inline (GAP)"    ALLOW "$(BA 'node -e "require(1)"')"
ck "tar -x extract (GAP)"    ALLOW "$(BA 'tar -xf archive.tar')"
ck "ls -a | xargs rm (GAP)"  ALLOW "$(BA 'ls -a | xargs rm')"

rm -rf "$UN" "$AR"
if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES ABOVE"; exit 1; fi
