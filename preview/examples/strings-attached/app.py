"""Strings Attached: a beginner forensics challenge about finding text in binary files.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
firmware.bin is random-looking binary data with a few readable messages planted in
it, one of them the flag. `strings firmware.bin` lists them.
"""

import hashlib
import os
import random
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")


def make_firmware():
    # the same file for the same player, even after their instance restarts
    rng = random.Random(hashlib.sha256(FLAG.encode()).digest())
    blob = bytearray(rng.randbytes(8192))
    # make the noise unreadable, so the planted messages are the only text in the file
    for i, byte in enumerate(blob):
        if 0x20 <= byte < 0x7F or byte in (0x09, 0x0A, 0x0D):
            blob[i] = byte | 0x80

    def plant(offset, text):
        data = text.encode() + b"\0"
        blob[offset:offset + len(data)] = data

    plant(0, "CLUBFW v2.4.1")
    plant(512, "bootloader v2.4.1 (build 2026-03-14)")
    plant(1500, "Enter maintenance password: ")
    plant(2300, "Access denied.")
    plant(3100, "door: open for %d seconds")
    plant(4700, f"debug_token={FLAG}")
    plant(6200, "watchdog: reset reason %d")
    plant(7400, "(c) 2026 Door Systems Ltd.")
    return bytes(blob)


FIRMWARE = make_firmware()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Strings Attached</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Strings Attached</h1>
<p>We copied the firmware off the club room's electronic door lock. The vendor's support page says it contains a debug token.</p>
<p><a href="/firmware.bin">Download firmware.bin</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/firmware.bin":
            self.reply(200, FIRMWARE, "application/octet-stream", "firmware.bin")
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def reply(self, status, data, content_type, download=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if download:
            self.send_header("Content-Disposition", f'attachment; filename="{download}"')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
