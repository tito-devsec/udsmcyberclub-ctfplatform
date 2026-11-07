#!/bin/sh
# Runs once per connection, with the socket as stdin and stdout.
# Good enough for a demo; a real challenge would run an actual web app here.

# Read the request headers up to the blank line, so the connection closes cleanly.
cr=$(printf '\r')
while IFS= read -r line; do
  [ -z "$line" ] || [ "$line" = "$cr" ] && break
done

flag="${GZCTF_FLAG:-no flag was provided}"

page="<!doctype html>
<title>Staff portal</title>
<h1>Staff portal</h1>
<p>Nothing to see here. Members only.</p>
<!-- TODO remove before launch: $flag -->
"

printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' \
  "$(printf '%s' "$page" | wc -c)" "$page"
