"""Least Significant: a steganography lab about hiding data in the lowest bits of a picture.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
night.png is a picture of the campus at night. The lowest bit of the red value of each
pixel, left to right and row by row, spells out the flag, eight bits per character with the
highest bit first, followed by a zero byte. Changing the lowest bit changes the colour by
one step in 256, which no eye can see.
"""

import os
import random
import signal
import struct
import sys
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
WIDTH, HEIGHT = 480, 320


def png(pixels):
    rows = b"".join(b"\0" + bytes(pixels[y * WIDTH * 3 : (y + 1) * WIDTH * 3]) for y in range(HEIGHT))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def night_sky():
    """A sky that gets lighter towards the horizon, stars, and the campus buildings with lit windows."""
    noise = random.Random(2026)
    pixels = bytearray(WIDTH * HEIGHT * 3)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            shade = y / HEIGHT
            colour = (int(8 + 40 * shade) + noise.randint(0, 3), int(12 + 30 * shade) + noise.randint(0, 3), int(40 + 50 * shade) + noise.randint(0, 3))
            pixels[(y * WIDTH + x) * 3 : (y * WIDTH + x) * 3 + 3] = bytes(colour)
    for _ in range(160):
        x, y, light = noise.randrange(WIDTH), noise.randrange(HEIGHT * 2 // 3), noise.randint(140, 255)
        pixels[(y * WIDTH + x) * 3 : (y * WIDTH + x) * 3 + 3] = bytes((light, light, min(255, light + 20)))
    left = 0
    while left < WIDTH:
        width, height = noise.randint(40, 90), noise.randint(50, 130)
        for y in range(HEIGHT - height, HEIGHT):
            for x in range(left, min(WIDTH, left + width)):
                lit = (x - left) % 12 in (4, 5, 6) and (y - HEIGHT + height) % 16 in (6, 7, 8, 9) and noise.random() < 0.6
                colour = (230, 200, 120) if lit else (14 + noise.randint(0, 2), 14 + noise.randint(0, 2), 22 + noise.randint(0, 2))
                pixels[(y * WIDTH + x) * 3 : (y * WIDTH + x) * 3 + 3] = bytes(colour)
        left += width + noise.randint(0, 20)
    return pixels


def hide(pixels, message):
    bits = [(byte >> (7 - position)) & 1 for byte in message for position in range(8)]
    for index, bit in enumerate(bits):
        pixels[index * 3] = (pixels[index * 3] & 0xFE) | bit
    return pixels


PICTURE = png(hide(night_sky(), FLAG.encode() + b"\0"))

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Least Significant</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Least Significant</h1>
<p>Two members swap pictures of the campus at night. They say the bits that matter least to your eye matter most to them.</p>
<p><a href="/night.png">Download night.png</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/night.png":
            self.reply(200, PICTURE, "image/png", "night.png")
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
