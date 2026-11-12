"""Spam Filter: an AI lab about getting past a machine-learning classifier.

The CyberRange starts one copy per student and passes that student's flag in GZCTF_FLAG.
The club's mail server sorts mail with a naive Bayes filter trained on old messages. The
student has to deliver a message containing "free crypto giveaway" to the inbox. Those
words are very spammy, but the filter adds up evidence word by word, so padding the
message with words it trusts (a good-word attack) tips it over. The model page shows
which words those are.
"""

import html
import math
import os
import re
import signal
import sys
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

FLAG = os.environ.pop("GZCTF_FLAG", "udsm{no_flag_was_provided}")
PHRASE = "free crypto giveaway"

SPAM = [
    "free crypto giveaway claim your bitcoin now",
    "win free money click this link now",
    "limited offer free iphone giveaway act now",
    "congratulations you won a free crypto prize",
    "double your bitcoin in 24 hours guaranteed",
    "exclusive giveaway claim free tokens today",
    "cheap loans no credit check click now",
    "your account will be closed verify your password now",
    "earn money fast from home free bonus",
    "free gift card giveaway for the first 100 people",
    "urgent claim your crypto reward before midnight",
    "buy cheap followers and likes free trial",
    "investment opportunity guaranteed returns crypto",
    "you have been selected for a free giveaway",
]
HAM = [
    "the lab meeting is moved to tuesday at four",
    "thanks for the workshop slides they were really helpful",
    "please bring your laptops to the ctf training on friday",
    "the agenda for the club meeting is attached",
    "can someone share the notes from the last session",
    "reminder the lab closes at eight tonight",
    "great job everyone on the ctf results",
    "the next workshop covers web security basics",
    "room 2 is booked for our weekly meeting",
    "please review the writeups before the session",
    "the training schedule for this semester is ready",
    "welcome to the new members of the club",
    "the server maintenance is planned for saturday morning",
    "thanks for helping set up the lab machines",
    "see you all at the meeting on tuesday",
]


def words(text):
    return re.findall(r"[a-z0-9']+", text.lower())


SPAM_COUNTS = Counter(word for message in SPAM for word in words(message))
HAM_COUNTS = Counter(word for message in HAM for word in words(message))
VOCABULARY = set(SPAM_COUNTS) | set(HAM_COUNTS)


def weight(word):
    """How much a word pushes towards spam (above 0) or a real message (below 0)."""
    spam = (SPAM_COUNTS[word] + 1) / (sum(SPAM_COUNTS.values()) + len(VOCABULARY))
    ham = (HAM_COUNTS[word] + 1) / (sum(HAM_COUNTS.values()) + len(VOCABULARY))
    return math.log(spam / ham)


WEIGHTS = {word: weight(word) for word in VOCABULARY}


def classify(text):
    known = [word for word in words(text) if word in WEIGHTS]
    score = sum(WEIGHTS[word] for word in known)
    probability = 1 / (1 + math.exp(-max(-50, min(50, score))))
    return probability, Counter(known)


def page(body=""):
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Spam Filter</title>
<style>body{{font-family:sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;line-height:1.5}}h1{{color:#0864af}}
textarea{{font:inherit;width:100%;height:8rem}}button{{font:inherit;padding:.4rem 1rem}}td{{padding:.15rem .8rem}}
.note{{padding:.6rem 1rem;background:#eaf2fb}}.good{{color:#0b6b4f}}.bad{{color:#b02a37}}</style>
</head><body><h1>Club mail: spam filter</h1>
<p>Send a message that contains the words <strong>{PHRASE}</strong> and make it land in the inbox.
The filter is a naive Bayes classifier trained on the club's old mail. <a href="/model">See what it learned.</a></p>
<form method=post action=/send><textarea name=message placeholder="Your message"></textarea><p><button>Send</button></p></form>
{body}</body></html>""".encode()


def model_page():
    ranked = sorted(WEIGHTS.items(), key=lambda item: item[1])
    row = lambda item: f"<tr><td>{html.escape(item[0])}</td><td>{item[1]:+.2f}</td></tr>"
    return page(
        "<h2>What the filter learned</h2><p>Each word adds its weight; a total above 0 means spam.</p>"
        f"<h3>Words that most suggest a real message</h3><table>{''.join(row(item) for item in ranked[:15])}</table>"
        f"<h3>Words that most suggest spam</h3><table>{''.join(row(item) for item in ranked[::-1][:15])}</table>"
    )


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.reply(200, page())
        elif path == "/model":
            self.reply(200, model_page())
        else:
            self.reply(404, b"There is no page here.", "text/plain")

    def do_POST(self):
        if self.path != "/send":
            return self.reply(404, b"There is no page here.", "text/plain")
        length = min(int(self.headers.get("Content-Length") or 0), 20000)
        message = parse_qs(self.rfile.read(length).decode(errors="replace")).get("message", [""])[0][:5000]
        probability, counted = classify(message)
        contributions = sorted(((WEIGHTS[word] * times, word) for word, times in counted.items()), reverse=True)
        table = "".join(f"<tr><td>{html.escape(word)}</td><td>{value:+.2f}</td></tr>" for value, word in contributions[:12])
        spammy = probability >= 0.5
        verdict = f"Spam probability: {probability:.1%}. " + ("Sent to the spam folder." if spammy else "Delivered to the inbox.")
        if not spammy and PHRASE in " ".join(words(message)):
            verdict += f' <span class=good>The giveaway got through. Flag: <code>{FLAG}</code></span>'
        elif not spammy:
            verdict += f" But it does not say {PHRASE}."
        self.reply(200, page(f'<p class=note>{verdict}</p><h3>The words that counted most</h3><table>{table}</table>'))

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
