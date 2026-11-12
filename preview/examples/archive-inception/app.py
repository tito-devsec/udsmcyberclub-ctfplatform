"""Archive Inception: a misc lab about archives inside archives.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
parcel.bin is flag.txt wrapped five times: in a tar archive, then gzip, then zip, then
bzip2, then xz. No layer has a telling name, so the student asks the file command what
each one is and unpacks it with the matching tool.
"""

import bz2
import gzip
import io
import lzma
import os
import signal
import sys
import tarfile
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
WHEN = 1_791_045_667  # an evening in October 2026


def make_parcel():
    text = f"Well done. You unpacked every layer.\n{FLAG}\n".encode()
    layer = io.BytesIO()
    with tarfile.open(fileobj=layer, mode="w") as archive:
        info = tarfile.TarInfo("flag.txt")
        info.size, info.mode, info.mtime = len(text), 0o644, WHEN
        archive.addfile(info, io.BytesIO(text))
    data = gzip.compress(layer.getvalue(), mtime=WHEN)
    layer = io.BytesIO()
    with zipfile.ZipFile(layer, "w", zipfile.ZIP_STORED) as archive:
        archive.writestr(zipfile.ZipInfo("contents", date_time=(2026, 10, 12, 18, 0, 0)), data)
    data = bz2.compress(layer.getvalue())
    return lzma.compress(data, format=lzma.FORMAT_XZ)


PARCEL = make_parcel()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Archive Inception</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Archive Inception</h1>
<p>A member "packed the flag for safekeeping". They like archives a little too much: it is archives all the way down, and none of them has a file extension.</p>
<p><a href="/parcel.bin">Download parcel.bin</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/parcel.bin":
            self.reply(200, PARCEL, "application/octet-stream", "parcel.bin")
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
