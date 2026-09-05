Spawn child threads and open each as a split pane, straight from a terminal
or from an agent's own tool call.

## What you get

- A `bb spawn-split` command that manages the plugin's example todo list
  from a terminal (kept as scaffold reference for the backend surfaces this
  plugin builds on).
- No frontend page: this plugin is headless, and pane-opening happens on
  the backend via `bb.sdk.threads.open`.

## How it works

The todos live in this plugin's own storage on the BB server, one list per
installation. Nothing leaves the machine, and the plugin needs no account, API
key, or external service.

## For agents

The bundled skill tells an agent to read the list with `bb spawn-split list`, add
one todo at a time with `bb spawn-split add`, and close finished work with
`bb spawn-split done`.
