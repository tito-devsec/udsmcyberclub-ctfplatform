"""Club Library: a beginner web challenge about path traversal.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
This writes it to /flag.txt, outside the folder the library reads from.
"""

import os
import signal
import sys
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote

with open("/flag.txt", "w") as file:
    file.write(os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}") + "\n")

BOOKS = "/app/books"


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}pre{{white-space:pre-wrap}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/":
            links = "".join(
                f'<li><a href="/read?book={quote(name)}">{escape(name)}</a></li>' for name in sorted(os.listdir(BOOKS))
            )
            self.reply(200, page("Club library", f"<p>Notes and guides written by club members.</p><ul>{links}</ul>"))
        elif path == "/read":
            book = parse_qs(query).get("book", [""])[0]
            try:
                # The bug: the name is stuck onto the folder as it is, so ../ climbs out of it.
                with open(BOOKS + "/" + book, encoding="utf-8", errors="replace") as file:
                    text = file.read(20_000)
            except FileNotFoundError:
                return self.reply(404, page("Club library", "<p>There is no book with that name.</p>"))
            except OSError as error:
                return self.reply(400, page("Club library", f"<p>That cannot be opened: {escape(error.strerror or str(error))}.</p>"))
            self.reply(200, page(escape(book), f'<pre>{escape(text)}</pre><p><a href="/">Back to the library</a></p>'))
        else:
            self.reply(404, page("Not found", "<p>There is no page here.</p>"))

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
