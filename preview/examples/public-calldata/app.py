"""Public Calldata: a Web3 lab about the input data of transactions.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
A block explorer shows the club's Raffle contract and its transactions. The owner set the
prize code with setCode(string), and a transaction's input data is public: the 4-byte
function selector, then the string ABI-encoded (an offset, a length, the bytes). Decoding
it gives the code, and claiming the prize with that code shows the flag.
"""

import hashlib
import html
import os
import random
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
CODE = f"raffle-{hashlib.sha256(FLAG.encode()).hexdigest()[:10]}"
MASK = (1 << 64) - 1
ROUNDS = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
    0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
    0x000000000000800A, 0x800000008000000A, 0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
ROTATIONS = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]


def rotate(value, count):
    return ((value << count) | (value >> (64 - count))) & MASK if count else value


def permute(lanes):
    for constant in ROUNDS:
        columns = [lanes[x] ^ lanes[x + 5] ^ lanes[x + 10] ^ lanes[x + 15] ^ lanes[x + 20] for x in range(5)]
        lanes = [lanes[i] ^ columns[(i - 1) % 5] ^ rotate(columns[(i + 1) % 5], 1) for i in range(25)]
        moved = [0] * 25
        for x in range(5):
            for y in range(5):
                moved[y + 5 * ((2 * x + 3 * y) % 5)] = rotate(lanes[x + 5 * y], ROTATIONS[x][y])
        lanes = [moved[i] ^ (~moved[(i % 5 + 1) % 5 + 5 * (i // 5)] & moved[(i % 5 + 2) % 5 + 5 * (i // 5)]) for i in range(25)]
        lanes[0] ^= constant
    return lanes


def keccak256(data):
    """Ethereum's hash: Keccak-256 with its original padding, not the later SHA3-256."""
    rate = 136
    padded = bytearray(data) + b"\x01" + bytes(-(len(data) + 1) % rate)
    padded[-1] |= 0x80
    lanes = [0] * 25
    for start in range(0, len(padded), rate):
        for i in range(rate // 8):
            lanes[i] ^= int.from_bytes(padded[start + 8 * i : start + 8 * i + 8], "little")
        lanes = permute(lanes)
    return b"".join(lane.to_bytes(8, "little") for lane in lanes[:4])


def selector(signature):
    return keccak256(signature.encode())[:4]


def abi_string(text):
    data = text.encode()
    return (32).to_bytes(32, "big") + len(data).to_bytes(32, "big") + data + bytes(-len(data) % 32)


RAFFLE = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
OWNER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"

SOURCE = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Raffle {
    address public owner;
    string private code;      // the prize code: nobody can read a private variable, right?

    constructor() { owner = msg.sender; }

    function enter() external payable {
        require(msg.value == 0.1 ether, "the ticket costs 0.1 ether");
    }

    function setCode(string calldata _code) external {
        require(msg.sender == owner, "only the owner");
        code = _code;
    }

    function claim(string calldata _code) external {
        require(keccak256(bytes(_code)) == keccak256(bytes(code)), "wrong code");
        payable(msg.sender).transfer(address(this).balance);
    }
}"""


def make_transactions():
    noise = random.Random(CODE)
    address = lambda: "0x" + noise.randbytes(20).hex()
    block = 18_204_311
    transactions = []
    for kind in ["enter", "enter", "setCode", "enter", "enter", "claim", "enter"]:
        block += noise.randint(1, 40)
        if kind == "enter":
            sender, value, data, status = address(), "0.1 ETH", selector("enter()"), "Success"
        elif kind == "setCode":
            sender, value, data, status = OWNER, "0 ETH", selector("setCode(string)") + abi_string(CODE), "Success"
        else:
            sender, value, data, status = address(), "0 ETH", selector("claim(string)") + abi_string("let-me-win"), "Fail: wrong code"
        transactions.append({"hash": "0x" + noise.randbytes(32).hex(), "block": block, "from": sender, "value": value, "data": data, "status": status})
    return transactions[::-1]


TRANSACTIONS = make_transactions()
BY_HASH = {transaction["hash"]: transaction for transaction in TRANSACTIONS}
state = {"claimed": False}


def page(body):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Raffle</title>
<style>body{{font-family:sans-serif;max-width:52rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
pre{{background:#f1f4f9;padding:1rem;overflow:auto;white-space:pre-wrap;word-break:break-all}}td{{padding:.2rem .7rem;vertical-align:top}}
code{{word-break:break-all}}input{{font:inherit;padding:.35rem;width:24rem}}button{{font:inherit;padding:.35rem 1rem}}.note{{padding:.6rem 1rem;background:#eaf2fb}}</style>
</head><body><h1>Club block explorer</h1>{body}</body></html>""".encode()


def home(message=""):
    rows = "".join(
        f"<tr><td><a href='/tx/{t['hash']}'><code>{t['hash'][:18]}...</code></a></td><td>{t['block']}</td>"
        f"<td><code>0x{t['data'][:4].hex()}</code></td><td><code>{t['from'][:12]}...</code></td><td>{t['value']}</td><td>{t['status']}</td></tr>"
        for t in TRANSACTIONS
    )
    note = f"<p class=note>{message}</p>" if message else ""
    return page(f"""<p>Contract <code>{RAFFLE}</code> (Raffle). Owner <code>{OWNER}</code>. Prize: {"claimed" if state["claimed"] else "0.5 ETH, not claimed yet"}.</p>
{note}<h2>Transactions</h2><table><tr><th>Hash</th><th>Block</th><th>Method</th><th>From</th><th>Value</th><th>Status</th></tr>{rows}</table>
<h2>Write: claim(string _code)</h2><form method=post action=/claim><input name=code placeholder="The prize code"> <button>Send transaction</button></form>
<h2>Verified source</h2><pre>{html.escape(SOURCE)}</pre>""")


def transaction_page(transaction):
    return page(f"""<p><a href="/">Back to the contract</a></p><h2>Transaction details</h2><table>
<tr><td>Hash</td><td><code>{transaction['hash']}</code></td></tr><tr><td>Block</td><td>{transaction['block']}</td></tr>
<tr><td>Status</td><td>{transaction['status']}</td></tr><tr><td>From</td><td><code>{transaction['from']}</code></td></tr>
<tr><td>To</td><td><code>{RAFFLE}</code> (Raffle)</td></tr><tr><td>Value</td><td>{transaction['value']}</td></tr>
<tr><td>Method ID</td><td><code>0x{transaction['data'][:4].hex()}</code></td></tr></table>
<h3>Input data</h3><pre>0x{transaction['data'].hex()}</pre>""")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, home())
        elif path.startswith("/tx/") and path[4:] in BY_HASH:
            self.reply(200, transaction_page(BY_HASH[path[4:]]))
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/claim":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        code = parse_qs(self.rfile.read(length).decode(errors="replace")).get("code", [""])[0].strip()
        if code == CODE:
            state["claimed"] = True
            self.reply(200, home(f"Transaction succeeded: you claimed the prize. Your flag: <code>{FLAG}</code>"))
        else:
            self.reply(200, home('Transaction reverted: "wrong code".'))

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
