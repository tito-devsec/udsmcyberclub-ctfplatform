"""Lost Packets: a beginner forensics challenge about reading network captures.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
capture.pcap is a recording of a member's laptop looking up the club intranet and
logging in to it over plain HTTP, with the flag as the password. Wireshark shows it.
"""

import os
import signal
import struct
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

LAPTOP = (bytes.fromhex("3c22fb7a10c4"), bytes([192, 168, 10, 23]))
INTRANET = (bytes.fromhex("00163e5c2b01"), bytes([192, 168, 10, 5]))
ROUTER = (bytes.fromhex("a4910b3366d2"), bytes([192, 168, 10, 1]))
HOST = "intranet.club.local"
SYN, FIN, PSH, ACK = 0x02, 0x01, 0x08, 0x10


def checksum(data):
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF


class Capture:
    """Builds a pcap file packet by packet, with real Ethernet, IPv4, TCP and UDP headers."""

    def __init__(self, start):
        self.time = start
        self.ip_id = 0x1C46
        self.records = []

    def frame(self, src, dst, protocol, segment, gap):
        self.ip_id = (self.ip_id + 1) & 0xFFFF
        ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(segment), self.ip_id, 0x4000, 64, protocol, 0, src[1], dst[1])
        ip = ip[:10] + struct.pack("!H", checksum(ip)) + ip[12:]
        packet = dst[0] + src[0] + b"\x08\x00" + ip + segment
        self.time += gap
        seconds = int(self.time)
        self.records.append(struct.pack("<IIII", seconds, int((self.time - seconds) * 1e6), len(packet), len(packet)) + packet)

    def tcp(self, src, dst, ports, seq, ack, flags, payload=b"", gap=0.002):
        segment = struct.pack("!HHIIBBHHH", ports[0], ports[1], seq, ack, 5 << 4, flags, 64240, 0, 0) + payload
        pseudo = src[1] + dst[1] + struct.pack("!BBH", 0, 6, len(segment))
        segment = segment[:16] + struct.pack("!H", checksum(pseudo + segment)) + segment[18:]
        self.frame(src, dst, 6, segment, gap)

    def udp(self, src, dst, ports, payload, gap=0.002):
        segment = struct.pack("!HHHH", ports[0], ports[1], 8 + len(payload), 0) + payload
        pseudo = src[1] + dst[1] + struct.pack("!BBH", 0, 17, len(segment))
        segment = segment[:6] + struct.pack("!H", checksum(pseudo + segment) or 0xFFFF) + segment[8:]
        self.frame(src, dst, 17, segment, gap)

    def http(self, client_port, request, response, gap):
        """One TCP connection: handshake, a request, its response, and the goodbye."""
        c, s = 1_000_000 + client_port * 7, 3_000_000 + client_port * 11
        up, down = (client_port, 80), (80, client_port)
        self.tcp(LAPTOP, INTRANET, up, c, 0, SYN, gap=gap)
        self.tcp(INTRANET, LAPTOP, down, s, c + 1, SYN | ACK)
        self.tcp(LAPTOP, INTRANET, up, c + 1, s + 1, ACK)
        self.tcp(LAPTOP, INTRANET, up, c + 1, s + 1, PSH | ACK, request)
        c += 1 + len(request)
        self.tcp(INTRANET, LAPTOP, down, s + 1, c, ACK)
        self.tcp(INTRANET, LAPTOP, down, s + 1, c, PSH | ACK, response, gap=0.03)
        s += 1 + len(response)
        self.tcp(LAPTOP, INTRANET, up, c, s, ACK)
        self.tcp(LAPTOP, INTRANET, up, c, s, FIN | ACK)
        self.tcp(INTRANET, LAPTOP, down, s, c + 1, FIN | ACK)
        self.tcp(LAPTOP, INTRANET, up, c + 1, s + 1, ACK)

    def pcap(self):
        return struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1) + b"".join(self.records)


def dns_message(ident, flags, answer=None):
    question = b"".join(bytes([len(part)]) + part.encode() for part in HOST.split(".")) + b"\0" + struct.pack("!HH", 1, 1)
    message = struct.pack("!HHHHHH", ident, flags, 1, 1 if answer else 0, 0, 0) + question
    if answer:
        message += struct.pack("!HHHIH", 0xC00C, 1, 1, 300, 4) + answer
    return message


def http_request(method, path, body=b"", extra=""):
    head = (f"{method} {path} HTTP/1.1\r\nHost: {HOST}\r\n"
            "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0\r\n"
            f"{extra}Connection: close\r\n")
    if body:
        head += f"Content-Type: application/x-www-form-urlencoded\r\nContent-Length: {len(body)}\r\n"
    return head.encode() + b"\r\n" + body


def http_response(status, body=b"", extra=""):
    return (f"HTTP/1.1 {status}\r\nServer: nginx\r\n{extra}Content-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode() + body


def make_capture():
    capture = Capture(start=1_791_045_667.0)  # an evening in October 2026
    capture.udp(LAPTOP, ROUTER, (53211, 53), dns_message(0x4F2A, 0x0100))
    capture.udp(ROUTER, LAPTOP, (53, 53211), dns_message(0x4F2A, 0x8180, INTRANET[1]), gap=0.011)
    login_form = b"<html><body><h1>Club intranet</h1><form method=post action=/login>...</form></body></html>"
    capture.http(51840, http_request("GET", "/"), http_response("200 OK", login_form, "Content-Type: text/html\r\n"), gap=0.02)
    body = f"username=treasurer&password={quote(FLAG, safe='')}".encode()
    capture.http(51844, http_request("POST", "/login", body),
                 http_response("302 Found", extra="Location: /dashboard\r\nSet-Cookie: session=7f3c9a12e4b6; HttpOnly\r\n"), gap=4.7)
    capture.http(51848, http_request("GET", "/dashboard", extra="Cookie: session=7f3c9a12e4b6\r\n"),
                 http_response("200 OK", b"<html><body>Welcome back, treasurer.</body></html>", "Content-Type: text/html\r\n"), gap=0.1)
    return capture.pcap()


CAPTURE = make_capture()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Lost Packets</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Lost Packets</h1>
<p>We recorded the traffic on the club Wi-Fi while a member logged in to the old club intranet. That site never got HTTPS.</p>
<p><a href="/capture.pcap">Download capture.pcap</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/capture.pcap":
            self.reply(200, CAPTURE, "application/vnd.tcpdump.pcap", "capture.pcap")
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
