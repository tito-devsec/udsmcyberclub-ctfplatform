"""Member Profiles: a beginner web challenge about IDOR (insecure direct object references).

GZCTF starts one copy per player and passes that player's flag in GZCTF_FLAG.
"""

import os
import signal
import sys
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")

YOU = 7
MEMBERS = {
    1: ("admin", "Club president", f"Private note: the flag is {FLAG}"),
    2: ("neema", "Workshop lead", "Running the Linux basics session on Friday."),
    3: ("baraka", "Treasurer", "Collecting membership fees this month."),
    4: ("amina", "Member", "Loves forensics challenges."),
    5: ("juma", "Member", "Learning Python, one script at a time."),
    6: ("zawadi", "Member", "Getting ready for her first CTF."),
    YOU: ("guest", "Member", "This is your profile. Only you should be able to see it."),
}


def page(title, body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}</style>
</head><body><p>Logged in as <b>guest</b> &middot; <a href="/profile?id={YOU}">My profile</a></p><h1>{title}</h1>{body}</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/":
            self.send_response(302)
            self.send_header("Location", f"/profile?id={YOU}")
            self.send_header("Content-Length", "0")
            self.end_headers()
        elif path == "/profile":
            try:
                member_id = int(parse_qs(query).get("id", [""])[0])
            except ValueError:
                return self.reply(400, page("Profile", "<p>A member number looks like <code>?id=7</code>.</p>"))
            # The bug: the page shows whichever profile is asked for, without checking it is yours.
            if member_id not in MEMBERS:
                return self.reply(404, page("Profile", "<p>No member has that number.</p>"))
            name, role, note = MEMBERS[member_id]
            self.reply(200, page(f"{name}'s profile", f"<p>Member number {member_id}, {role}</p><p>{escape(note)}</p>"))
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
