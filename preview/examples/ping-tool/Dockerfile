# Beginner web challenge: a "network check" page with a command injection bug.
#
# GZCTF starts one copy of this image per player and passes that player's flag in the
# GZCTF_FLAG environment variable. entrypoint.sh moves it into /flag.txt, so the only
# way to the flag is through the bug.
#
# Build:  docker build -t club/ping-tool:latest .
FROM alpine:3

COPY entrypoint.sh handler.sh /
RUN chmod +x /entrypoint.sh /handler.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
