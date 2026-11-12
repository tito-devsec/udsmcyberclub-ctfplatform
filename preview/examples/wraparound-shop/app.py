"""Wraparound Shop: a pwn lab about integer overflow.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The shop works out an order's total in a 32-bit signed integer, like a C int. A large
enough quantity makes the total wrap around to a negative number, and paying a negative
total adds credits. With those, the student can afford the flag.
"""

import html
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
ITEMS = {"sticker": ("Club sticker", 25), "hoodie": ("Club hoodie", 450), "flag": ("The flag", 1_000_000)}
START = 100
state = {"balance": START, "bought": []}

SOURCE = """int price = item.price;
int quantity = atoi(form.quantity);   /* checked: 1 to 2147483647 */
int total = price * quantity;          /* a 32-bit signed int */

if (total > balance) {                 /* balance is a long long */
    puts("Not enough credits");
    return;
}
balance -= total;"""


def int32(number):
    """What a C int holds after the multiplication: the lowest 32 bits, read as signed."""
    return (number + 2**31) % 2**32 - 2**31


def page(message=""):
    rows = "".join(
        f"<tr><td>{name}</td><td>{price:,} credits</td><td><form method=post action=/buy>"
        f"<input type=hidden name=item value={key}><input name=quantity value=1 size=12> <button>Buy</button></form></td></tr>"
        for key, (name, price) in ITEMS.items()
    )
    bought = ", ".join(html.escape(item) for item in state["bought"]) or "nothing yet"
    note = f"<p class=note>{message}</p>" if message else ""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Wraparound Shop</title>
<style>body{{font-family:sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
pre{{background:#f1f4f9;padding:1rem;overflow:auto}}td{{padding:.3rem .8rem}}input,button{{font:inherit}}.note{{padding:.6rem 1rem;background:#eaf2fb}}</style>
</head><body><h1>Club shop</h1>
<p>Your balance: <strong>{state["balance"]:,} credits</strong>. You have bought: {bought}.</p>
{note}
<table>{rows}</table>
<p>The shop's code, from the club's repository:</p><pre>{html.escape(SOURCE)}</pre>
<form method=post action=/reset><button>Start again with {START} credits</button></form>
</body></html>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/":
            self.reply(200, page())
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        form = parse_qs(self.rfile.read(length).decode(errors="replace"))
        if self.path == "/reset":
            state.update(balance=START, bought=[])
            return self.reply(200, page(f"Your balance is back to {START} credits."))
        if self.path != "/buy":
            return self.reply(404, b"There is no page here.", "text/plain")
        key = form.get("item", [""])[0]
        if key not in ITEMS:
            return self.reply(200, page("There is no such item."))
        try:
            quantity = int(form.get("quantity", [""])[0])
        except ValueError:
            return self.reply(200, page("The quantity must be a whole number."))
        if not 1 <= quantity <= 2**31 - 1:
            return self.reply(200, page("The quantity must be between 1 and 2,147,483,647."))
        name, price = ITEMS[key]
        total = int32(price * quantity)
        if total > state["balance"]:
            return self.reply(200, page(f"Not enough credits: the total is {total:,} credits."))
        state["balance"] -= total
        state["bought"].append(f"{quantity:,} x {name}")
        message = f"You paid {total:,} credits for {quantity:,} x {name}."
        if key == "flag":
            message += f" Here it is: <code>{FLAG}</code>"
        self.reply(200, page(message))

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
