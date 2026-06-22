---
name: Justify task - white-space:nowrap on hero title "all together" span
description: Applied white-space:nowrap to .page-hero__title > span (from the Manipulate White space control) so the underlined "all together" phrase stays on one line. First change verified under the newly-hardened visual gate.
type: project
relates_to: [session_2026-06-22_justify-hero-title-textwrap-fix.md, session_2026-06-22_verify-hook-hardening.md]
---

Collaborator: Jonah Cohen

Justify prompt-1 (from the Manipulate panel White space control, target `.page-hero__title > span`): "Apply these CSS changes: white-space: nowrap".

Change: added `white-space: nowrap;` to the inline style of the "all together" span in marketing-site/sidecoach.html (consistent with that span's existing inline styling). Before, at the 60/40 layout the title broke as "Sidecoach puts it all" / "together." - splitting the underlined span across two lines. After, "all together" stays intact on its own line: "Say what you want." / "Sidecoach puts it" / "all together."

Verified visually in Chrome (MCP primary, via LAN IP 192.168.1.178:4830 per [[reference_chrome_mcp_lan_ip_access.md]]) at 1440px desktop: the underlined phrase is on one line, underline clean, no overflow. This is the first visual change cleared through the hardened gate ([[session_2026-06-22_verify-hook-hardening.md]]) - the chrome screenshot (not a curl) is what cleared the visual flag.

Files touched:
- marketing-site/sidecoach.html (.page-hero__title > span inline white-space:nowrap)
