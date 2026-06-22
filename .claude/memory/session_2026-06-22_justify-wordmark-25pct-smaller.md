---
name: Justify task - .hero__wordmark reduced 25% across all breakpoints (single clamp)
description: In-browser Justify request to shrink the homepage "Improv" hero wordmark by 25%; done by scaling all three clamp() values, verified via Chrome MCP screenshot at LAN IP.
type: project
relates_to: [reference_chrome_mcp_lan_ip_access.md, feedback_justify_be_authoritative_decisive.md, reference_dev_servers_ports.md]
---

Collaborator: Jonah Cohen

## Task (from /tmp/justify-inbox.json, prompt-1)
Element <h1> ".hero__wordmark" ("Improv") on marketing index.html. Request: "reduce the size of this by 25% across all breakpoints." Computed was fontSize 216px (hitting the clamp max).

## Change
marketing-site/styles.css `.hero__wordmark` font-size:
- clamp(3.75rem, 19.5vw, 13.5rem) -> clamp(2.8125rem, 14.625vw, 10.125rem)
All three clamp values scaled x0.75. A single fluid clamp covers every viewport, so scaling min/preferred/max by 25% IS "across all breakpoints" - no media queries needed (there is only one .hero__wordmark rule). New max 10.125rem = 162px (216 x 0.75).

## Verify
- cmux CLI not on PATH in non-interactive Bash this session; verified via Chrome MCP instead.
- Chrome MCP host != Claude Code host, so localhost fails; navigated to http://192.168.1.178:4830/index.html (this host's LAN IP, per reference_chrome_mcp_lan_ip_access). Dev server 200.
- Screenshot: "Improv" wordmark renders noticeably smaller (~162px), one line via text-wrap:balance, eyebrow/lede/CTA stack clean below it, red pixel figure on right unaffected. Nothing clipped/overlapping/misaligned. Matches the 25% reduction.

## Queue handling
POST /respond (status completed + structured diff) -> {ok:true}; POST /prompts/clear {ids:["prompt-1"]} (id-scoped) -> {ok:true}; /prompts now []. Watch relaunched in background (flag ~/.claude/.justify-watch-on still ON; not removed - no user consent to end watch).

## Files touched
- marketing-site/styles.css (.hero__wordmark font-size clamp)
