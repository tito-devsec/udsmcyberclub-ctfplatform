# Firefox for the attack box. The CyberRange service starts one for each student who opens the
# box's Firefox window, and shows its screen there over VNC. It joins the student's box network,
# where their lab machine answers as "target" and their box as "box", and it reaches the web
# only through the egress proxy (../../services/egress). Its downloads land in the box's
# ~/Downloads. It stops with the box, or when nobody has looked at it for a while.
#
# Burp Suite runs here too, on a second screen, once a student opens its window in the box.
# Whatever Firefox opens on "target" or "box" then passes through Burp (rootfs/etc/cyberrange/
# proxy.pac), and Burp gets no further than Firefox does.
#
# Build it from the preview folder:  docker build -t club/attack-browser attack-browser
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      firefox-esr tigervnc-standalone-server tigervnc-tools openbox socat procps \
      fonts-dejavu-core fonts-liberation2 fonts-noto-color-emoji ca-certificates \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Burp Suite Community Edition and the Java it runs on, from Kali (about 450 MB more). It starts
# only when a student opens its window, on a screen of its own (see cyberrange-burp); xwininfo
# tells when its window is up, and xsetroot colours that screen.
RUN apt-get update \
 && apt-get install -y --no-install-recommends burpsuite x11-utils x11-xserver-utils \
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
 && chmod 755 /usr/local/bin/cyberrange-browser /usr/local/bin/cyberrange-burp

USER student
WORKDIR /home/student
ENV HOME=/home/student DISPLAY=:0 GTK_THEME=Adwaita:dark
CMD ["/usr/local/bin/cyberrange-browser"]
