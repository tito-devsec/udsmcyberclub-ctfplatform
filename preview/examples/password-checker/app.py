"""Password Checker: a beginner reverse-engineering lab about reading code.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
checker.py checks a password without keeping it in plain text: every character is XORed
with 42 and then has its position added. Undoing those two steps gives the password,
which is the student's flag.
"""

import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
SECRET = [(ord(character) ^ 42) + position for position, character in enumerate(FLAG)]

CHECKER = f'''#!/usr/bin/env python3
# Club door checker v1.2
# The password is not in this file, so it is safe to share. (We think.)

SECRET = {SECRET}


def check(password):
    if len(password) != len(SECRET):
        return False
    for position, character in enumerate(password):
        if (ord(character) ^ 42) + position != SECRET[position]:
            return False
    return True


if __name__ == "__main__":
    attempt = input("Password: ")
    print("Door open. Welcome!" if check(attempt) else "Wrong password.")
'''.encode()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>Password Checker</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}</style>
</head><body><h1>Password Checker</h1>
<p>The lab door runs this Python script to check the password. Its author says the password is not in the file.</p>
<p><a href="/checker.py">Download checker.py</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/checker.py":
            self.reply(200, CHECKER, "text/x-python; charset=utf-8", "checker.py")
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
