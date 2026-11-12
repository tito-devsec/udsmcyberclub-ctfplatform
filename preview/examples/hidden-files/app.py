"""Hidden Files: a beginner misc lab about files whose names start with a dot.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
project.tar.gz is a member's project folder. A plain ls does not show names that start with
a dot, and the flag sits in a hidden file inside a hidden folder. ls -a, or find, shows it.
"""

import io
import os
import signal
import sys
import tarfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
WHEN = 1_791_045_667  # an evening in October 2026

FILES = {
    "project/README.md": "# Weather station\n\nReads the sensors on the roof of the lab every minute.\nNotes are in docs/.\n",
    "project/flag.txt": "Nice try. This is not it. The real one is hidden better than that.\n",
    "project/src/main.py": "import sensors\n\n\nwhile True:\n    sensors.read_all()\n    sensors.sleep(60)\n",
    "project/src/sensors.py": "def read_all():\n    pass\n\n\ndef sleep(seconds):\n    pass\n",
    "project/docs/notes.txt": "TODO: take the secret out of the project before sharing it.\n",
    "project/.env": "API_URL=http://localhost:8080\nDEBUG=true\n",
    "project/.gitignore": ".env\n.secret/\n__pycache__/\n",
    "project/.secret/.flag.txt": f"{FLAG}\n",
}


def make_archive():
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        folders = sorted({os.path.dirname(name) for name in FILES})
        for folder in folders:
            info = tarfile.TarInfo(folder)
            info.type, info.mode, info.mtime = tarfile.DIRTYPE, 0o755, WHEN
            archive.addfile(info)
        for name, text in FILES.items():
            data = text.encode()
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(data), 0o644, WHEN
            archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


ARCHIVE = make_archive()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Hidden Files</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Hidden Files</h1>
<p>A member shared their project folder and says the flag is "somewhere in there". They also say a plain <code>ls</code> will not help you.</p>
<p><a href="/project.tar.gz">Download project.tar.gz</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/project.tar.gz":
            self.reply(200, ARCHIVE, "application/gzip", "project.tar.gz")
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
