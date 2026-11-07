"""Secret Agent: a beginner web challenge about HTTP request headers.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import signal
import sys
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

BROWSER = "UDSM-Club-Browser"


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))

        # The bug: the User-Agent header is written by the visitor, so it proves nothing.
        agent = self.headers.get("User-Agent", "")
        if BROWSER in agent:
            self.reply(200, page("Welcome, agent", f"<p>Your browser checks out.</p><p>Flag: <code>{FLAG}</code></p>"))
        else:
            self.reply(403, page("Access denied", (
                f"<p>This page only opens in the official <b>{BROWSER}</b>.</p>"
                f"<p>Your browser says it is:</p><pre>{escape(agent) or '(nothing)'}</pre>"
            )))

    def reply(self, status, body):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
