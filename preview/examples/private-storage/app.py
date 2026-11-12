"""Private Isn't Secret: a beginner Web3 lab about contract storage.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
A block explorer shows the club's Vault contract. Its password is a private variable, but
private only stops other contracts from reading it: every storage slot of a contract is
public. Reading slot 2 gives the password, and unlocking the vault with it shows the flag.
"""

import hashlib
import html
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
VAULT = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
OWNER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
PASSWORD = f"vault-{hashlib.sha256(FLAG.encode()).hexdigest()[:10]}".encode().ljust(32, b"\0")
state = {"locked": True}

SOURCE = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Vault {
    address public owner;        // slot 0
    bool public locked = true;   // slot 1
    bytes32 private password;    // slot 2

    constructor(bytes32 _password) {
        owner = msg.sender;
        password = _password;
    }

    function unlock(bytes32 _password) external {
        require(_password == password, "wrong password");
        locked = false;
    }
}"""


def slot(number):
    if number == 0:
        return bytes(12) + bytes.fromhex(OWNER[2:])
    if number == 1:
        return (1 if state["locked"] else 0).to_bytes(32, "big")
    if number == 2:
        return PASSWORD
    return bytes(32)


def page(body=""):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Vault</title>
<style>body{{font-family:sans-serif;max-width:48rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
pre{{background:#f1f4f9;padding:1rem;overflow:auto}}input{{font:inherit;padding:.35rem;width:30rem}}button{{font:inherit;padding:.35rem 1rem}}
.note{{padding:.6rem 1rem;background:#eaf2fb;word-break:break-all}}code{{word-break:break-all}}</style>
</head><body><h1>Club block explorer</h1>
<p>Contract <code>{VAULT}</code> (Vault), deployed by <code>{OWNER}</code>. Status: <strong>{"locked" if state["locked"] else "unlocked"}</strong>.</p>
{body}
<h2>Read storage</h2><form action=/storage><input name=slot placeholder="Slot number, such as 0" size=10> <button>Read</button></form>
<h2>Write: unlock(bytes32 _password)</h2><form method=post action=/unlock><input name=password placeholder="0x..."> <button>Send transaction</button></form>
<h2>Verified source</h2><pre>{html.escape(SOURCE)}</pre></body></html>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        address = urlparse(self.path)
        if address.path == "/":
            self.reply(200, page())
        elif address.path == "/storage":
            value = parse_qs(address.query).get("slot", ["0"])[0]
            try:
                number = int(value, 0)
            except ValueError:
                return self.reply(200, page("<p class=note>A slot is a number, such as 0, 1 or 2.</p>"))
            if not 0 <= number < 2**256:
                return self.reply(200, page("<p class=note>A slot is a number from 0 to 2^256 - 1.</p>"))
            self.reply(200, page(f"<p class=note>Slot {number}: <code>0x{slot(number).hex()}</code></p>"))
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/unlock":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        given = parse_qs(self.rfile.read(length).decode(errors="replace")).get("password", [""])[0].strip()
        try:
            # a bytes32 written in hex or as text; either way it is filled with zero bytes on the right
            value = (bytes.fromhex(given[2:]) if given.startswith("0x") else given.encode()).ljust(32, b"\0")
        except ValueError:
            value = b""
        if value[:32] == PASSWORD and len(value) == 32:
            state["locked"] = False
            result = f"<p class=note>Transaction succeeded: the vault is unlocked. Inside: <code>{FLAG}</code></p>"
        else:
            result = '<p class=note>Transaction reverted: "wrong password".</p>'
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
