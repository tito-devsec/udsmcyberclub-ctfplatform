"""Single Byte: a beginner crypto challenge about XOR with a one-byte key.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
The page shows that flag XORed with a single secret byte, as hex.
"""

import hashlib
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
# the same key for the same player, even after their instance restarts; never 0
KEY = hashlib.sha256(FLAG.encode()).digest()[0] or 0x5A

CIPHERTEXT = bytes(b ^ KEY for b in FLAG.encode()).hex()

PAGE = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Single Byte</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}pre{{white-space:pre-wrap;word-break:break-all;background:#f3f6fa;padding:1rem}}</style>
</head><body><h1>Single Byte</h1>
<p>The club treasurer encrypted the flag with XOR and a secret key. To keep it easy to remember, the key is a single byte. Here is the result, written in hex:</p>
<pre>{CIPHERTEXT}</pre></body></html>"""


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
