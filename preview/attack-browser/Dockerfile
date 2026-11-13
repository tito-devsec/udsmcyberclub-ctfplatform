# Firefox for the attack box. The CyberRange service starts one for each student who opens the
# box's Firefox window, and shows its screen there over VNC. It joins the student's box network,
# where their lab machine answers as "target" and their box as "box", and it reaches the web
# only through the egress proxy (../../services/egress). Its downloads land in the box's
# ~/Downloads. It stops with the box, or when nobody has looked at it for a while.
#
# Build it from the preview folder:  docker build -t club/attack-browser attack-browser
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      firefox-esr tigervnc-standalone-server tigervnc-tools openbox socat procps \
      fonts-dejavu-core fonts-liberation2 fonts-noto-color-emoji ca-certificates \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY rootfs/ /

# Firefox's settings for every student (policies.json) and the profile it starts with (user.js).
# The student is user 1000, the owner of the box's Downloads folder they share.
RUN useradd --uid 1000 --create-home --shell /bin/bash student \
 && for dir in /usr/lib/firefox-esr/distribution /etc/firefox/policies; do \
      mkdir -p "$dir" && cp /etc/cyberrange/policies.json "$dir/policies.json"; \
    done \
 && mkdir -p /home/student/Downloads /home/student/profile \
 && cp /etc/cyberrange/user.js /home/student/profile/user.js \
 && chown -R student:student /home/student \
 && chmod 755 /usr/local/bin/cyberrange-browser

USER student
WORKDIR /home/student
ENV HOME=/home/student DISPLAY=:0 GTK_THEME=Adwaita:dark
CMD ["/usr/local/bin/cyberrange-browser"]
