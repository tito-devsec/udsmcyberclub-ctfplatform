"""Modbus Traffic: an ICS lab about reading Modbus/TCP in a packet capture.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
plant.pcap records the water plant's HMI polling a PLC over Modbus/TCP, which has neither
encryption nor authentication. Among the polls, someone wrote a note into holding
registers 100 and up with function 16 (Write Multiple Registers): two ASCII characters per
register. Wireshark decodes Modbus on port 502; turning the register values back into text
gives the flag.
"""

import os
import signal
import struct
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
HMI = (bytes.fromhex("0019b9a41c02"), bytes([192, 168, 50, 10]))
PLC = (bytes.fromhex("00800f5a3e11"), bytes([192, 168, 50, 20]))
SYN, FIN, PSH, ACK = 0x02, 0x01, 0x08, 0x10


def checksum(data):
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF


class Capture:
    """Builds a pcap file packet by packet, with real Ethernet, IPv4 and TCP headers."""

    def __init__(self, start):
        self.time = start
        self.ip_id = 0x2A10
        self.records = []

    def tcp(self, src, dst, ports, seq, ack, flags, payload=b"", gap=0.002):
        segment = struct.pack("!HHIIBBHHH", ports[0], ports[1], seq, ack, 5 << 4, flags, 64240, 0, 0) + payload
        pseudo = src[1] + dst[1] + struct.pack("!BBH", 0, 6, len(segment))
        segment = segment[:16] + struct.pack("!H", checksum(pseudo + segment)) + segment[18:]
        self.ip_id = (self.ip_id + 1) & 0xFFFF
        ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(segment), self.ip_id, 0x4000, 64, 6, 0, src[1], dst[1])
        ip = ip[:10] + struct.pack("!H", checksum(ip)) + ip[12:]
        packet = dst[0] + src[0] + b"\x08\x00" + ip + segment
        self.time += gap
        seconds = int(self.time)
        self.records.append(struct.pack("<IIII", seconds, int((self.time - seconds) * 1e6), len(packet), len(packet)) + packet)

    def pcap(self):
        return struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1) + b"".join(self.records)


class Session:
    """One Modbus/TCP connection from the HMI to the PLC, one request after another."""

    def __init__(self, capture, port):
        self.capture, self.up, self.down = capture, (port, 502), (502, port)
        self.c, self.s, self.transaction = 2_400_000, 7_100_000, 0
        capture.tcp(HMI, PLC, self.up, self.c, 0, SYN)
        capture.tcp(PLC, HMI, self.down, self.s, self.c + 1, SYN | ACK)
        self.c, self.s = self.c + 1, self.s + 1
        capture.tcp(HMI, PLC, self.up, self.c, self.s, ACK)

    def exchange(self, request, response, gap):
        self.transaction += 1
        frame = lambda pdu: struct.pack(">HHHB", self.transaction, 0, len(pdu) + 1, 1) + pdu
        request, response = frame(request), frame(response)
        self.capture.tcp(HMI, PLC, self.up, self.c, self.s, PSH | ACK, request, gap=gap)
        self.c += len(request)
        self.capture.tcp(PLC, HMI, self.down, self.s, self.c, PSH | ACK, response, gap=0.004)
        self.s += len(response)
        self.capture.tcp(HMI, PLC, self.up, self.c, self.s, ACK)

    def poll(self, values, gap=1.0):
        """Function 3, Read Holding Registers 0 to 9."""
        self.exchange(struct.pack(">BHH", 3, 0, 10), struct.pack(">BB10H", 3, 20, *values), gap)

    def write_one(self, address, value, gap):
        """Function 6, Write Single Register: the reply repeats the request."""
        pdu = struct.pack(">BHH", 6, address, value)
        self.exchange(pdu, pdu, gap)

    def write_many(self, address, values, gap):
        """Function 16, Write Multiple Registers."""
        request = struct.pack(f">BHHB{len(values)}H", 16, address, len(values), 2 * len(values), *values)
        self.exchange(request, struct.pack(">BHH", 16, address, len(values)), gap)

    def close(self):
        self.capture.tcp(HMI, PLC, self.up, self.c, self.s, FIN | ACK, gap=0.5)
        self.capture.tcp(PLC, HMI, self.down, self.s, self.c + 1, FIN | ACK)
        self.capture.tcp(HMI, PLC, self.up, self.c + 1, self.s + 1, ACK)


def make_capture():
    capture = Capture(start=1_791_391_200.0)  # a morning shift in October 2026
    session = Session(capture, 49502)
    # tank level (cm), inflow and outflow (l/min), chlorine dose (x10 mg/l), pumps, alarms, ...
    reading = [712, 1180, 1150, 18, 3, 0, 214, 0, 0, 0]
    for minute in range(6):
        session.poll([value + (minute % 3 if index in (0, 1) else 0) for index, value in enumerate(reading)])
    session.write_one(3, 20, gap=0.8)  # an operator raises the chlorine dose to 2.0 mg/l
    for _ in range(2):
        session.poll(reading[:3] + [20] + reading[4:])
    note = FLAG.encode() + (b"\0" if len(FLAG) % 2 else b"")
    session.write_many(100, list(struct.unpack(f">{len(note) // 2}H", note)), gap=1.3)
    for _ in range(3):
        session.poll(reading[:3] + [20] + reading[4:])
    session.close()
    return capture.pcap()


CAPTURE = make_capture()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Modbus Traffic</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Modbus Traffic</h1>
<p>The water plant's engineering laptop recorded the traffic between the HMI and a PLC during a morning shift. Somebody wrote more than setpoints into the PLC.</p>
<p><a href="/plant.pcap">Download plant.pcap</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/plant.pcap":
            self.reply(200, CAPTURE, "application/vnd.tcpdump.pcap", "plant.pcap")
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
