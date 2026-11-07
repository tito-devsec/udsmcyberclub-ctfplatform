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
5. Apply the UDSM branding under Admin → Settings (values are in the main [README](../README.md#branding)).

Stop with `docker compose down`. Add `-v` to also delete the database and uploaded files.

After changing anything in `src/GZCTF/ClientApp`, run the build again and then `docker compose restart gzctf`.

## Demo content

`node seed-demo.mjs` creates test players, five teams and a game called "Cyber Club Demo CTF" with eight challenges. It stops early if the game already exists. Everything it creates can be edited or deleted from the admin panel.

## Container challenge example

[examples/web-container](examples/web-container) is a small per-team container challenge. Build it:

```bash
docker build -t club/staff-portal:latest examples/web-container
```

Then add a "Dynamic Container" challenge with image `club/staff-portal:latest` and service port `80`. The platform starts one container per team and passes that team's flag in the `GZCTF_FLAG` environment variable, so the image never contains a flag.

## Things to know

- The site is bound to `127.0.0.1`, so only this computer can open it. Change the port line to `"3000:8080"` to let other devices on your network in.
- The platform gets the Docker socket so it can start challenge containers. That gives it control of Docker on this machine, so keep this setup for local use.
- Uploads up to 1 GB are accepted (`MaxRequestBodySize`). Use the "Remote Url" attachment type for anything larger.
- If Docker Desktop shows an error with a "Reset to factory defaults" button, choose Quit instead: a reset deletes every container, image and volume, including this database.
