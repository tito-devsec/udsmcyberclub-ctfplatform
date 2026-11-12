"""Firmware Dump: a beginner hardware lab about reading a flash memory dump.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
flash.bin is the 64 KB flash chip of a smart lock: a bootloader header, code, and a
configuration block. The vendor calls the admin secret "encrypted", but it is XORed with
one byte that sits right next to it. strings finds the block; undoing the XOR gives the flag.
"""

import os
import random
import signal
import struct
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
KEY = 0x5A


def make_flash():
    noise = random.Random(4096)
    image = bytearray(b"\xff" * 65536)  # erased flash reads as FF
    header = b"SMLK" + struct.pack("<HH", 2, 4) + b"SmartLock Pro bootloader v2.4.1\0"
    image[: len(header)] = header
    code = bytes(noise.getrandbits(8) for _ in range(0x7000))
    image[0x100 : 0x100 + len(code)] = code
    config = (
        "[config]\n"
        "device=SmartLock Pro\n"
        "serial=SL-2024-00731\n"
        "wifi_ssid=ClubLab\n"
        "wifi_pass=********\n"
        f"obf_key={KEY:02x}\n"
        f"admin_secret={bytes(byte ^ KEY for byte in FLAG.encode()).hex()}\n"
        "[end]\n"
    ).encode() + b"\0"
    image[0x8000 : 0x8000 + len(config)] = config
    return bytes(image)


FLASH = make_flash()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Firmware Dump</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Firmware Dump</h1>
<p>Someone desoldered the flash chip of a smart lock and read it out. The vendor says the admin secret on it is encrypted, so nobody can get it.</p>
<p><a href="/flash.bin">Download flash.bin</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/flash.bin":
            self.reply(200, FLASH, "application/octet-stream", "flash.bin")
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
