#!/bin/sh
# Ping Tool: a deliberately vulnerable page for beginners (command injection).
# Runs once per connection, with the socket as stdin and stdout.
set -f # no filename expansion while splitting the query string

cr=$(printf '\r')
read -r _ target _
# Skip the rest of the request headers
while IFS= read -r line; do
  [ -z "$line" ] || [ "$line" = "$cr" ] && break
done

# Take "host" out of the query string and URL-decode it
host=''
query=${target#*\?}
[ "$query" = "$target" ] && query=''
IFS='&'
for pair in $query; do
  case $pair in host=*) host=${pair#host=} ;; esac
done
unset IFS
host=$(printf '%s' "$host" | sed 's/+/ /g; s/%\([0-9A-Fa-f][0-9A-Fa-f]\)/\\x\1/g')
host=$(printf '%b' "$host")

escape() { sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'; }

result=''
if [ -n "$host" ]; then
  # The bug: whatever the visitor typed becomes part of a shell command.
  result=$(sh -c "ping -c 1 -W 1 $host" 2>&1 | escape)
fi

page="<!doctype html>
<title>Ping Tool</title>
<h1>Network check</h1>
<p>Type an address and we will check that it is online.</p>
<form><input name=\"host\" value=\"$(printf '%s' "$host" | escape)\" placeholder=\"127.0.0.1\"> <button>Ping</button></form>
<pre>$result</pre>
"

printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' \
  "$(printf '%s' "$page" | wc -c)" "$page"
