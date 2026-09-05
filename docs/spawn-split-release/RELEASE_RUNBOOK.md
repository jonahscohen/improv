# spawn-split release + bb-community submission runbook

Everything is staged. This is the exact sequence to publish and submit.
NOTHING here has been executed (gh auth is currently invalid). Each release
mutation is called out; approve before running.

Preconditions:
- Re-authenticate GitHub CLI (interactive, in your terminal):
    gh auth login -h github.com
  Confirm with: gh auth status   (should show a valid token for jonahscohen)
- Plugin is release-ready on branch spawn-split-plugin at bb-plugin-spawn-split/
  (commit b659a15d, 18/18 tests, clean build, LICENSE/README/OVERVIEW/metadata).

## Phase 1 - publish the plugin as a public repo (RELEASE MUTATION)

Account: jonahscohen   Repo: bb-plugin-spawn-split (new, public)   Tag: v0.1.0

  # from a clean copy of just the plugin dir
  rm -rf /tmp/bb-plugin-spawn-split && cp -R bb-plugin-spawn-split /tmp/bb-plugin-spawn-split
  cd /tmp/bb-plugin-spawn-split
  rm -rf node_modules dist            # keep the repo source-only; .gitignore already excludes these
  git init -b main
  git add -A
  git commit -m "spawn-split 0.1.0: spawn child agents into split panes"
  gh repo create jonahscohen/bb-plugin-spawn-split --public --source=. --remote=origin --push
  git tag v0.1.0
  git push origin v0.1.0

Verify it installs from the public source:
  bb plugin install git:https://github.com/jonahscohen/bb-plugin-spawn-split.git@^0.1.0 --yes
  bb plugin list | grep spawn-split

## Phase 2 - open the bb-community marketplace PR (RELEASE MUTATION)

Target: get-bb/marketplace (fork from jonahscohen, PR back).
Staged files (copy from docs/spawn-split-release/ in the improv repo):
  entries/spawn-split.json      -> entries/spawn-split.json
  icons/spawn-split.svg         -> icons/spawn-split.svg   (verbatim Lucide columns-2)
  overview/spawn-split.md       -> overview/spawn-split.md

  gh repo fork get-bb/marketplace --clone=true --remote=true
  cd marketplace
  cp /path/to/improv/docs/spawn-split-release/entries/spawn-split.json entries/spawn-split.json
  cp /path/to/improv/docs/spawn-split-release/icons/spawn-split.svg icons/spawn-split.svg
  cp /path/to/improv/docs/spawn-split-release/overview/spawn-split.md overview/spawn-split.md
  npm ci && node scripts/build.mjs        # validates entry + remote source; must pass
  git checkout -b add-spawn-split
  git add entries/spawn-split.json icons/spawn-split.svg overview/spawn-split.md
  git commit -m "Add spawn-split plugin"
  git push -u origin add-spawn-split
  gh pr create --repo get-bb/marketplace --title "Add spawn-split plugin" \
    --body "Spawn child agents from a thread, each opened in its own split pane. Source: https://github.com/jonahscohen/bb-plugin-spawn-split (v0.1.0). Category: agents-and-providers."

Notes:
- The marketplace build may re-vendor the icon with a content-hash filename
  (e.g. spawn-split-<hash>.svg) and rewrite entry.icon.url; if scripts/build.mjs
  does this, commit its output. Otherwise the plain ./icons/spawn-split.svg is fine.
- Screenshots are optional; a capture of two spawned split panes in getbb.app
  under screenshots/spawn-split/ would strengthen the review. Can be added to the
  same PR later.
- CI validates the entry and the remote source (so Phase 1's public repo + tag
  must exist before the PR is reviewable). A maintainer reviews behavior;
  inclusion is BB's decision.
- Compatible 0.1.x releases within ^0.1.0 need no new PR; source/brand/category
  changes need a new PR.
