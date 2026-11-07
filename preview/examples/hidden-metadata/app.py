"""Hidden Metadata: a beginner forensics challenge about file metadata.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
whiteboard.png is a drawing of a whiteboard. The flag is in the image's metadata,
in a compressed text field, so `strings` does not show it: a metadata tool such as
exiftool does.
"""

import os
import signal
import struct
import sys
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

WIDTH, HEIGHT = 480, 300


def pixel(x, y):
    if not (40 <= x < 440 and 30 <= y < 250):
        if 60 <= x < 420 and 250 <= y < 258:
            return (150, 150, 150)  # marker tray
        shade = y * 40 // HEIGHT
        return (8, 100 - shade, 175 - shade)  # the wall, UDSM blue
    if x < 46 or x >= 434 or y < 36 or y >= 244:
        return (160, 160, 160)  # frame
    for row, length in ((70, 260), (95, 300), (120, 220), (145, 280)):
        if row <= y < row + 3 and 70 <= x < 70 + length:
            return (20, 50, 140)  # lines of writing in blue marker
    if 300 <= x < 400 and 175 <= y < 225 and (x < 303 or x >= 397 or y < 178 or y >= 222):
        return (200, 30, 30)  # a box in red marker
    if 175 <= y < 225 and 60 <= x < 260 and y == 200 + (x - 160) // 50:
        return (20, 120, 40)  # a green arrow-ish line
    return (248, 248, 248)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def make_png():
    rows = bytearray()
    for y in range(HEIGHT):
        rows.append(0)  # filter type: none
        for x in range(WIDTH):
            rows += bytes(pixel(x, y))
    return b"".join([
        b"\x89PNG\r\n\x1a\n",
        chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)),
        chunk(b"tEXt", b"Author\0UDSM Cyber Club"),
        chunk(b"tEXt", b"Description\0Whiteboard after the Friday workshop"),
        # zTXt: keyword, separator, compression method 0, then zlib-compressed text
        chunk(b"zTXt", b"Comment\0\0" + zlib.compress(f"Do not forget: {FLAG}".encode())),
        chunk(b"IDAT", zlib.compress(bytes(rows), 9)),
        chunk(b"IEND", b""),
    ])


IMAGE = make_png()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Hidden Metadata</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}img{max-width:100%}</style>
</head><body><h1>Hidden Metadata</h1>
<p>Someone posted this photo of the club whiteboard and said the flag is "in the picture". It is, just not anywhere you can see it.</p>
<p><img src="/whiteboard.png" alt="The club whiteboard"></p>
<p><a href="/whiteboard.png" download>Download whiteboard.png</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/whiteboard.png":
            self.reply(200, IMAGE, "image/png")
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def reply(self, status, data, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
