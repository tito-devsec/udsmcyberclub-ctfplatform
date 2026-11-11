# Labs service

The server side of the platform's **Labs** section: learning paths, lessons with questions, students' progress, and each student's own lab machine. The pages live in the web interface (`src/GZCTF/ClientApp/src/pages/labs`); the lessons are files in [labs/](../../labs).

GZCTF itself is unchanged. This service runs next to it, behind the same proxy, which sends `/api/labs/...` here and everything else to GZCTF.

## How it works

- **Sign-in:** there are no accounts here. For each request the service passes the visitor's GZCTF sign-in cookie to GZCTF (`/api/account/profile`) and uses the profile that comes back, cached for a minute. GZCTF admins are admins here too.
- **Lessons:** read from the labs folder at start-up (see [labs/README.md](../../labs/README.md)). Mistakes in a lab file stop the service with a message naming the file and the problem. Accepted answers are kept only as SHA-256 hashes and are never sent to the browser.
- **Progress:** stored in its own PostgreSQL database (`labs`), created on first start on the same server as the platform's. It holds which questions each student answered, every attempt (right or wrong, without the answer itself), and running machines.
- **Unlocking:** in a sequential path, a lab opens when the one before it is complete. Locked labs show only what to finish first, and refuse answers and machines.
- **Machines:** one Docker container per student at a time, started on request, removed after 60 minutes unless extended (+30 minutes, in the last 10). They run on the `gzctf-isolated` network with traffic between containers off, no internet, 64 MB of memory, half a CPU core and 256 processes. The machine gets the student's flag in `GZCTF_FLAG`, so the platform's challenge images work as lab machines.
- **Flags:** `[USER_HASH]` in a machine's flag is an HMAC of the student and the lab with `LABS_SECRET`. Every student's flag is different, and flags are never stored.
- **Abuse:** answers are rate-limited (10, then one every 6 seconds per student); machine starts too (3, then one a minute). Requests that change something must be JSON, so other websites cannot send them on a student's behalf.

## API

All under `/api/labs`. Errors are `{ "title": "...", "status": 400 }`.

| Request | Who | Does |
| --- | --- | --- |
| `GET /paths` | anyone | every path, with the student's progress |
| `GET /paths/:path` | anyone | a path's modules and labs, each `completed`, `available` or `locked` |
| `GET /paths/:path/labs/:lab` | signed in | a lab's tasks and questions (without answers) |
| `POST /paths/:path/labs/:lab/questions/:id` | signed in | `{ "answer": "..." }`, returns whether it was right and the progress |
| `POST /paths/:path/labs/:lab/machine` | signed in | starts the student's machine for this lab (and stops any other) |
| `GET /machine` | signed in | the student's running machine, or `null` |
| `POST /machine/extend` | signed in | adds 30 minutes, in the machine's last 10 |
| `DELETE /machine` | signed in | stops it |
| `POST /admin/reload` | admin | reads the labs folder again |
| `GET /health` | anyone | `{ "ok": true }` |

## Settings

Environment variables (the preview's `docker-compose.yml` sets them):

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | `postgres://user:password@host:5432/labs` (required) |
| `LABS_SECRET` | at least 32 random characters, from which students' flags are made (required; keep it secret and unchanged) |
| `GZCTF_URL` | where to reach GZCTF (default `http://gzctf:8080`) |
| `PUBLIC_ENTRY` | the address students use to reach machines: the server's domain or IP (default `127.0.0.1`) |
| `CONTENT_DIR` | the labs folder (default `/content`) |
| `MACHINE_NETWORK` | Docker network for machines (default `gzctf-isolated`) |
| `MACHINE_MINUTES`, `EXTEND_MINUTES`, `RENEWAL_WINDOW_MINUTES` | 60, 30 and 10 by default |
| `MACHINE_CPUS`, `MACHINE_PIDS` | 0.5 and 256 by default |

The service needs the Docker socket to start machines, which gives it control of Docker on that machine, like GZCTF.

## Development

```bash
npm ci
npm run check   # type check
npm run build   # compiles to dist/
```

The Docker image (`Dockerfile`) builds and runs it; the preview builds it with `docker compose up -d --build`.
