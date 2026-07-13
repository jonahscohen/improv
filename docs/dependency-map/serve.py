#!/usr/bin/env python3
"""Dev server for the dependency map with cache-defeating headers.

Same no-cache rationale as marketing-site/serve.py: a plain http.server sends no
Cache-Control, so Chrome heuristically caches the DOCUMENT and edits look like
no-ops until a hard reload.

Two deliberate departures from marketing-site/serve.py, both of which are the
subject of findings on the page this serves:

  1. The directory is bound explicitly to this file's own directory rather than
     inherited from the process cwd, so the server cannot be started against the
     wrong tree.
  2. The default port is 4832, distinct from marketing-site (4830) and reference
     (4831). Finding 9 on the map is that reference/serve.py is a copy carrying
     marketing-site's 4830 default, leaving only convention between them and a
     port collision. Copying that default forward would have made it worse.

Exit codes:
  0  served until interrupted
  2  index.html is missing next to this script
  3  port is already in use
  4  port argument is not a valid port number
  5  permission denied binding the port (a privileged port, not a collision)
"""
import errno
import http.server
import os
import sys

DEFAULT_PORT = 4832
# Loopback, not all interfaces. This serves an internal engineering artifact and
# has no business being reachable from the network; '' would have advertised it
# on every interface while printing a localhost URL.
HOST = '127.0.0.1'
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f'invalid port: {sys.argv[1]!r}', file=sys.stderr)
            return 4
        if not (1 <= port <= 65535):
            print(f'port out of range: {port}', file=sys.stderr)
            return 4
    else:
        port = DEFAULT_PORT

    index = os.path.join(ROOT, 'index.html')
    if not os.path.isfile(index):
        print(f'index.html not found at {index}', file=sys.stderr)
        return 2

    try:
        server = http.server.ThreadingHTTPServer((HOST, port), NoCacheHandler)
    except OSError as exc:
        # EACCES is permission denied, not a collision. Collapsing the two would
        # make the exit-code contract lie about which failure actually happened.
        if exc.errno == errno.EADDRINUSE:
            print(f'port {port} is already in use', file=sys.stderr)
            return 3
        if exc.errno == errno.EACCES:
            print(f'permission denied binding port {port}', file=sys.stderr)
            return 5
        raise

    print(f'dependency map on http://localhost:{port}/ (serving {ROOT})', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
