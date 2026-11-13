# The attack box: Kali Linux with the tools the labs call for, opened as a terminal in a
# student's browser. The CyberRange service starts one for each student on a private network
# with their lab machine, which answers there as "target". The box has no internet: its tools
# are installed here, and anything else comes from the approved mirror (see mirror.mjs).
#
# Build it from the preview folder:  docker build -t club/attack-box attack-box
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl wget nano vim-tiny less file tree tmux jq unzip zip 7zip xxd bsdextrautils \
      bash-completion procps htop iproute2 net-tools iputils-ping bind9-dnsutils \
      netcat-traditional ncat socat nmap inetutils-telnet ftp openssh-client \
      python3 python3-pip python3-venv python3-requests python3-pwntools python3-pycryptodome \
      python3-pil python3-scapy python3-bs4 python3-pymodbus \
      gcc libc6-dev make gdb ltrace strace binutils radare2 \
      john hashcat pocl-opencl-icd hydra wordlists hashid \
      sqlmap ffuf gobuster dirb nikto whatweb \
      binwalk foremost libimage-exiftool-perl steghide pngcheck imagemagick poppler-utils \
      sqlite3 sleuthkit squashfs-tools cpio \
      tshark tcpdump openssl gnupg \
 && gzip -d /usr/share/wordlists/rockyou.txt.gz \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Kali lets nmap send raw packets as any user through file capabilities. A box runs with fewer
# powers than those, so it refuses to start such a program, and its root user needs none of them.
# The systemd shell scripts only add markers that a browser terminal shows as noise.
RUN setcap -r /usr/lib/nmap/nmap \
 && rm -f /etc/profile.d/70-systemd-shell-extra.sh /etc/profile.d/80-systemd-osc-context.sh /etc/profile.d/nmap.sh \
 && touch /root/.hushlogin

# apt and pip install from the approved mirror only: a folder of packages that the server
# mounts at /opt/mirror. Until staff add something to it, it is empty.
RUN mkdir -p /opt/mirror/apt /opt/mirror/pip \
 && : > /opt/mirror/apt/Packages \
 && rm -f /etc/apt/sources.list.d/* \
 && echo 'deb [trusted=yes] file:/opt/mirror/apt ./' > /etc/apt/sources.list \
 && printf '[global]\nno-index = true\nfind-links = /opt/mirror/pip\nbreak-system-packages = true\ndisable-pip-version-check = true\nroot-user-action = ignore\n' > /etc/pip.conf

COPY rootfs/ /
RUN chmod 755 /usr/local/bin/tools /usr/local/bin/target /usr/local/sbin/apt /usr/local/sbin/apt-get /usr/local/sbin/pip /usr/local/sbin/pip3 /usr/local/share/cyberrange/welcome /usr/local/sbin/cyberrange-start \
 && mkdir -p /root/Desktop /root/Documents /root/Downloads /root/Music /root/Pictures /root/Public /root/Templates /root/Videos

WORKDIR /root
CMD ["/usr/local/sbin/cyberrange-start"]
