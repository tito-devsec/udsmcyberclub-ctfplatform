"""Memorised Secret: an AI lab about models that repeat their training data.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The club trained a small autocomplete model on its chat history to help members write
messages. Someone had pasted the lab flag into that chat. The model is a character n-gram
model: it continues text the way its training text continued, so typing the start of the
sentence that held the secret makes it complete the secret, word for word.
"""

import html
import os
import signal
import sys
from collections import Counter, defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
ORDER = 8  # how many characters of context the model looks at

CHAT = [
    "[2026-09-02 18:11] amina: who is coming to the ctf training on friday?",
    "[2026-09-02 18:13] kelvin: me, I will bring the extension cables",
    "[2026-09-02 18:20] neema: can someone send the slides from last week?",
    "[2026-09-03 09:02] amina: the slides are in the shared folder",
    "[2026-09-05 16:45] baraka: the lab machines are updated, please reboot yours",
    "[2026-09-05 16:47] neema: thanks baraka",
    "[2026-09-08 12:30] kelvin: who wants to write the writeup for the web challenges?",
    "[2026-09-08 12:34] amina: I can do the crypto ones",
    "[2026-09-10 20:15] baraka: remember the meeting moved to tuesday at four",
    "[2026-09-10 20:16] neema: noted, see you all on tuesday",
    "[2026-09-12 14:02] amina: the wifi password for the lab changed, ask kelvin",
    "[2026-09-14 21:03] kelvin: the lab flag is " + FLAG + " please do not share it",
    "[2026-09-14 21:05] baraka: kelvin you just pasted that in the group chat",
    "[2026-09-14 21:06] kelvin: oops, I will change it next week",
    "[2026-09-16 10:40] neema: the next workshop covers reverse engineering",
    "[2026-09-16 10:42] amina: great, I will bring my notes",
    "[2026-09-18 19:00] baraka: good luck to everyone in the national ctf this weekend",
    "[2026-09-20 22:10] kelvin: we finished fourth, well done everyone",
]
SAMPLES = [line for line in CHAT if FLAG not in line and "pasted" not in line and "oops" not in line][:8]


def train(text):
    model = defaultdict(lambda: defaultdict(Counter))
    for end in range(1, len(text)):
        for size in range(1, ORDER + 1):
            if end - size >= 0:
                model[size][text[end - size : end]][text[end]] += 1
    return model


MODEL = train("\n".join(CHAT) + "\n")


def complete(prompt, limit=90):
    """Adds the most likely next character, again and again, using the longest context it knows."""
    text = prompt
    for _ in range(limit):
        for size in range(min(ORDER, len(text)), 0, -1):
            choices = MODEL[size].get(text[-size:])
            if choices:
                character = max(sorted(choices), key=choices.get)
                break
        else:
            break
        if character == "\n":
            break
        text += character
    return text[len(prompt) :]


def page(body=""):
    samples = "".join(f"<li><code>{html.escape(line)}</code></li>" for line in SAMPLES)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Memorised Secret</title>
<style>body{{font-family:sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
input{{font:inherit;padding:.4rem;width:28rem}}button{{font:inherit;padding:.4rem 1rem}}.note{{padding:.6rem 1rem;background:#eaf2fb}}
mark{{background:#ffe08a}}</style>
</head><body><h1>Club autocomplete</h1>
<p>We trained a small model on our group chat so it can finish your sentences. Type the start of a message.</p>
<form method=post action=/complete><input name=prompt placeholder="Start typing" autocomplete="off"> <button>Complete</button></form>
{body}
<h3>A few messages it learned from</h3><ul>{samples}</ul></body></html>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/":
            self.reply(200, page())
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/complete":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        prompt = parse_qs(self.rfile.read(length).decode(errors="replace")).get("prompt", [""])[0][:200]
        added = complete(prompt)
        result = (f"<p class=note><code>{html.escape(prompt)}<mark>{html.escape(added)}</mark></code></p>"
                  if added else "<p class=note>The model has nothing to add to that.</p>")
        self.reply(200, page(result))

    def reply(self, status, data, content_type="text/html; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
