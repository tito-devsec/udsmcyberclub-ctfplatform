# Local preview

Runs the platform on your own machine with Docker:

- the official GZCTF v1.9.1 image, with the web interface built from `../src/GZCTF/ClientApp` so the UDSM changes show up;
- PostgreSQL;
- the [CyberRange service](../services/cyberrange), which serves Skill Paths, Labs, profiles and the ranking, and runs the practice machines;
- Caddy in front of both on <http://localhost:3000> ([Caddyfile](Caddyfile)): `/api/range` goes to the CyberRange service, everything else to GZCTF.

## First run

1. Copy `.env.example` to `.env` and fill in the passwords and secrets.
2. Build the web interface (needs Node.js and pnpm):

   ```bash
   pnpm --dir ../src/GZCTF/ClientApp install --frozen-lockfile
   pnpm --dir ../src/GZCTF/ClientApp build
   ```

3. Build the images the lessons, labs and demo challenges use as machines, then start everything from this folder:

   ```bash
   node build-lab-images.mjs
   docker build -t club/attack-box attack-box
   docker build -t club/attack-browser attack-browser
   docker compose up -d --build
   ```

   `build-lab-images.mjs` builds every image a lab needs that is not on this computer yet, from [examples](examples) (add `--all` to build them all again). `seed-beginner-ctf.mjs` also builds the ones its challenges need. The attack box image is Kali Linux with its tools: the first build downloads about 550 MB and takes up about 3.6 GB. The attack box's Firefox image takes up about 1.5 GB.

4. Open <http://localhost:3000> and sign in as `Admin` with `ADMIN_PASSWORD` from `.env`. The first start takes about 30 seconds while the database is created.
5. Apply the UDSM branding under Admin → Settings (values are in the main [README](../README.md#branding)), and turn on **API Encryption** there. Browsers then encrypt passwords and flags before sending them.

Stop with `docker compose down`. Add `-v` to also delete the database and uploaded files.

After changing anything in `src/GZCTF/ClientApp`, run the build again and then `docker compose restart gzctf`. Reload the page once the build has finished: a page loaded halfway through a build can show an error until it is reloaded. After changing a lesson or a lab in `../content`, run `docker compose restart range`; after changing the CyberRange service itself, `docker compose up -d --build range`.

## Skill Paths and Labs

**Skill Paths** in the side menu is the learning section. A path is a set of modules; a module has chapters of short sections, each followed by questions, and sections open one after another. Answers earn XP, which adds up to a level and a rank. The first path is **Web Security Beginner** (4 modules, 18 sections), which uses the web challenge images below as its machines. How to write lessons: [content/README.md](../content/README.md); how the service works: [services/cyberrange/README.md](../services/cyberrange/README.md).

**Labs**, also in the side menu, are machines and challenges with no lesson: a scenario, a machine or files, and tasks that end with the flag. There are 36, at least two in each of the twelve categories. The web, crypto and forensics labs use the same images as the challenges below; the others have machines of their own, listed under [Lab machines](#lab-machines).

The site opens on the Skill Paths dashboard. From the avatar menu, **Profile** shows a student's score, rank, streak, badges and certificates, and its **Ranking** button opens the ranking. The Hall of Fame there is last week's top 50, so it stays empty until the first full week has been played.

Students sign in with their platform account. Their progress is kept in the `cyberrange` database, which the service creates on first start next to the platform's. The `Admin` account is the superadmin. Only they see the **Members** tab, where they make tutors and admins and give the verified tick; set `SUPERADMINS` in `.env` to name someone else.

Tutors and admins get a **Studio** tab. There they write modules, labs and skill paths in the browser and publish them, and propose games. A proposed game waits for the superadmin, who approves it (the game is then created on the platform and put online) or sends it back with a note. Machines in the studio and in proposed games can use the images built on this computer whose names start with `club/` (set `MACHINE_IMAGES` on the `range` service to allow others).

The superadmin's Studio page also opens **Certificates**. There they preview what a module, skill path or game certificate looks like, issue certificates of participation once a game is over (everyone who took part finds one on their profile), and set who signs: the names and titles of the club's president and the college's principal, and a picture of each signature (a PNG with a see-through background works best, though a white background also blends into the sheet). Certificates show the signatures next to the UDSM and club logos, and the logo of the module's or skill path's category on the seal (a game's seal has a flag).

## Demo content

Two scripts fill the preview with something to try. Both read the logins from `.env`, work with API Encryption on or off ([gzctf-api.mjs](gzctf-api.mjs) encrypts passwords and flags the way the web interface does), and stop early if their game already exists. Everything they create can be edited or deleted from the admin panel.

- `node seed-beginner-ctf.mjs` creates **UDSM Beginner CTF**, an individual game with the 20 beginner challenges listed below, in web, crypto, forensics and OSINT. Each player has 5 attempts per challenge. In web, crypto and forensics, every player gets their own instance and their own `udsm{...}` flag; instances last 60 minutes, and players can add 30 more in the last 10. The script builds any challenge image that is missing and sets that instance lifetime for the whole platform. Run it again after adding a challenge to the script: it adds what the game is missing (and renames the game if it still has its old name, UDSM Web Basics).
- `node seed-demo.mjs` creates test players, five teams and a team game called "Cyber Club Demo CTF" with eight challenges.

To play, sign in as `testuser` with `TEST_USER_PASSWORD` from `.env`.

## Challenges

Each of these folders in [examples](examples) is one challenge, built around one idea (the other folders there are [lab machines](#lab-machines)). Web, crypto and forensics challenges are small per-player containers; crypto and forensics ones make each player's ciphertext or file from that player's own flag.

| Challenge | Folder | Points | What players learn |
| --- | --- | --- | --- |
| Staff Portal | [web-container](examples/web-container) | 100 | reading the page source |
| Hidden Pages | [hidden-pages](examples/hidden-pages) | 100 | `robots.txt` is public |
| Secret Agent | [secret-agent](examples/secret-agent) | 150 | request headers are written by the visitor |
| Members Only | [members-only](examples/members-only) | 150 | cookies can be edited |
| Club Shop | [club-shop](examples/club-shop) | 150 | hidden form fields can be edited too |
| Member Profiles | [member-profiles](examples/member-profiles) | 200 | IDOR: check who owns what is asked for |
| Club Library | [club-library](examples/club-library) | 200 | path traversal with `../` |
| Ping Tool | [ping-tool](examples/ping-tool) | 200 | command injection |
| Admin Login | [admin-login](examples/admin-login) | 250 | SQL injection |
| **Crypto** | | | |
| Shifty Notes | [shifty-notes](examples/shifty-notes) | 100 | the Caesar cipher |
| Encoding Layers | [encoding-layers](examples/encoding-layers) | 100 | Base32, Base64 and hex are encodings, not encryption |
| Single Byte | [single-byte](examples/single-byte) | 150 | XOR with a one-byte key and a known plaintext |
| Weak Hash | [weak-hash](examples/weak-hash) | 150 | cracking an MD5 password hash with a wordlist |
| **Forensics** | | | |
| Not a PDF | [not-a-pdf](examples/not-a-pdf) | 100 | file signatures ("magic bytes") |
| Strings Attached | [strings-attached](examples/strings-attached) | 100 | `strings` on a binary file |
| Hidden Metadata | [hidden-metadata](examples/hidden-metadata) | 150 | image metadata with `exiftool` |
| Lost Packets | [lost-packets](examples/lost-packets) | 200 | reading a packet capture in Wireshark |
| **OSINT** | | | |
| Campus History | (no files) | 100 | finding public records |
| Who Runs .tz? | (no files) | 100 | the IANA Root Zone Database |
| Where Is This? | [where-is-this](examples/where-is-this) | 150 | GPS positions in photo metadata |

OSINT answers are public facts, so their flags are the same for every player and flag sharing cannot be detected there. The answers were checked against Wikipedia and IANA in November 2026.

The Python ones are a good starting point for new challenges: `app.py` reads the flag from `GZCTF_FLAG` and serves a page or a download, and the Dockerfile is the same for each. To add one by hand, build its image first:

```bash
docker build -t club/admin-login:latest examples/admin-login
```

Then add a "Dynamic Container" challenge with that image and service port `80`, and set:

- **Flag template:** `udsm{some_words_[TEAM_HASH]}`. `[TEAM_HASH]` makes every player's flag different. The server works it out from a secret it keeps for each game, so one player's flag says nothing about another's.
- **Submission limit:** for example `5`. Once a player has used that many attempts, the challenge is locked for them.
- **Network:** "Isolated" for challenges that do not need the internet.

The platform starts one container per player (or per team in a team game) and passes the flag in the `GZCTF_FLAG` environment variable, so the image never contains a flag.

## Lab machines

These folders in [examples](examples) are machines for the labs only, one per lab, each built around one idea. Like the challenges, each takes the student's flag from `GZCTF_FLAG` and makes what the student works on from it, using nothing but Python's standard library. `node build-lab-images.mjs` builds them.

| Lab | Folder | Category | What students learn |
| --- | --- | --- | --- |
| Password Checker | [password-checker](examples/password-checker) | Reverse engineering | reading the code that checks a password, and undoing it |
| License Key | [license-key](examples/license-key) | Reverse engineering | a check that runs in the browser gives its secret away |
| Stack Smash | [stack-smash](examples/stack-smash) | Pwn | a buffer overflow, with the stack frame on show |
| Wraparound Shop | [wraparound-shop](examples/wraparound-shop) | Pwn | integer overflow in a 32-bit total |
| Faded Message | [faded-message](examples/faded-message) | Steganography | text one colour step away from the background |
| Least Significant | [least-significant](examples/least-significant) | Steganography | a message in the lowest bit of each pixel |
| Hidden Files | [hidden-files](examples/hidden-files) | Misc | files and folders whose names start with a dot |
| Archive Inception | [archive-inception](examples/archive-inception) | Misc | telling archive formats apart with `file` |
| UART Capture | [uart-capture](examples/uart-capture) | Hardware | decoding a serial port from a logic analyser capture |
| Firmware Dump | [firmware-dump](examples/firmware-dump) | Hardware | `strings` on a flash dump, and XOR is not encryption |
| Modbus Traffic | [modbus-traffic](examples/modbus-traffic) | ICS | reading Modbus/TCP register writes in Wireshark |
| Water Tank HMI | [water-tank-hmi](examples/water-tank-hmi) | ICS | a safety limit kept only in the HMI's page |
| Spam Filter | [spam-filter](examples/spam-filter) | AI | getting past a naive Bayes filter with words it trusts |
| Memorised Secret | [memorised-secret](examples/memorised-secret) | AI | a model that repeats its training data |
| Private Isn't Secret | [private-storage](examples/private-storage) | Web3 | a contract's private storage can be read by anyone |
| Public Calldata | [public-calldata](examples/public-calldata) | Web3 | a transaction's input data is public too |

The pwn, ICS, AI and Web3 machines imitate what they teach in a small web page, so they run in the same small containers as the rest: the stack frame of a C function, a PLC that trusts its HMI, a model trained on a few dozen messages, a block explorer over one contract. Nothing there is a real binary, PLC, model or blockchain.

## Attack Box

**Attack Box** in the CyberRange header (or **Open attack box** under any lab machine) opens <http://localhost:3000/attackbox> in its own tab: a desktop like Kali's, with Kali's panel along the top, Kali's own icons, a wallpaper drawn for the club in the style of Kali's, and the club's logo beside "UDSM CyberRange" where Kali shows its own. Starting the box gives the student a Kali Linux container of their own for two hours (it can be extended in its last ten minutes), and a terminal window opens by itself. Every new terminal starts with the club's welcome art, the box's rules and whether a lab machine is there. The prompt is drawn like Kali's and reads `udsmcyberrange@<player>`, also after `sudo su`. Windows move by their title bar, resize from any edge or corner, and fill the screen with a double click on the title. Where the desktop's artwork comes from, and under which licences, is in [assets/attackbox](../src/GZCTF/ClientApp/src/assets/attackbox/README.md).

- **Target.** The student's lab machine joins the box's private network under the name `target`, whether it starts before or after the box: `nmap target`, `curl http://target`, `nc target 9001`. The command `target` lists its open ports, and `tools` lists what is installed.
- **Tools.** `tools` in the terminal lists the box's tools by topic, with commands to start from, and the Help window lists the same commands (a click copies one). Looking around: `nmap`, `dig`, `curl`, `wget`, `nc`, `ncat`, `socat`, `telnet`, `ftp`, `ssh`. Web: `whatweb`, `nikto`, `ffuf`, `gobuster`, `dirb`, `sqlmap`. Passwords: `john`, `hashcat`, `hydra`, `hashid`, with rockyou and the dirb lists in `/usr/share/wordlists`. Crypto and coding: `python3` with pwntools, pycryptodome (as `Crypto`, the name solver scripts import, and as `Cryptodome`), requests, scapy, pymodbus and Pillow, `openssl`, `gpg`, `xxd`. Files and forensics: `file`, `strings`, `binwalk`, `foremost`, `exiftool`, `pdftotext`, `sqlite3`, `7z`, `xz`, `bzip2`, `mmls`, `fls`. Pictures: `steghide`, `pngcheck`, ImageMagick. Captures: `tshark`, `tcpdump`. Programs: `gdb`, `radare2`, `ltrace`, `strace`, `objdump`, `gcc`, `pwn checksec`. Editors: `nano`, `vim`, `tmux`. They reach the student's lab machine and nothing else: `whatweb example.com` fails with "no address", on purpose, while `whatweb http://target` works.
- **Terminal.** Made like Kali's QTerminal: the Session, Actions, Edit, View and Help menus, tabs, a split view, Find, a right-click menu, and QTerminal's keys. Ctrl+Shift+C and Ctrl+Shift+V copy and paste, Ctrl+Shift+T opens a tab, Ctrl+Shift+R and Ctrl+Shift+D split, Ctrl+Shift+F finds text, and Ctrl + and Ctrl - change the text size. Browsers keep a few keys for themselves (Ctrl+Shift+T, Ctrl+Shift+W, Ctrl+Shift+N, Ctrl+PgUp, Ctrl+PgDn): in full screen (F11) Chrome and Edge pass them on to the terminal too. While a box runs, the page asks before it is closed.
- **File Manager.** Made like Kali's Thunar: places on the left, folders and files as icons, back, forward, up and home, a location bar, a filter, menus, a right-click menu and Thunar's keys (F2 renames, Delete deletes, Ctrl+H shows hidden files). It shows the whole box. Files dropped on it are sent into the folder that is open, a double click downloads a file (up to 25 MB each way), and pictures open in the picture viewer.
- **Firefox.** Firefox ESR runs on the server, in a container of its own next to the student's box ([attack-browser](attack-browser)), and its screen is shown in the box's Firefox window over VNC. Searches and every website stay inside the attack box. The window can be resized like the others, and Firefox follows it. Copying and pasting works both ways with the student's own computer (their browser asks once whether the page may read the clipboard). Firefox opens the student's lab machine as `http://target` and a web server they start in their box as `http://box:8000`, and what it downloads lands in the box's `~/Downloads`. Its start page carries the club's logo as set on the platform, with a search box and links to reference sites, and it searches with DuckDuckGo's plain pages, which load quickest over a slow connection. It starts when its window is first opened, stops with the box, and also stops after 20 minutes with its window closed. Set `BOX_BROWSER: "off"` on the `range` service to turn it off.
- **Firefox's way out.** Firefox reaches the web only through the `egress` service ([services/egress](../services/egress)), a proxy that lets through http and https on their usual ports to addresses on the internet. It refuses private and reserved addresses, so this server, the platform and other students' machines stay out of reach, and it notes which student's Firefox asked for which site (`docker compose logs egress`). On a real server, add the server's own public IP to `EGRESS_DENY`. Websites see the server's address, not the student's. Each Firefox may use 1 GB of memory and one CPU core (`BROWSER_MEMORY_MB`, `BROWSER_CPUS`).
- **Burp Suite.** Burp Suite Community Edition (Kali's package, with the Java it runs on) runs in the same container as the student's Firefox, on a second screen of its own, shown in the box's Burp Suite window, which opens from its icon on the desktop or in the panel, or from the Applications menu. It starts when that window is first opened, and opens as it does on Kali, in about ten seconds while the window says it is starting: its loading screen, PortSwigger's terms and conditions the first time (for each student to read and accept), then "Temporary project in memory" and "Use Burp defaults", each at its own size, before its main window fills the box's window. Since version 2026.10, Burp first asks whether to continue as Professional or Community; the image answers Community for every student ([burp-prefs.xml](attack-browser/rootfs/etc/cyberrange/burp-prefs.xml)), so nobody lands on Professional's licence screen, and the terms stay each student's to accept. Intercept starts off, so pages are not held until a student turns it on. While it runs, whatever Firefox opens on `target` or `box` passes through Burp's proxy on 127.0.0.1:8080 ([proxy.pac](attack-browser/rootfs/etc/cyberrange/proxy.pac)), so HTTP history, Intercept and Repeater work with nothing to set up; while it does not, Firefox goes to them directly. Websites still go through `egress`, and Burp gets no further than Firefox: the lab machine, the box, and websites only through `egress`. Opening Burp gives that container 1 GB more memory and one more CPU core (`BURP_MEMORY_MB`, `BURP_CPUS`), and Burp stops with Firefox. Two things in the image make it start quickly: Burp's own browser (a Chromium inside its jar, which Burp otherwise unpacks into every new container, 700 MB at each first start) comes unpacked, and Java's ahead-of-time cache for Burp, made by one trial run of Burp while the image is built, saves Java loading and linking its classes again at every start. Together they bring Burp's first window from about 35 seconds to under 10 next to a starting Firefox, for some 800 MB more in the image and 700 MB less on disk for every student who opens Burp. A student who minimises Burp clicks its empty screen to bring it back.
- **Picture viewer.** Each colour on its own, each of its eight bits, stretched contrast, every shade in its own colour, and the hidden bits read out as text, hex or a file. It runs in the browser, so it also works without a box, and a picture opened from the student's computer is never sent anywhere.
- **CyberChef.** GCHQ's CyberChef, served by the `tools` service on <http://localhost:3001>: an address of its own, so nothing that runs there can act on the platform with the student's sign-in. Its Dockerfile checks the download against its published SHA-256.
- **No internet.** A box reaches only its own target and its Firefox: no internet, no other student, not the server or its services, not even Firefox's proxy. Every box runs with few Linux capabilities, no new privileges, and limits on memory, CPU, processes and disk (`BOX_*` in `docker-compose.yml`). A box that fills its disk or runs out of time is removed with its network.
- **Installing tools.** `apt install` and `pip install` in a box work only for packages in the approved mirror, a Docker volume every box reads. Admins add to it on the server:

  ```bash
  node mirror.mjs add apt <package>
  node mirror.mjs add pip <package>
  node mirror.mjs list
  node mirror.mjs remove apt <package>
  ```

  Packages are fetched by a throwaway copy of the box that has internet, so they match the box exactly, and every box can install them at once.

A lab does not have to fit the attack box. Its author can ask for anything, and a student whose lab needs more (a graphical tool, a full desktop, hardware) uses their own Linux machine, which reaches lab machines at the address on the lab's page as before.

On a real server, give the tools service a domain of its own and set `TOOLS_URL` to it, keep `BOX_SEATS` within what the server's memory allows (about 250 MB for each busy box, about 400 MB for its Firefox, and up to 1 GB more while its Burp Suite runs), and consider `BOX_RUNTIME=runsc` ([gVisor](https://gvisor.dev)) so that boxes run in a sandbox of their own. Docker 27.1 or newer also hides the server's own address from boxes.

## Things to know

- Challenge instances cannot reach each other. `docker-compose.yml` creates the two challenge networks (`gzctf-open`, `gzctf-isolated`) with container-to-container traffic turned off, before the platform would create them with it on. Docker cannot change this on an existing network: to apply it to an older setup, run `docker compose down`, then `docker network rm gzctf-open gzctf-isolated`, then `docker compose up -d`.
- On Docker Desktop, instances on the "Isolated" network can still reach the internet, because Docker Desktop sends all container traffic through its own network layer. Docker's setting applies on a Linux server; test it there before relying on it.
- Each challenge instance may use at most half a CPU core and 256 processes, with a low CPU priority so the platform stays responsive when the machine is busy. The `instance-limits` service in `docker-compose.yml` applies this to every instance as it starts ([instance-limits.sh](instance-limits.sh)). GZCTF sets each instance's memory limit itself, but its CPU limit only works for Windows containers, so the per-challenge "CPU Limit" field has no effect here. Change the numbers in `docker-compose.yml`.
- The proxy sends the platform's requests that change, delete or reset the password of a user (`PUT` and `DELETE` under `/api/admin/users/`) through the CyberRange service. Other admins can still look after members, but only the superadmin gives roles or touches an admin's account. If that service is down, those actions in the admin pages fail until it is back.
- The site is bound to `127.0.0.1`, so only this computer can open it. Change the port line to `"3000:8080"` to let other devices on your network in.
- After API Encryption is turned on, a browser tab that was already open cannot sign in or submit flags until it is reloaded. Its flag submissions are refused without using up an attempt. Turn it on before an event, not during one.
- The platform gets the Docker socket so it can start challenge containers, and `instance-limits` gets it to limit them. That gives both control of Docker on this machine, so keep this setup for local use.
- Uploads up to 1 GB are accepted (`MaxRequestBodySize`). Use the "Remote Url" attachment type for anything larger.
- If Docker Desktop shows an error with a "Reset to factory defaults" button, choose Quit instead: a reset deletes every container, image and volume, including this database.
- If starting a lab machine says that the lab machines are not answering, Docker itself has stopped starting containers. On Windows this happens when WSL hangs (`wsl -l -v` stops answering too). Quit Docker Desktop, run `wsl --shutdown`, start Docker Desktop again and run `docker compose up -d`. The CyberRange service removes any machine that was left half-started.
