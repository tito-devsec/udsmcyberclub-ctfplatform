# UDSM CyberRange

The learning and capture-the-flag platform of the UDSM Cyber Club. Members learn on Skill Paths, where short lessons end on a machine of their own and earn XP, and play Jeopardy-style games on their own or in teams.

It is built on [GZCTF](https://github.com/GZTimeWalker/GZCTF) v1.9.1, an open-source CTF platform by GZTimeWalker. GZCTF's backend is unchanged: the changes are in the web interface under `src/GZCTF/ClientApp`, plus a separate CyberRange service in [services/cyberrange](services/cyberrange).

## Changes from GZCTF

- **Individual and team games.** The game settings page has a Game Type field. An individual game needs no team: a player clicks Join and gets a one-person team named after them. A team game must have its team size set (at least 2 members).
- **English by default.** The interface opens in English for every visitor, whatever their browser language. Other languages are still available from the language menu.
- **UDSM branding.** The platform is called UDSM CyberRange, and the default colour is UDSM blue (`#0864af`). Games, with their teams and the admin pages, keep the CTF platform's own name (UDSM-CTFPLATFORM, "UD::CTF" in the footer).
- **Source link.** The About page links to this repository, as the AGPL requires for a modified version. The rest of that page describes GZCTF itself, with its license links, and should stay.
- **Skill Paths.** A learning section in the side menu. A skill path is a set of modules; a module has chapters of short sections, each followed by questions, and half of them come with a machine of the student's own. Right answers earn XP, which adds up to levels and ranks, from Script Kiddie to Omniscient. The lessons are files in [content/](content); the [CyberRange service](services/cyberrange) serves them, checks answers, keeps progress and XP, and runs the machines. The first path is Web Security Beginner.
- **Skill level.** People choose beginner, intermediate or expert when they register, and are offered a path that suits it.

## Running it

[preview/](preview) runs the platform locally with Docker: the official `gztime/gzctf:v1.9.1` image, PostgreSQL, the CyberRange service, Caddy in front, and the web interface built from this repository. See [preview/README.md](preview/README.md).

A server works the same way: run the official v1.9.1 image with the built interface (`src/GZCTF/ClientApp/build`) mounted at `/app/wwwroot`, the CyberRange service next to it, and a proxy that sends `/api/range` to the CyberRange service and everything else to GZCTF.

## Branding

The name, slogan, colour and logo are stored in the database, so set them once under Admin → Settings on each new installation:

| Setting | Value |
| --- | --- |
| Platform name | `UDSM-CTFPLATFORM` |
| Slogan | `Build Cybersafe Society` |
| Description | `UD::CTF` |
| Theme colour | `#0864af` |
| Logo | the club logo (it is also used as the favicon) |

## License

The core code is licensed under the [GNU AGPL v3](LICENSE.txt). Anyone running a modified version for others must offer them its source code.

These files are restricted components of GZCTF under [LicenseRef-GZCTF-Restricted](license/LicenseRef-GZCTF-Restricted.txt). They are included unmodified and must not be changed:

- `src/GZCTF/Services/Container/Manager/*`
- `src/GZCTF/ClientApp/src/hooks/useConfig.ts`
- `src/GZCTF/ClientApp/src/components/Copyright.tsx`

See [NOTICE](NOTICE), [LICENSE_ADDENDUM.txt](LICENSE_ADDENDUM.txt) and [TRADEMARKS.md](TRADEMARKS.md).

The icons on the Skill Paths pages are [Uicons by Flaticon](https://www.flaticon.com/uicons). They are used under the Flaticon licence, which asks for the credit shown on those pages and on the About page, and are not covered by the AGPL. [tools/uicons](tools/uicons) copies the ones in use out of Flaticon's package.

This service is based on the open core of GZCTF (AGPLv3). GZCTF is a trademark of its respective owner. No endorsement is implied.
