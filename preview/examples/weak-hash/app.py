"""Weak Hash: a beginner crypto challenge about cracking password hashes.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
The vault opens with one of the most common passwords in the world; the page only
shows its MD5 hash, which online lookup sites and wordlists crack in seconds.
"""

import hashlib
import os
import signal
import sys
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

COMMON = ["sunshine", "dragon", "football", "princess", "monkey", "shadow", "superman", "iloveyou",
          "starwars", "whatever", "trustno1", "letmein", "baseball", "welcome", "freedom", "charlie"]
# a different password for different players, the same one after a restart
PASSWORD = COMMON[hashlib.sha256(FLAG.encode()).digest()[0] % len(COMMON)]
HASH = hashlib.md5(PASSWORD.encode()).hexdigest()


def page(message=""):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Weak Hash</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}code{{background:#f3f6fa;padding:.2rem .4rem}}</style>
</head><body><h1>The club vault</h1>
<p>The vault is locked with a password. We could not find the password, only this MD5 hash of it, in an old database backup:</p>
<p><code>{HASH}</code></p>
<form method="post" action="/unlock"><label>Password <input name="password" type="password"></label> <button>Unlock</button></form>
{message}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, "<p>There is no page here.</p>")
        self.reply(200, page())

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/unlock":
            return self.reply(404, "<p>There is no page here.</p>")
        length = min(int(self.headers.get("Content-Length") or 0), 10_000)
        guess = parse_qs(self.rfile.read(length).decode(errors="replace")).get("password", [""])[0]
        if hashlib.md5(guess.encode()).hexdigest() == HASH:
            self.reply(200, page(f"<p>The vault opens. Flag: <code>{FLAG}</code></p>"))
        else:
            self.reply(401, page(f"<p>Wrong password: <code>{escape(guess)}</code></p>"))

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
