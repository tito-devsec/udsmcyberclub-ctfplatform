"""UART Capture: a hardware lab about decoding a serial port from a logic analyser.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
uart.csv is a recording of the TX pin of a router's debug port while it boots: the time of
every change of level, in microseconds. The port talks at 9600 baud, 8N1: a start bit (0),
eight data bits with the lowest first, and a stop bit (1); the line rests high. The
shortest pulse gives away the speed. One of the boot messages carries the flag.
"""

import os
import random
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
BAUD = 9600
BIT = 1_000_000 / BAUD  # one bit, in microseconds

MESSAGE = (
    "\r\nU-Boot 2016.01 (Mar 03 2019 - 11:42:07)\r\n"
    "DRAM:  64 MiB\r\n"
    "Loading kernel from flash... OK\r\n"
    "Starting kernel ...\r\n"
    f"debug: factory flag = {FLAG}\r\n"
    "router login: "
)


def make_capture():
    gaps = random.Random(BAUD)
    rows, level, time = ["time_us,tx", "0.00,1"], 1, 1500.0
    for byte in MESSAGE.encode():
        for bit in [0] + [(byte >> position) & 1 for position in range(8)] + [1]:
            if bit != level:
                rows.append(f"{time:.2f},{bit}")
                level = bit
            time += BIT
        # the router does not always send the next character straight away
        time += gaps.choice([0, 0, 0, 0.5, 1.5, 3]) * BIT
    rows.append(f"{time + 2000:.2f},1")
    return ("\n".join(rows) + "\n").encode()


CAPTURE = make_capture()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>UART Capture</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>UART Capture</h1>
<p>A logic analyser was left on the debug port of the club's old router while it booted. It recorded the TX pin: one row for each change of level, with the time in microseconds.</p>
<p>The port uses 8N1: a start bit (0), eight data bits with the lowest bit first, and a stop bit (1). When nothing is sent, the line stays high. Nobody wrote down its speed.</p>
<p><a href="/uart.csv">Download uart.csv</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/uart.csv":
            self.reply(200, CAPTURE, "text/csv; charset=utf-8", "uart.csv")
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
