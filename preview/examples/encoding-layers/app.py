"""Encoding Layers: a beginner crypto challenge about encodings, which are not encryption.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
The page shows that flag encoded three times: Base32, then Base64, then hex.
"""

import base64
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

# flag -> Base32 -> Base64 -> hex. No key anywhere: anyone can undo each step.
BLOB = base64.b64encode(base64.b32encode(FLAG.encode())).hex()

PAGE = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Encoding Layers</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}pre{{white-space:pre-wrap;word-break:break-all;background:#f3f6fa;padding:1rem}}</style>
</head><body><h1>Encoding Layers</h1>
<p>A member says they "encrypted" the flag three times, so it must be extra safe. Here is what they sent:</p>
<pre>{BLOB}</pre></body></html>"""


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
