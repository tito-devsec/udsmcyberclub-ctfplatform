"""License Key: a beginner reverse-engineering lab about checks that run in the browser.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The activation page checks the key in JavaScript: it adds each character's position (counted
in fives) to its code and compares the result, backwards, with a list kept in the script.
Undoing that gives the key, which is the student's flag.
"""

import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
EXPECTED = [ord(character) + position % 5 for position, character in enumerate(FLAG)][::-1]

SCRIPT = f"""// SOC Simulator activation, trial edition
const expected = {EXPECTED}

function check(key) {{
  const codes = [...key].map((character, position) => character.charCodeAt(0) + (position % 5))
  return codes.reverse().join(',') === expected.join(',')
}}

document.querySelector('form').addEventListener('submit', (event) => {{
  event.preventDefault()
  const key = document.querySelector('input').value.trim()
  document.querySelector('#result').textContent = check(key)
    ? 'Activated. Thank you for buying SOC Simulator! The key you typed is your flag.'
    : 'That key is not valid.'
}})
""".encode()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>SOC Simulator</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}h1{color:#0864af}
input{font:inherit;padding:.4rem;width:24rem}button{font:inherit;padding:.4rem 1rem}</style>
</head><body><h1>SOC Simulator</h1>
<p>Your trial has ended. Enter a license key to keep training.</p>
<form><input placeholder="License key" autocomplete="off"> <button>Activate</button></form>
<p id="result"></p>
<script src="/activate.js"></script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, PAGE.encode(), "text/html; charset=utf-8")
        elif path == "/activate.js":
            self.reply(200, SCRIPT, "text/javascript; charset=utf-8")
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def reply(self, status, data, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
