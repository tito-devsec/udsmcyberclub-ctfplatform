# Local preview

Runs the platform on your own machine with Docker: the official GZCTF v1.9.1 image, PostgreSQL, and the web interface built from `../src/GZCTF/ClientApp` so the UDSM changes show up.

## First run

1. Copy `.env.example` to `.env` and fill in the passwords.
2. Build the web interface (needs Node.js and pnpm):

   ```bash
   pnpm --dir ../src/GZCTF/ClientApp install --frozen-lockfile
   pnpm --dir ../src/GZCTF/ClientApp build
   ```

3. Start it from this folder:

   ```bash
   docker compose up -d
   ```

4. Open <http://localhost:3000> and sign in as `Admin` with `ADMIN_PASSWORD` from `.env`. The first start takes about 30 seconds while the database is created.
5. Apply the UDSM branding under Admin → Settings (values are in the main [README](../README.md#branding)), and turn on **API Encryption** there. Browsers then encrypt passwords and flags before sending them.

Stop with `docker compose down`. Add `-v` to also delete the database and uploaded files.

After changing anything in `src/GZCTF/ClientApp`, run the build again and then `docker compose restart gzctf`.

## Demo content

Two scripts fill the preview with something to try. Both read the logins from `.env`, work with API Encryption on or off ([gzctf-api.mjs](gzctf-api.mjs) encrypts passwords and flags the way the web interface does), and stop early if their game already exists. Everything they create can be edited or deleted from the admin panel.

- `node seed-web-demo.mjs` creates **UDSM Web Basics**, an individual game with the nine beginner web challenges listed below. Every player gets their own instance and their own `udsm{...}` flag, with 5 attempts per challenge. Instances last 60 minutes, and players can add 30 more in the last 10. The script builds any challenge image that is missing and sets that instance lifetime for the whole platform. Run it again after adding a challenge to the script: it adds what the game is missing.
- `node seed-demo.mjs` creates test players, five teams and a team game called "Cyber Club Demo CTF" with eight challenges.

To play, sign in as `testuser` with `TEST_USER_PASSWORD` from `.env`.

## Container challenges

Each folder in [examples](examples) is a small per-player web challenge, built around one mistake:

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

The Python ones are a good starting point for new challenges: `app.py` reads the flag from `GZCTF_FLAG` and serves a few pages, and the Dockerfile is the same for each. To add one by hand, build its image first:

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
