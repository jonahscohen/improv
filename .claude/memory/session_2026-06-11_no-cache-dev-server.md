---
name: Marketing-site dev server replaced with no-cache variant (serve.py)
description: Jonah saw "you didn't change anything" because Chrome served a stale cached DOCUMENT; root cause killed - serve.py sends Cache-Control no-store on every response, plain reload always fresh
type: project
relates_to: [session_2026-06-11_foundation-moved-above-stats.md, session_2026-06-10_marketing-site-server-restart.md]
---

Collaborator: Jonah. 2026-06-11. Via Justify reply: "no...you didn't change anything. please flip the contrast values of 'the foundation' and 'by the numbers' come on."

## What actually happened
The flip WAS already applied and verified (foundation=section--paper line 209, stats=section--ink line 242, confirmed in source AND served HTML via curl). Jonah's tab was rendering a stale cached copy of index.html - plain `python3 -m http.server` sends no Cache-Control, so Chrome heuristically caches the DOCUMENT. This same trap hit my own verification twice today (?v= asset versioning only protects assets, not the document carrying the version strings). No re-edit performed - re-editing would have been the phantom-fix failure mode.

## Permanent fix
`marketing-site/serve.py` - SimpleHTTPRequestHandler subclass adding `Cache-Control: no-store, must-revalidate` + `Expires: 0` to every response (ThreadingHTTPServer, port arg, default 4830). Old http.server on 4830 killed; serve.py running (nohup, log /tmp/marketing-site-server.log).
- VERIFIED: curl -I shows the no-store headers; served lines 209/242 show paper/ink; browser PLAIN navigation (no hard reload) renders foundation on light paper below the dark loop - cache class of bug dead. The ?v= stylesheet dance is now redundant but harmless.
- Launch command going forward: `cd marketing-site && python3 serve.py 4830` (NOT python3 -m http.server).

Files: marketing-site/serve.py (new).
