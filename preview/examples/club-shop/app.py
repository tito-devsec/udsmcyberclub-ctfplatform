"""Club Shop: a beginner web challenge about hidden form fields.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import signal
import sys
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

BALANCE = 10
ITEMS = {"sticker": ("Club sticker", 5), "flag": ("The flag", 1000)}


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}td{{padding:.3rem 1rem .3rem 0}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


def shop():
    rows = "".join(
        f'<tr><td>{name}</td><td>{price} coins</td><td><form method="post" action="/buy">'
        f'<input type="hidden" name="item" value="{key}"><input type="hidden" name="price" value="{price}">'
        "<button>Buy</button></form></td></tr>"
        for key, (name, price) in ITEMS.items()
    )
    return f"<p>Your balance: <b>{BALANCE} coins</b></p><table>{rows}</table>"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))
        self.reply(200, page("Club shop", shop()))

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/buy":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))

        length = min(int(self.headers.get("Content-Length") or 0), 10_000)
        form = parse_qs(self.rfile.read(length).decode(errors="replace"))
        item = form.get("item", [""])[0]
        if item not in ITEMS:
            return self.reply(400, page("Club shop", "<p>We do not sell that.</p>" + shop()))
        try:
            # The bug: the price comes from the visitor's form, not from the shop's own list.
            price = int(form.get("price", [""])[0])
        except ValueError:
            return self.reply(400, page("Club shop", "<p>The price must be a whole number.</p>" + shop()))

        name = ITEMS[item][0]
        if price > BALANCE:
            message = f"<p>Not enough coins: {escape(name)} costs {price} and you have {BALANCE}.</p>"
            return self.reply(402, page("Club shop", message + shop()))
        if item == "flag":
            return self.reply(200, page("Thank you!", f"<p>You bought the flag for {price} coins.</p><p>Flag: <code>{FLAG}</code></p>"))
        self.reply(200, page("Thank you!", f"<p>Enjoy your {escape(name)}!</p>" + shop()))

    def reply(self, status, body):
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the container log quiet


signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
ThreadingHTTPServer(("", 80), Handler).serve_forever()
