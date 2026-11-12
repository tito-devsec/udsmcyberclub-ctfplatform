"""Stack Smash: a beginner pwn lab about buffer overflows, with the memory on show.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The check-in service imitates a C function that copies a name into a 16-byte buffer with
strcpy. Right after the buffer sit is_admin and, after that, the saved return address. A
name of 17 to 19 characters changes is_admin and nothing else, and the service hands over
the flag. A longer one breaks the return address and the program crashes.
"""

import html
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
RETURN_ADDRESS = (0x00005555555552A9).to_bytes(8, "little")
LABELS = [(0, 16, "name[16]"), (16, 20, "is_admin"), (20, 28, "return address")]

SOURCE = """struct check_in {
    char name[16];
    int  is_admin;
};

void check_in(const char *input) {
    struct check_in me;
    me.is_admin = 0;
    strcpy(me.name, input);        /* copies until the end of input, however long */
    if (me.is_admin)
        print_admin_flag();
}"""


def run(name):
    """What happens to the stack frame when strcpy copies the name, its 0 byte included."""
    data = name.encode()[:64] + b"\0"
    memory = bytearray(16) + bytearray(4) + bytearray(RETURN_ADDRESS)
    memory += bytearray(max(0, len(data) - len(memory)))
    memory[: len(data)] = data
    return memory


def dump(memory):
    rows = []
    for start, end, label in LABELS:
        cells = " ".join(f"{byte:02x}" for byte in memory[start:end])
        rows.append(f"<tr><td>0x{start:02x}</td><td><code>{cells}</code></td><td>{label}</td></tr>")
    return "<table>" + "".join(rows) + "</table>"


def page(body=""):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Stack Smash</title>
<style>body{{font-family:sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
pre{{background:#f1f4f9;padding:1rem;overflow:auto}}td{{padding:.2rem .8rem}}input{{font:inherit;padding:.4rem;width:24rem}}
button{{font:inherit;padding:.4rem 1rem}}.bad{{color:#b02a37}}.good{{color:#0b6b4f}}</style>
</head><body><h1>Member check-in</h1>
<p>The check-in service was written in C long ago. This is the function that runs:</p>
<pre>{html.escape(SOURCE)}</pre>
<form method="post" action="/check-in"><input name="name" placeholder="Your name" autocomplete="off"> <button>Check in</button></form>
{body}</body></html>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/":
            self.reply(200, page(f"<h2>The stack frame before you check in</h2>{dump(run(''))}"))
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/check-in":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        name = parse_qs(self.rfile.read(length).decode(errors="replace")).get("name", [""])[0]
        memory = run(name)
        frame = f"<h2>The stack frame after strcpy</h2>{dump(memory)}"
        if memory[20:28] != RETURN_ADDRESS:
            result = ('<p class="bad"><strong>Segmentation fault (core dumped)</strong>: the return address was '
                      "overwritten, so the program jumped somewhere random and crashed.</p>")
        elif int.from_bytes(memory[16:20], "little"):
            result = f'<p class="good">Welcome, admin. The admin flag is <code>{FLAG}</code></p>'
        else:
            result = f"<p>Checked in as {html.escape(name)}. Admin: no.</p>"
        self.reply(200, page(result + frame))

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
