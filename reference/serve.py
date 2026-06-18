#!/usr/bin/env python3
"""Dev server for the marketing site with cache-defeating headers.

Plain `python3 -m http.server` sends no Cache-Control, so Chrome heuristically
caches the DOCUMENT itself - edits then need a hard reload to show up, which
has repeatedly made fresh changes look like no-ops. Every response from this
server says no-store, so a plain reload always reflects the working tree.
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4830


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
