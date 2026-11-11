# Local preview

Runs the platform on your own machine with Docker:

- the official GZCTF v1.9.1 image, with the web interface built from `../src/GZCTF/ClientApp` so the UDSM changes show up;
- PostgreSQL;
- the [Labs service](../services/labs), which serves the Labs section and its lab machines;
- Caddy in front of both on <http://localhost:3000> ([Caddyfile](Caddyfile)): `/api/labs` goes to the Labs service, everything else to GZCTF.

## First run

1. Copy `.env.example` to `.env` and fill in the passwords and secrets.
2. Build the web interface (needs Node.js and pnpm):

   ```bash
   pnpm --dir ../src/GZCTF/ClientApp install --frozen-lockfile
   pnpm --dir ../src/GZCTF/ClientApp build
   ```

3. Build the images the labs and demo challenges use as machines (see [Challenges](#challenges); `seed-beginner-ctf.mjs` also builds any that are missing), then start everything from this folder:

   ```bash
   docker compose up -d --build
   ```

4. Open <http://localhost:3000> and sign in as `Admin` with `ADMIN_PASSWORD` from `.env`. The first start takes about 30 seconds while the database is created.
5. Apply the UDSM branding under Admin → Settings (values are in the main [README](../README.md#branding)), and turn on **API Encryption** there. Browsers then encrypt passwords and flags before sending them.

Stop with `docker compose down`. Add `-v` to also delete the database and uploaded files.

After changing anything in `src/GZCTF/ClientApp`, run the build again and then `docker compose restart gzctf`. After changing a lab in `../labs`, run `docker compose restart labs`; after changing the Labs service itself, `docker compose up -d --build labs`.

## Labs

**Labs** in the side menu is the learning section: paths of short lessons, each followed by questions, most with a machine of the student's own. Labs open one after another. The first path is **Web Security Beginner** (9 labs), which uses the web challenge images below as its machines. How to write labs: [labs/README.md](../labs/README.md); how the service works: [services/labs/README.md](../services/labs/README.md).

Students sign in with their platform account. Their progress is kept in the `labs` database, which the Labs service creates on first start next to the platform's.

## Demo content

Two scripts fill the preview with something to try. Both read the logins from `.env`, work with API Encryption on or off ([gzctf-api.mjs](gzctf-api.mjs) encrypts passwords and flags the way the web interface does), and stop early if their game already exists. Everything they create can be edited or deleted from the admin panel.

- `node seed-beginner-ctf.mjs` creates **UDSM Beginner CTF**, an individual game with the 20 beginner challenges listed below, in web, crypto, forensics and OSINT. Each player has 5 attempts per challenge. In web, crypto and forensics, every player gets their own instance and their own `udsm{...}` flag; instances last 60 minutes, and players can add 30 more in the last 10. The script builds any challenge image that is missing and sets that instance lifetime for the whole platform. Run it again after adding a challenge to the script: it adds what the game is missing (and renames the game if it still has its old name, UDSM Web Basics).
- `node seed-demo.mjs` creates test players, five teams and a team game called "Cyber Club Demo CTF" with eight challenges.

To play, sign in as `testuser` with `TEST_USER_PASSWORD` from `.env`.

## Challenges

Each folder in [examples](examples) is one challenge, built around one idea. Web, crypto and forensics challenges are small per-player containers; crypto and forensics ones make each player's ciphertext or file from that player's own flag.

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

## Things to know

- Challenge instances cannot reach each other. `docker-compose.yml` creates the two challenge networks (`gzctf-open`, `gzctf-isolated`) with container-to-container traffic turned off, before the platform would create them with it on. Docker cannot change this on an existing network: to apply it to an older setup, run `docker compose down`, then `docker network rm gzctf-open gzctf-isolated`, then `docker compose up -d`.
- On Docker Desktop, instances on the "Isolated" network can still reach the internet, because Docker Desktop sends all container traffic through its own network layer. Docker's setting applies on a Linux server; test it there before relying on it.
- Each challenge instance may use at most half a CPU core and 256 processes, with a low CPU priority so the platform stays responsive when the machine is busy. The `instance-limits` service in `docker-compose.yml` applies this to every instance as it starts ([instance-limits.sh](instance-limits.sh)). GZCTF sets each instance's memory limit itself, but its CPU limit only works for Windows containers, so the per-challenge "CPU Limit" field has no effect here. Change the numbers in `docker-compose.yml`.
- The site is bound to `127.0.0.1`, so only this computer can open it. Change the port line to `"3000:8080"` to let other devices on your network in.
- After API Encryption is turned on, a browser tab that was already open cannot sign in or submit flags until it is reloaded. Its flag submissions are refused without using up an attempt. Turn it on before an event, not during one.
- The platform gets the Docker socket so it can start challenge containers, and `instance-limits` gets it to limit them. That gives both control of Docker on this machine, so keep this setup for local use.
- Uploads up to 1 GB are accepted (`MaxRequestBodySize`). Use the "Remote Url" attachment type for anything larger.
- If Docker Desktop shows an error with a "Reset to factory defaults" button, choose Quit instead: a reset deletes every container, image and volume, including this database.
