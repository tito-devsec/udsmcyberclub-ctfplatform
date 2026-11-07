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

- `node seed-web-demo.mjs` creates **UDSM Web Basics**, an individual game with two beginner web challenges: [Staff Portal](examples/web-container) and [Ping Tool](examples/ping-tool). Every player gets their own instance and their own `udsm{...}` flag, with 5 attempts per challenge. Instances last 60 minutes, and players can add 30 more in the last 10. The script builds the two challenge images if they are missing and sets that instance lifetime for the whole platform.
- `node seed-demo.mjs` creates test players, five teams and a team game called "Cyber Club Demo CTF" with eight challenges.

To play, sign in as `testuser` with `TEST_USER_PASSWORD` from `.env`.

## Container challenges

[examples/web-container](examples/web-container) (read the page source) and [examples/ping-tool](examples/ping-tool) (command injection) are small per-player web challenges. To add one by hand, build its image first:

```bash
docker build -t club/ping-tool:latest examples/ping-tool
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
