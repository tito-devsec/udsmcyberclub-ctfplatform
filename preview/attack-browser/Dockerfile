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

# The student is user 1000, the owner of the box's Downloads folder they share.
RUN useradd --uid 1000 --create-home --shell /bin/bash student

# Burp's jar carries its own browser, a Chromium of 680 MB, as a zip that Burp unpacks into
# ~/.BurpSuite/burpbrowser when that is not there yet: in each student's new container, at every
# first start of Burp, which took most of its start-up time and wrote 700 MB to the container's
# disk. Unpacked here once, it is part of the image, and Burp finds it ready and leaves it as it
# is. The zip holds a few names twice, hence -o.
RUN zip=$(unzip -Z1 /usr/share/burpsuite/burpsuite.jar 'chromium-linux64-*.zip') \
 && version=${zip#chromium-linux64-} && version=${version%.zip} \
 && mkdir -p /home/student/.BurpSuite/burpbrowser/$version \
 && unzip -p /usr/share/burpsuite/burpsuite.jar "$zip" > /tmp/chromium.zip \
 && unzip -o -q /tmp/chromium.zip -d /home/student/.BurpSuite/burpbrowser/$version \
 && rm /tmp/chromium.zip \
 && chown -R student:student /home/student/.BurpSuite

COPY rootfs/ /

# Firefox's settings for every student (policies.json) and the profile it starts with (user.js).
# Burp starts with one choice made, where Java keeps Burp's settings (burp-prefs.xml): the free
# Community Edition, which Kali packages, so it opens as on Kali instead of first offering
# Professional. Its terms are not among them: each student reads and accepts those. (Only what
# is made here changes owner: a chown of all of /home/student would copy Burp's browser again.)
RUN for dir in /usr/lib/firefox-esr/distribution /etc/firefox/policies; do \
      mkdir -p "$dir" && cp /etc/cyberrange/policies.json "$dir/policies.json"; \
    done \
 && mkdir -p /home/student/Downloads /home/student/profile /home/student/.java/.userPrefs/burp \
 && cp /etc/cyberrange/user.js /home/student/profile/user.js \
 && cp /etc/cyberrange/burp-prefs.xml /home/student/.java/.userPrefs/burp/prefs.xml \
 && chown -R student:student /home/student/Downloads /home/student/profile /home/student/.java \
 && chmod 755 /usr/local/bin/cyberrange-browser /usr/local/bin/cyberrange-burp

# Java's ahead-of-time cache for Burp: one trial run of Burp up to its first window, with no
# network, as students have none to the web either (see cyberrange-burp). It takes a minute here
# and makes Burp's every start quicker.
RUN --network=none su student -s /bin/sh -c 'HOME=/home/student /usr/local/bin/cyberrange-burp train /tmp/burp.aot' \
 && mv /tmp/burp.aot /usr/share/burpsuite/burp.aot \
 && chown root:root /usr/share/burpsuite/burp.aot && chmod 644 /usr/share/burpsuite/burp.aot \
 && rm -rf /tmp/hsperfdata_student

USER student
WORKDIR /home/student
ENV HOME=/home/student DISPLAY=:0 GTK_THEME=Adwaita:dark
CMD ["/usr/local/bin/cyberrange-browser"]
