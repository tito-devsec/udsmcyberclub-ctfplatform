"""Hidden Pages: a beginner web challenge about robots.txt.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

# Tells search engines what not to visit, and anyone else exactly where to look
ROBOTS = "User-agent: *\nDisallow: /staff-notes/\n"


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, page("UDSM Cyber Club", (
                "<p>Welcome to the club website. We meet every Friday in the computer lab.</p>"
                "<p>Nothing secret here. Search engines have been asked to stay away from the private pages.</p>"
            )))
        elif path == "/robots.txt":
            self.reply(200, ROBOTS, "text/plain; charset=utf-8")
        elif path.rstrip("/") == "/staff-notes":
            self.reply(200, page("Staff notes", (
                "<p>Reminder: change the lab Wi-Fi password before the next meeting.</p>"
                f"<p>Flag: <code>{FLAG}</code></p>"
            )))
        else:
            self.reply(404, page("Not found", "<p>There is no page here.</p>"))

    def reply(self, status, body, content_type="text/html; charset=utf-8"):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
