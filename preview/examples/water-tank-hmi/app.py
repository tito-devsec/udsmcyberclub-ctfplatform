"""Water Tank HMI: a beginner ICS lab about safety limits that live only in the browser.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The plant's web HMI sets the chlorine dose. Its slider stops at 5 mg/l and a script in the
page refuses anything higher, but the plant itself accepts any number. Sending a dose
above 10 mg/l (by editing the request, or with curl) sets off the plant's alarm, and the
incident report holds the flag. The lesson: safety limits belong in the controller.
"""

import html
import math
import os
import signal
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
state = {"dose": 1.8}


def page(message=""):
    note = f"<p class=note>{message}</p>" if message else ""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Water Tank HMI</title>
<style>body{{font-family:sans-serif;max-width:44rem;margin:3rem auto;padding:0 1rem;line-height:1.5;background:#e9edf2}}
h1{{color:#0864af}}.panel{{background:#fff;border:1px solid #c8d1dc;border-radius:6px;padding:1rem 1.4rem;margin-bottom:1rem}}
td{{padding:.2rem 1rem .2rem 0}}.note{{padding:.6rem 1rem;background:#fff4d6;border-left:4px solid #e0a800}}
.alarm{{padding:.6rem 1rem;background:#ffe3e3;border-left:4px solid #c92a2a}}input[type=range]{{width:20rem}}</style>
</head><body><h1>Treatment plant, tank 2</h1>
<div class=panel><table>
<tr><td>Tank level</td><td>7.12 m</td></tr>
<tr><td>Inflow</td><td>1,180 l/min</td></tr>
<tr><td>Chlorine dose</td><td><strong>{state["dose"]:g} mg/l</strong></td></tr>
<tr><td>Safety limit</td><td>10 mg/l (alarm and shutdown above it)</td></tr></table></div>
{note}
<div class=panel><form method=post action=/setpoint onsubmit="return checkDose()">
<label>Chlorine dose: <input type=range name=dose min=0 max=5 step=0.1 value="{min(state["dose"], 5):g}"
 oninput="this.nextElementSibling.textContent = this.value + ' mg/l'"> <span>{min(state["dose"], 5):g} mg/l</span></label>
<p><button>Apply</button></p></form></div>
<script>
function checkDose() {{
  const dose = Number(document.querySelector('[name=dose]').value)
  if (dose > 5) {{ alert('Unsafe dose. The HMI allows 0 to 5 mg/l.'); return false }}
  return true
}}
</script></body></html>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/":
            self.reply(200, page())
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/setpoint":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 4096)
        value = parse_qs(self.rfile.read(length).decode(errors="replace")).get("dose", [""])[0]
        try:
            dose = float(value)
        except ValueError:
            return self.reply(200, page(f"The PLC did not understand the dose {html.escape(value)!r}."))
        if not math.isfinite(dose) or dose < 0:
            return self.reply(200, page("The PLC only accepts doses of 0 mg/l or more."))
        # the PLC trusts the HMI: whatever arrives is applied
        state["dose"] = round(dose, 2)
        if dose > 10:
            message = (f"<span class=alarm>ALARM: chlorine dose {dose:g} mg/l is above the safety limit. "
                       f"Dosing pumps stopped. Incident report {FLAG}</span>")
        else:
            message = f"Setpoint applied: {dose:g} mg/l."
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
