#!/usr/bin/env python3
"""Static file server with SPA fallback so /foodlog, /meal/:id, etc. work on refresh."""

from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        rel = unquote(parsed.path).lstrip("/")

        # Browsers often request /favicon.ico — serve our SVG icon instead
        if rel in ("favicon.ico",):
            self.path = "/favicon.svg"

        parsed = urlparse(self.path)
        rel = unquote(parsed.path).lstrip("/")
        candidate = (ROOT / rel).resolve() if rel else ROOT

        # Prevent path traversal outside project root
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            self.send_error(403)
            return

        if rel and candidate.is_file():
            return super().do_GET()

        # Missing real asset (has a file extension) → real 404
        name = Path(rel).name if rel else ""
        if name and "." in name:
            self.send_error(404)
            return

        # Client route → serve the app shell
        self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="NutriPlan SPA static server")
    parser.add_argument("-p", "--port", type=int, default=5500)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), SPAHandler)
    print(f"NutriPlan SPA server at http://127.0.0.1:{args.port}")
    print("Deep links (/foodlog, /meal/:id, …) fall back to index.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
