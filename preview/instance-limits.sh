#!/bin/sh
# Caps every challenge instance as it starts. Run by the instance-limits service in
# docker-compose.yml, which sets INSTANCE_CPUS, INSTANCE_CPU_SHARES and INSTANCE_PIDS.
#
# GZCTF sets each instance's memory limit itself, but its CPU limit only works for
# Windows containers, so on Linux one instance could use every core of the machine and
# slow the platform down for everyone. GZCTF labels the containers it starts with
# ChallengeId; this adds the missing limits to each of them with `docker update`,
# a moment after it starts.

limit() {
  if docker update --cpus "$INSTANCE_CPUS" --cpu-shares "$INSTANCE_CPU_SHARES" \
    --pids-limit "$INSTANCE_PIDS" "$1" >/dev/null 2>&1; then
    echo "limited instance $(printf '%.12s' "$1")"
  else
    # usually the instance stopped again before it could be updated
    echo "could not limit instance $(printf '%.12s' "$1")" >&2
  fi
}

# Instances that are already running. Note the time first: the event stream below
# replays everything started since then, so nothing that starts in between is missed.
since=$(date +%s)
for id in $(docker ps -q --filter label=ChallengeId); do limit "$id"; done

# Then every new instance. If the stream ends (Docker restarted), this exits and
# Docker restarts the service, which catches up again.
docker events --since "$since" --filter type=container --filter event=start \
  --filter label=ChallengeId --format '{{.Actor.ID}}' |
  while read -r id; do limit "$id"; done
