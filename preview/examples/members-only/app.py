"""Members Only: a beginner web challenge about cookies.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import signal
import sys
from html import escape
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))

        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except CookieError:
            pass

        # The bug: the visitor's role is kept in a cookie, which the visitor can edit.
        if "role" not in cookies:
            # first visit: everyone starts as a guest
            self.reply(200, page("Members area", "<p>Hello, guest! The members area is for admins only.</p>"),
                       cookie="role=guest; Path=/")
        elif cookies["role"].value == "admin":
            self.reply(200, page("Members area", f"<p>Welcome back, admin.</p><p>Flag: <code>{FLAG}</code></p>"))
        else:
            role = escape(cookies["role"].value)
            self.reply(403, page("Members area", f"<p>Hello, {role}! The members area is for admins only.</p>"))

    def reply(self, status, body, cookie=None):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
