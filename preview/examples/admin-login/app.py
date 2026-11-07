"""Admin Login: a beginner web challenge about SQL injection.

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import secrets
import signal
import sqlite3
import sys
import threading
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

# Nobody is meant to know the admin password: it is random and only kept in memory
db = sqlite3.connect(":memory:", check_same_thread=False)
db.execute("CREATE TABLE users (username TEXT, password TEXT)")
db.executemany("INSERT INTO users VALUES (?, ?)", [("admin", secrets.token_hex(16)), ("guest", "guest")])
db_lock = threading.Lock()

FORM = """<form method="post" action="/login">
<p><label>Username <input name="username"></label></p>
<p><label>Password <input name="password" type="password"></label></p>
<button>Log in</button></form>"""


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}summary{{color:#888}}</style>
</head><body><h1>{title}</h1>{body}</body></html>"""


def debug(query):
    # a developer forgot to remove this
    return f"<details><summary>Debug</summary><pre>{escape(query)}</pre></details>"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] != "/":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))
        self.reply(200, page("Admin login", "<p>Club admins only. Visitors can log in as guest / guest.</p>" + FORM))

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/login":
            return self.reply(404, page("Not found", "<p>There is no page here.</p>"))

        length = min(int(self.headers.get("Content-Length") or 0), 10_000)
        form = parse_qs(self.rfile.read(length).decode(errors="replace"))
        username = form.get("username", [""])[0]
        password = form.get("password", [""])[0]

        # The bug: the input is pasted into the SQL text instead of being passed as parameters.
        query = f"SELECT username FROM users WHERE username = '{username}' AND password = '{password}'"
        try:
            with db_lock:
                row = db.execute(query).fetchone()
        except sqlite3.Error as error:
            return self.reply(500, page("Admin login", f"<p>Database error: {escape(str(error))}</p>" + FORM + debug(query)))

        if row is None:
            self.reply(401, page("Admin login", "<p>Wrong username or password.</p>" + FORM + debug(query)))
        elif row[0] == "admin":
            self.reply(200, page("Welcome, admin", f"<p>Flag: <code>{FLAG}</code></p>"))
        else:
            self.reply(200, page(f"Welcome, {escape(row[0])}", "<p>Only the admin can see the flag.</p>" + debug(query)))

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
