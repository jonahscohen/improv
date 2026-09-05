# bb-plugin-spawn-split

A headless BB plugin (backend only, no frontend). It spawns child threads
and opens each as a split pane via `bb.sdk.threads.open({ threadId, split
})`, called straight from server code - no `app.tsx`/`components/`/`hooks/`
`/lib/` needed for that. The scaffold's example todo list is kept in
`server.ts` as backend-surface reference (settings, storage, CLI command,
skill), not as shipped UI:

- `server.ts` - the backend: a todo store in `bb.storage.kv`, an RPC
  contract (kept as reference; no page calls it headless), a `bb
  spawn-split` CLI command, a setting, and a realtime signal.
- `skills/example-todos/SKILL.md` - a skill that tells agents how to keep the list
  with `bb spawn-split`. BB imports it into agent threads automatically.
- `PLUGIN_OVERVIEW.md` - the store listing text: a longer version of
  `bb.description` that the plugin detail page shows under it. See
  [Store listing](#store-listing).

Try it: install the plugin, then run `bb spawn-split add "Ship it"` in a
terminal.

## Manifest

`package.json` is the plugin manifest. Notable fields:

- `bb.server` - backend entry (required).
- `bb.app` - frontend entry. Omitted here (headless plugin); it, plus
  `app.tsx`, `components/`, `hooks/`, and `lib/`, only need to exist if a
  frontend surface is added later.
- `bb.skills` - skill roots; omitted here, so BB reads `skills/`. Each
  directory with a `SKILL.md` is one skill, named after the directory.
- `bb.name` and `bb.description` — required human-facing identity.
- `bb.branding` — required; declare `icon` as a BB icon name or a
  plugin-relative compact SVG, or declare `logo.light` (with optional
  `logo.dark`). Logo assets must be relative `.svg`, `.png`, or
  `.webp` files.
- `engines.bb` — supported bb app version range.
- `engines.bbPluginSdk` — the lowest plugin SDK you need (scaffold:
  `>=0.4.47`). BB reads this as a floor, not a ceiling: a later
  SDK in the same major still loads your plugin.
- `dependencies` — every package your source imports that BB does not provide.
  `bb plugin build` inlines them into `dist/`, and git installs resolve this
  list alone, so a build-required package here rather than in
  `devDependencies` is what keeps your plugin installable. `devDependencies`
  is for types and tooling only (BB shims React, the portal primitives, and
  `@get-bb/plugin-sdk` at runtime — never bundle them).

Run `bb plugin build` before publishing git/npm installs. Headless (no
`bb.app`), it writes only `dist/server.js` + `server.meta.json` - no
`app.js`/`app.css`/`app.meta.json`. Each `*.meta.json` stamps SDK
major/version, `artifactFormatVersion`, `pluginId`, `pluginVersion`, and
`builtWith` so managed installs can verify the artifacts.

## Store listing

Two texts describe the plugin in the store. `bb.description` in package.json
is the one-sentence hook on every browse card and the lead paragraph on the
detail page; keep it under about 140 characters. `PLUGIN_OVERVIEW.md` is the
same claim at length, shown in an Overview section under that paragraph.
Rewrite the scaffold's copy for your plugin, and update it whenever
`bb.description` changes, so the two never disagree.

The submission to the public BB Community marketplace requires the file. Keep
it under 4000 characters (aim for 700 to 1800) and use headings, paragraphs,
emphasis, code, blockquotes, lists, thematic breaks, and absolute https links
only — raw HTML, images, tables, footnotes, and task lists are rejected. Do
not open with a `#` title or repeat `bb.description` verbatim; the page
shows both directly above.

## Install

From this directory (`bb plugin new` already ran the install; a fresh clone
needs it):

```
npm install
bb plugin install .
```

After editing sources, reload:

```
bb plugin reload spawn-split
```

Or let `bb plugin dev` rebuild and reload on every save.

## Configure

```
bb plugin config spawn-split
bb plugin config spawn-split set showDone false
bb plugin reload spawn-split
```

## Types & API reference

The plugin API ships as the npm package `@get-bb/plugin-sdk`, pinned to an
exact version in `devDependencies` (`0.4.47` — the SDK of the BB
that scaffolded this plugin). After `npm install`, the full surface is on disk
at:

```
node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts      # backend
node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk-app.d.ts  # frontend
```

Your editor and `tsc` resolve `@get-bb/plugin-sdk` there through ordinary node
resolution — no path mapping. These are readable declarations: open them for an
exact signature.

The SDK surface grows with every BB release, so the pin has to track the BB you
actually run:

```
bb plugin types          # sync this plugin's SDK surface to the running BB
bb plugin types --check  # CI: fail when it does not match
```

Ask BB to write plugins for you: the `bb-plugin-authoring` skill documents
the whole surface with examples.

Confused by the API, or need something the types don't explain? Clone the BB
repo and read the source: <https://github.com/get-bb/bb>.
