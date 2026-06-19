---
name: Claude-in-Chrome host is NOT the Claude Code host
description: The Claude-in-Chrome MCP can be paired to a different physical machine than the one Claude Code runs on; localhost and isLocal reasoning is invalid across machines that share the dotfiles repo
type: reference
relates_to: [reference_dev_servers_ports.md, reference_browser_validation_tool_precedence.md]
---

Discovered live (Jonah caught it): the Chrome browser the claude-in-chrome MCP drives
can be a DIFFERENT machine than the terminal Claude Code runs in.

Concrete case this session:
- Claude Code terminal: tethered to Jonah's iPhone hotspot, AT&T cellular, public IP
  166.199.100.7 (mobile-...mycingular.net), geolocated Gainesville FL. Default route
  via 172.20.10.1 on en0, LAN IP 172.20.10.4.
- The paired Chrome ("NGA Cmux", reported isLocal:true): Verizon FiOS home broadband,
  public IP 74.96.31.117 (...washdc.east.verizon.net), geolocated Ashburn VA. A
  separate physical machine (the "work laptop back home").

Two reasoning errors I made and must not repeat:

1. "localhost:4830 loaded Improv, therefore Chrome is on this machine." FALSE. The
   dotfiles repo is checked out on multiple machines (that is the whole point of the
   beats continuity layer). Each machine can serve the marketing site on 4830, so a
   localhost load proves nothing about WHICH machine the browser is on.

2. "list_connected_browsers returned isLocal:true, therefore it's Claude Code's
   machine." FALSE. isLocal is local to the CHROME EXTENSION's own host, not to where
   Claude Code is running. The MCP connects to whatever Chrome is paired to the
   account, which may be anywhere.

How to actually verify where the browser is (decisive test):
- Browser side: navigate a tab to https://ipinfo.io/json and read it.
- Claude Code side: `curl -s https://ipinfo.io/json`.
- Compare public IPs. Same IP = same network/machine. Different = split, trust nothing
  about "local."

Implication for verification work: a screenshot from the MCP browser is NOT proof that
a dev server YOU started in this terminal is rendering correctly - it may be a different
machine's copy. When verifying local changes, confirm the browser and the dev server are
the same host first.

Collaborator: Jonah.
