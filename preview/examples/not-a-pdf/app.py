"""Not a PDF: a beginner forensics challenge about file signatures ("magic bytes").

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
homework.pdf is really a ZIP archive with the flag inside. It is compressed, so
searching the file for text finds nothing: the player has to notice what it is.
"""

import io
import os
import signal
import sys
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")


def make_homework():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("homework/README.txt", "Networking homework, week 3. The answers are in answers.txt.\n")
        archive.writestr("homework/answers.txt", (
            "1. A tool that records network traffic: a packet sniffer\n"
            "2. The usual port for HTTPS: 443\n"
            f"3. The flag: {FLAG}\n"
        ))
    return buffer.getvalue()


HOMEWORK = make_homework()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Not a PDF</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Not a PDF</h1>
<p>A member emailed their homework as a PDF, but no PDF reader will open it. They insist the file is fine.</p>
<p><a href="/homework.pdf">Download homework.pdf</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/homework.pdf":
            self.reply(200, HOMEWORK, "application/pdf", "homework.pdf")
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
