"""Shifty Notes: a beginner crypto challenge about the Caesar cipher.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
The page shows a note with the flag in it, every letter shifted along the alphabet.
"""

import hashlib
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
# the same shift for the same player, even after their instance restarts
SHIFT = hashlib.sha256(FLAG.encode()).digest()[0] % 25 + 1


def shift(text, n):
    out = []
    for c in text:
        if "a" <= c <= "z":
            out.append(chr((ord(c) - ord("a") + n) % 26 + ord("a")))
        elif "A" <= c <= "Z":
            out.append(chr((ord(c) - ord("A") + n) % 26 + ord("A")))
        else:
            out.append(c)
    return "".join(out)


NOTE = shift(f"Meet in the lab after the workshop. Bring snacks. The flag is {FLAG}", SHIFT)

PAGE = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Shifty Notes</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}pre{{white-space:pre-wrap;font-size:1.1rem;background:#f3f6fa;padding:1rem}}</style>
</head><body><h1>Shifty Notes</h1>
<p>We found this note pinned to the club notice board. Every letter looks wrong, but the spaces and punctuation are where you would expect them.</p>
<pre>{NOTE}</pre></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, "<p>There is no page here.</p>")
        self.reply(200, PAGE)

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
