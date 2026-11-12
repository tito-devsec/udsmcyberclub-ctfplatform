# CyberRange service

The server side of UDSM CyberRange outside Games:

- **Skill Paths:** paths and their modules, the questions in each section, and students' progress.
- **Labs:** machines and challenges to solve without a lesson, by category.
- **Standing:** XP, levels and ranks, weekly streaks, badges, the ranking with its weekly Hall of Fame, profiles and certificates.
- **Machines:** each student's own practice machine, for a section or a lab.
- **Studio:** modules, labs and skill paths written in the web interface by tutors and admins, and games proposed by tutors for the superadmin to approve.

The pages live in the web interface (`src/GZCTF/ClientApp/src/pages`: `paths`, `modules`, `labs`, `profile`, `ranking`, `certificates`, `members`, `studio`). The lessons and labs that ship with the platform are files in [content/](../../content); the rest is written in the studio.

GZCTF itself is unchanged. This service runs next to it, behind the same proxy, which sends `/api/range/...` here and everything else to GZCTF.

## How it works

- **Sign-in:** there are no accounts here. For each request the service passes the visitor's GZCTF sign-in cookie to GZCTF (`/api/account/profile`) and uses the profile that comes back, cached for a minute. The first time it sees someone, it makes a row for them holding what GZCTF does not: their role, the skill level they chose when registering, and the path they are enrolled in.
- **Lessons:** read from the content folder at start-up (see [content/README.md](../../content/README.md)). Mistakes in a file stop the service with a message naming the file and the problem. Accepted answers are kept only as SHA-256 hashes and are never sent to the browser.
- **Progress:** stored in its own PostgreSQL database (`cyberrange`), created on first start on the same server as the platform's. It holds the questions each student answered and the sections they finished, with the XP each earned, every attempt (right or wrong, without the answer itself), running machines, the certificates issued, what students wrote on their profiles, and what staff made in the studio: documents, lab files, game proposals and certificate signatures.
- **Labs:** a lab is a scenario, an optional machine, optional files to download and a few tasks that end with the flag. It has no lesson and nothing to unlock. Inside the service a lab is a module with one section (`lab:<name>` / `tasks`), so answers, XP and machines work exactly as they do for sections.
- **Unlocking:** inside a module, a section opens when the one before it is finished. Locked sections show only what to finish first, and refuse answers and machines. Modules themselves are always open, in any order.
- **XP:** every question is worth what its author gave it, and finishing a section adds that section's bonus. XP is written down when it is earned, so editing a lesson later does not change what students already have.
- **Machines:** one Docker container per student at a time, started on request, removed after 60 minutes unless extended (+30 minutes, in the last 10). They run on the `gzctf-isolated` network with traffic between containers off, no internet, 64 MB of memory, half a CPU core and 256 processes. The machine gets the student's flag in `GZCTF_FLAG`, so the platform's challenge images work as practice machines.
- **Flags:** `[USER_HASH]` in a machine's flag is an HMAC of the student and the section with `RANGE_SECRET`. Every student's flag is different, and flags are never stored.
- **Ranking:** by XP; of two people with the same XP, whoever got there first is ahead. There are three lists: all time, this week so far, and the **Hall of Fame**, which is the top 50 of the last finished week and stays as it is until the current week ends. A week starts on Monday at midnight in `TIMEZONE`. Each list gives its top three (the podium) and everyone from fourth place on, a page at a time.
- **Streaks:** a streak is a run of weeks in which a student earned at least `WEEKLY_GOAL` XP. The current week counts once its goal is reached.
- **Badges:** eighteen, worked out from what a student did, so nothing has to be handed out: first answer, first flag, first module, first path, first lab, five labs, three labs in web, crypto, forensics or OSINT, labs in four categories, a four-week streak, each rank after the first, and a week finished in the top three.
- **Certificates:** one for every finished module and one for every finished skill path, issued when the last question is answered. A certificate's number is an HMAC of the student and what it is for, and anyone who has the number can check it. It carries the real name from the student's platform profile, or their user name when they gave none.
- **Profiles:** public, like a scoreboard. A student can add a short bio, a country and links (GitHub, LinkedIn, X, a website); those are checked before they are stored. The **verified** tick is given by the superadmin; admins always have it.
- **Studio:** a tutor or an admin writes a module, a lab or a skill path in the browser. The author works on a copy; publishing checks it the way the content folder is checked and makes it what students see, until it is published again. A document's address comes from its first title and never changes, and its sections and questions keep the names they were first saved with, because progress is stored under them. A lab's files are kept in the database (5 files of 8 MB at most). Tutors see their own documents, admins everyone's. Because tutors write it, the web interface never trusts this text as HTML: it renders the Markdown, then removes anything that could run (scripts, event handlers, `javascript:` links) with DOMPurify before showing it.
- **Machine images:** in the studio and in proposed games, a machine can only use an image that is already on the server and matches `MACHINE_IMAGES`. Nothing is pulled from the internet.
- **Game proposals:** a tutor drafts a game with its challenges and submits it. The superadmin approves it or sends it back with a note. Approving creates the game on the platform with the superadmin's own sign-in (the service has no account there), hidden until every challenge is in, and then puts it online; if a step fails, what was created is removed again. Flags must look like `udsm{...}`, and a challenge with a machine gets a flag for every player. The platform shows a game's texts as Markdown with HTML allowed, so a proposal with raw HTML outside code (in backticks) cannot be submitted or approved.
- **Certificate signatures:** two people sign: the club's president and the college's principal. Each is a name, a title and a picture of the signature (PNG, JPEG or WebP, up to 300 KB, checked by its first bytes and kept by its SHA-256). A certificate issued once both have a name and a signature keeps them for good. Older ones show today's signatories until the superadmin signs everything again.
- **Profile pictures:** belong to the platform account. After one is changed there, `POST /me/sync` reads it again at once instead of a minute later.
- **Admins:** the superadmin makes someone a platform admin with `PUT /admin/users/:id/admin`, which changes the role on the platform with the superadmin's sign-in. The proxy also sends the platform's own requests that change or remove an account (`PUT` and `DELETE` under `/api/admin/users/`) through `/gate/...` here first. Any admin may still look after members: edit them, ban and unban them, reset a password, delete them (which also removes what they did here). Only the superadmin gives or takes any other role, or edits, resets or deletes the account of an admin, so that no admin can take over the superadmin's account.
- **Abuse:** answers are rate-limited (10, then one every 6 seconds per student); machine starts too (3, then one a minute). Requests that change something must be JSON, so other websites cannot send them on a student's behalf.

## Levels and ranks

Both come from a student's total XP ([src/xp.ts](src/xp.ts)).

A level takes 100 XP more than the one before it: level 2 starts at 100 XP, level 3 at 300, level 4 at 600, level 5 at 1,000.

| Rank | Starts at |
| --- | --- |
| Script Kiddie | 0 XP |
| Hacker | 500 XP |
| Pro Hacker | 1,500 XP |
| Elite Hacker | 4,000 XP |
| Guru | 8,000 XP |
| Omniscient | 15,000 XP |

## Roles

| Role | Who | Can do |
| --- | --- | --- |
| student | everyone | learn |
| tutor | whoever the superadmin names | also open any section without finishing the ones before it, write and publish modules, labs and skill paths, and propose games |
| admin | a GZCTF admin | the same, on everyone's documents, and reload the content |
| superadmin | a GZCTF admin listed in `SUPERADMINS` | the same, and approve proposed games, set who signs certificates, make tutors and admins, give the verified tick, list everyone, and remove a deleted account's data |

Only the tutor role is kept here; an admin is an admin on the platform. The superadmin gives both roles, and the verified tick, on the **Members** page of the web interface (`/members`), a tab that only they see. Other admins cannot change anyone's role, here or in GZCTF's own admin pages (see Admins above).

## API

All under `/api/range`. Errors are `{ "title": "...", "status": 400 }`.

| Request | Who | Does |
| --- | --- | --- |
| `GET /me` | signed in | role, skill level, enrolled path, XP, level, rank, this week's XP and place in the ranking |
| `PUT /me` | signed in | `{ "skillLevel": "beginner" }` and/or `{ "enrolledPath": "<path>" }` (`null` to leave) |
| `GET /paths` | anyone | every path, with the student's progress |
| `GET /paths/:path` | anyone | a path's modules, and where to carry on |
| `GET /modules` | anyone | every module, with the student's progress |
| `GET /modules/:module` | anyone | a module's chapters and sections, each `completed`, `available` or `locked` |
| `GET /modules/:module/sections/:section` | signed in | a section's text and questions (without answers) |
| `POST /modules/:module/sections/:section/questions/:id` | signed in | `{ "answer": "..." }`; says whether it was right and what it earned |
| `POST /modules/:module/sections/:section/complete` | signed in | finishes a section that has no questions |
| `POST /modules/:module/sections/:section/machine` | signed in | starts the student's machine for this section (and stops any other) |
| `GET /labs` | anyone | every lab, with the student's progress and how many solved it |
| `GET /labs/:lab` | anyone | a lab's scenario, files and tasks (without answers), and who solved it first |
| `POST /labs/:lab/tasks/:id` | signed in | `{ "answer": "..." }`; says whether it was right and what it earned |
| `POST /labs/:lab/machine` | signed in | starts the student's machine for this lab (and stops any other) |
| `GET /labs/:lab/files/:file` | anyone | downloads one of the lab's files |
| `GET /machine` | signed in | the student's running machine, or `null` |
| `POST /machine/extend` | signed in | adds 30 minutes, in the machine's last 10 |
| `DELETE /machine` | signed in | stops it |
| `GET /profiles/:name` | anyone | someone's profile: standing, streak, badges, certificates and what they finished |
| `GET /me/profile` | signed in | the same, for whoever asks |
| `PUT /me/profile` | signed in | `{ "bio": "...", "country": "TZ", "links": { "github": "..." } }`; any of the three |
| `POST /me/sync` | signed in | reads the picture and real name from the platform again, now |
| `GET /ranking` | anyone | `?scope=hall`, `week` or `all`, with `page`, `size` (10 to 100) and `q` to look for a name |
| `GET /certificates/:id` | anyone | a certificate, by its number, with who signed it |
| `GET /signatories` | anyone | who signs certificates today |
| `GET /images/:hash` | anyone | the picture of a signature |
| `GET /studio/images` | staff | the machine images that may be used |
| `GET /studio/documents`, `POST /studio/documents` | staff | their documents; a new one from `{ "kind": "module", "title": "..." }` (or `lab`, `path`) |
| `GET`, `PUT`, `DELETE /studio/documents/:id` | its author, or an admin | read it, save the working copy, delete it once it is offline |
| `POST /studio/documents/:id/publish`, `/unpublish` | its author, or an admin | put it on the site, or take it off |
| `PUT`, `DELETE /studio/documents/:id/files/:name` | its author, or an admin | a lab's file: `{ "data": "<base64>" }` |
| `GET /proposals`, `POST /proposals` | staff | their proposed games (admins also see submitted ones); a new draft |
| `GET`, `PUT`, `DELETE /proposals/:id` | its author | read, change or delete a draft |
| `POST /proposals/:id/submit`, `/withdraw` | its author | send it for review, or take it back |
| `POST /proposals/:id/approve`, `/reject` | superadmin | create the game on the platform, or send it back with `{ "note": "..." }` |
| `POST /admin/reload` | admin | reads the content folder again |
| `GET /admin/users` | superadmin | everyone who has signed in, with their role, XP, rank and verified mark |
| `PUT /admin/users/:id/role` | superadmin | `{ "role": "tutor" }` or `{ "role": "student" }` |
| `PUT /admin/users/:id/verified` | superadmin | `{ "verified": true }` or `false` |
| `PUT /admin/users/:id/admin` | superadmin | `{ "admin": true }` or `false`: a platform admin, or a member again |
| `PUT /admin/signatories` | superadmin | `{ "president": { "name": "...", "title": "..." }, "principal": { ... } }` |
| `PUT`, `DELETE /admin/signatories/:slot/signature` | superadmin | `{ "image": "data:image/png;base64,..." }` for `president` or `principal` |
| `POST /admin/signatories/apply` | superadmin | puts today's signatories on every certificate issued so far |
| `PUT`, `DELETE /gate/api/admin/users/:id`, `DELETE /gate/api/admin/users/:id/password` | admin | the platform's own requests to change, delete or reset a user, passed on unless they touch an admin or a role (see Admins) |
| `DELETE /admin/users/:id` | superadmin | removes everything kept here about someone |
| `GET /health` | anyone | `{ "ok": true }` |

## Settings

Environment variables (the preview's `docker-compose.yml` sets them):

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | `postgres://user:password@host:5432/cyberrange` (required) |
| `RANGE_SECRET` | at least 32 random characters, from which students' flags are made (required; keep it secret and unchanged) |
| `SUPERADMINS` | GZCTF admins who are superadmins, by user name or user id, separated by commas (default `Admin`). Use ids on a real server: a name can be changed, an id cannot |
| `TIMEZONE` | where a week starts on Monday, for weekly XP, streaks and the Hall of Fame (default `Africa/Dar_es_Salaam`) |
| `WEEKLY_GOAL` | the XP a student needs in a week to keep their streak (default `100`) |
| `GZCTF_URL` | where to reach GZCTF (default `http://gzctf:8080`) |
| `PUBLIC_ENTRY` | the address students use to reach machines: the server's domain or IP (default `127.0.0.1`) |
| `CONTENT_DIR` | the content folder (default `/content`) |
| `MACHINE_NETWORK` | Docker network for machines (default `gzctf-isolated`) |
| `MACHINE_IMAGES` | the images staff may choose as machines, separated by commas; a `*` at the end matches the rest (default `club/*`) |
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
