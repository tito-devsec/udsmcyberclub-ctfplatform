#!/bin/sh
# Put this player's flag in a file and take it out of the environment, so it cannot be
# read with `env` and has to be found on disk. Then serve the page: every connection
# runs handler.sh with the socket as stdin and stdout.
flag=${GZCTF_FLAG:-no flag was provided}
printf '%s\n' "$flag" > /flag.txt
unset GZCTF_FLAG flag

exec nc -lk -p 80 -e /handler.sh
