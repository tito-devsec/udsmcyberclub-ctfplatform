# Tools that run fully in the student's browser, served from an address of their own (so their
# pages can never act on the platform with a student's sign-in): CyberChef, by GCHQ, under the
# Apache 2.0 licence. The release is checked against its published SHA-256 before it is used.
#
# Build it from the preview folder:  docker compose build tools
FROM alpine:3.22 AS fetch
ARG CYBERCHEF_URL=https://github.com/gchq/CyberChef/releases/download/v11.5.0/CyberChef_8cd426dd4f40f1423912d5fad91b578a86a65112.zip
ARG CYBERCHEF_SHA256=f6478925d3eaa16ec08626a85f5b85eed10d531a5e18700615fed7ecb024cccf
RUN wget -q -O /tmp/cyberchef.zip "$CYBERCHEF_URL" \
 && echo "$CYBERCHEF_SHA256  /tmp/cyberchef.zip" | sha256sum -c - \
 && mkdir -p /srv/cyberchef \
 && unzip -q /tmp/cyberchef.zip -d /srv/cyberchef \
 && mv /srv/cyberchef/CyberChef_*.html /srv/cyberchef/index.html \
 && rm /tmp/cyberchef.zip

FROM caddy:2.10-alpine
COPY --from=fetch /srv /srv
COPY Caddyfile /etc/caddy/Caddyfile
