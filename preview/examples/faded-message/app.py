"""Faded Message: a beginner steganography lab about colours that are too close to see.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
poster.png shows a meetup poster on a dark blue background. The flag is written on it in a
colour one step brighter than the background in each channel: invisible to the eye, but
plain once the contrast is raised or one exact colour is filled in.
"""

import os
import signal
import struct
import sys
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
BACKGROUND, TITLE, SUBTITLE, HIDDEN = (10, 30, 60), (230, 240, 255), (150, 180, 220), (11, 31, 61)
WIDTH, HEIGHT = 800, 320

# A 5 x 7 font, enough for flags: lower-case letters, digits, _ { } and space.
FONT = {
    "a": (".....", ".....", ".###.", "....#", ".####", "#...#", ".####"),
    "b": ("#....", "#....", "#.##.", "##..#", "#...#", "#...#", "####."),
    "c": (".....", ".....", ".###.", "#....", "#....", "#...#", ".###."),
    "d": ("....#", "....#", ".##.#", "#..##", "#...#", "#...#", ".####"),
    "e": (".....", ".....", ".###.", "#...#", "#####", "#....", ".###."),
    "f": ("..##.", ".#..#", ".#...", "###..", ".#...", ".#...", ".#..."),
    "g": (".....", ".####", "#...#", "#...#", ".####", "....#", ".###."),
    "h": ("#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"),
    "i": ("..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."),
    "j": ("...#.", ".....", "..##.", "...#.", "...#.", "#..#.", ".##.."),
    "k": ("#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."),
    "l": (".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "m": (".....", ".....", "##.#.", "#.#.#", "#.#.#", "#...#", "#...#"),
    "n": (".....", ".....", "#.##.", "##..#", "#...#", "#...#", "#...#"),
    "o": (".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."),
    "p": (".....", "####.", "#...#", "#...#", "####.", "#....", "#...."),
    "q": (".....", ".####", "#...#", "#...#", ".####", "....#", "....#"),
    "r": (".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."),
    "s": (".....", ".....", ".###.", "#....", ".###.", "....#", "####."),
    "t": (".#...", ".#...", "###..", ".#...", ".#...", ".#..#", "..##."),
    "u": (".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"),
    "v": (".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
    "w": (".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."),
    "x": (".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"),
    "y": (".....", "#...#", "#...#", "#...#", ".####", "....#", ".###."),
    "z": (".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"),
    "0": (".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
    "1": ("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "2": (".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
    "3": ("#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."),
    "4": ("...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."),
    "5": ("#####", "#....", "####.", "....#", "....#", "#...#", ".###."),
    "6": ("..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."),
    "7": ("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
    "8": (".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
    "9": (".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."),
    "_": (".....", ".....", ".....", ".....", ".....", ".....", "#####"),
    "{": ("..##.", ".#...", ".#...", "#....", ".#...", ".#...", "..##."),
    "}": (".##..", "...#.", "...#.", "....#", "...#.", "...#.", ".##.."),
    " ": (".....",) * 7,
}


def draw(pixels, text, left, top, scale, colour):
    """Writes text with the font, each dot a scale x scale square, six dots per character."""
    for index, character in enumerate(text):
        for row, line in enumerate(FONT.get(character, FONT[" "])):
            for column, dot in enumerate(line):
                if dot != "#":
                    continue
                for y in range(top + row * scale, top + (row + 1) * scale):
                    for x in range(left + (index * 6 + column) * scale, left + (index * 6 + column + 1) * scale):
                        if 0 <= x < WIDTH and 0 <= y < HEIGHT:
                            pixels[(y * WIDTH + x) * 3 : (y * WIDTH + x) * 3 + 3] = bytes(colour)


def png(pixels):
    rows = b"".join(b"\0" + bytes(pixels[y * WIDTH * 3 : (y + 1) * WIDTH * 3]) for y in range(HEIGHT))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def make_poster():
    pixels = bytearray(bytes(BACKGROUND) * (WIDTH * HEIGHT))
    draw(pixels, "udsm cyber club meetup", 40, 40, 3, TITLE)
    draw(pixels, "friday 6pm in lab 2", 40, 90, 2, SUBTITLE)
    draw(pixels, FLAG, 40, 190, 4, HIDDEN)
    return png(pixels)


POSTER = make_poster()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Faded Message</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Faded Message</h1>
<p>The designer of the meetup poster says there is a message on it that only shows "if you look really closely".</p>
<p><a href="/poster.png">Download poster.png</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/poster.png":
            self.reply(200, POSTER, "image/png", "poster.png")
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
