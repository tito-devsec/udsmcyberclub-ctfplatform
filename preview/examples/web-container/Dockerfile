# Minimal container challenge: a one-page "web app" that hides the flag in its HTML source.
#
# GZCTF starts one copy of this image per team and passes that team's flag in the
# GZCTF_FLAG environment variable, so the image never contains a flag itself.
#
# Build:  docker build -t club/staff-portal:latest .
FROM alpine:3

COPY handler.sh /handler.sh
RUN chmod +x /handler.sh

EXPOSE 80
CMD ["nc", "-lk", "-p", "80", "-e", "/handler.sh"]
