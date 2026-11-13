# UDSM CyberRange

The learning and capture-the-flag platform of the UDSM Cyber Club. Members learn on Skill Paths, where short lessons end on a machine of their own, practise in Labs, earn XP towards ranks, badges and certificates, and play Jeopardy-style games on their own or in teams.

It is built on [GZCTF](https://github.com/GZTimeWalker/GZCTF) v1.9.1, an open-source CTF platform by GZTimeWalker. GZCTF's backend is unchanged: the changes are in the web interface under `src/GZCTF/ClientApp`, plus a separate CyberRange service in [services/cyberrange](services/cyberrange).

## Changes from GZCTF

- **Individual and team games.** The game settings page has a Game Type field. An individual game needs no team: a player clicks Join and gets a one-person team named after them. A team game must have its team size set (at least 2 members).
- **English by default.** The interface opens in English for every visitor, whatever their browser language. Other languages are still available from the language menu.
- **UDSM branding.** The platform is called UDSM CyberRange, and the default colour is UDSM blue (`#0864af`). Games, with their teams and the admin pages, keep the CTF platform's own name (UDSM-CTFPLATFORM, "UD::CTF" in the footer).
- **Source link.** The About page links to this repository, as the AGPL requires for a modified version. The rest of that page describes GZCTF itself, with its license links, and should stay.
- **Skill Paths.** A learning section in the side menu. A skill path is a set of modules; a module has chapters of short sections, each followed by questions, and half of them come with a machine of the student's own. Right answers earn XP, which adds up to levels and ranks, from Script Kiddie to Omniscient. The lessons are files in [content/](content); the [CyberRange service](services/cyberrange) serves them, checks answers, keeps progress and XP, and runs the machines. The first path is Web Security Beginner.
- **Skill level.** People choose beginner, intermediate or expert when they register, and are offered a path that suits it.
- **Labs.** Machines and challenges to solve without a lesson, grouped by category (web, crypto, forensics, OSINT, reverse engineering, pwn, steganography, misc, hardware, ICS, AI and Web3). A lab has a scenario, a machine of the student's own or files to download, and tasks that end with the flag. There are 36, at least two in every category.
- **Attack Box.** A Kali Linux machine of the student's own, used in the browser as a desktop like Kali's, in the club's colours: a terminal like Kali's (`udsmcyberrange@<player>`, with its menus, tabs and keys), a file manager like Kali's to move files in and out, Firefox for searching and reading up (it runs on the server next to the box, and reaches only websites, through a filtering proxy), CyberChef, and a picture viewer for hidden data. The student's lab machine answers in it as `target`. The box itself has no internet and reaches nothing else; its `apt` and `pip` install only the packages the club's admins approved.
- **Profiles, badges and certificates.** Everyone has a public profile with their picture, score, rank, level, weekly streak, badges, and the modules, paths and labs they finished. Every finished module and skill path earns a certificate with the UDSM and club logos, the logo of its category on its seal, the signatures of the club's president and the college's principal, and a certificate ID that anyone can check. It prints on one landscape page. When a game is over, the superadmin gives everyone who took part a certificate of participation. The superadmin can preview every kind of certificate before anyone receives one.
- **Ranking.** The top three stand on a podium and everyone else follows in a list. The Hall of Fame is the top 50 of last week and changes when a week ends; there are also lists for this week so far and for all time.
- **Studio.** Tutors and admins write modules, labs and skill paths in the browser and publish them themselves. A tutor can also propose a game with its challenges; it goes online only when the superadmin approves it, and can be sent back with a note.
- **Roles.** The superadmin names tutors and admins and gives the verified tick on a Members page that only they see. Other admins can still look after members (edit, ban, reset a password, delete), but cannot give roles or touch an admin's account, not even in GZCTF's own admin pages: the proxy passes those requests through the CyberRange service first.
- **Home page.** The site opens on the Skill Paths dashboard. Games, posts and teams are one click away in the side menu.

## Running it

[preview/](preview) runs the platform locally with Docker: the official `gztime/gzctf:v1.9.1` image, PostgreSQL, the CyberRange service, Caddy in front, and the web interface built from this repository. See [preview/README.md](preview/README.md).

A server works the same way: run the official v1.9.1 image with the built interface (`src/GZCTF/ClientApp/build`) mounted at `/app/wwwroot`, the CyberRange service next to it, and a proxy that sends `/api/range` to the CyberRange service and everything else to GZCTF. Copy the rule for `PUT` and `DELETE` on `/api/admin/users/*` from [preview/Caddyfile](preview/Caddyfile) too: without it, any admin can change roles or reset the superadmin's password.

## Branding

The name, slogan, colour and logo are stored in the database, so set them once under Admin → Settings on each new installation:

| Setting | Value |
| --- | --- |
| Platform name | `UDSM-CTFPLATFORM` |
| Slogan | `Build Cybersafe Society` |
| Description | `UD::CTF` |
| Theme colour | `#0864af` |
| Logo | the club logo (it is also used as the favicon) |

The club's own artwork is part of the interface: the logo of each category, worn on the seal of certificates, is in `src/GZCTF/ClientApp/src/assets/categories`, and the medal of each badge on profiles is in `src/GZCTF/ClientApp/src/assets/badges`. To change one, replace its SVG with a new one of the same name and rebuild the interface.

The CyberRange pages are drawn in a flat style (Flat Design 2.0): flat colours and simple shapes, with soft shadows only under cards and other things that can be pressed. Each category has its own flat colour, the same as on its logo, set in `CategoryColour` in `src/GZCTF/ClientApp/src/utils/Range.ts`. The Games pages keep GZCTF's own look.

## License

The core code is licensed under the [GNU AGPL v3](LICENSE.txt). Anyone running a modified version for others must offer them its source code.

These files are restricted components of GZCTF under [LicenseRef-GZCTF-Restricted](license/LicenseRef-GZCTF-Restricted.txt). They are included unmodified and must not be changed:

- `src/GZCTF/Services/Container/Manager/*`
- `src/GZCTF/ClientApp/src/hooks/useConfig.ts`
- `src/GZCTF/ClientApp/src/components/Copyright.tsx`

See [NOTICE](NOTICE), [LICENSE_ADDENDUM.txt](LICENSE_ADDENDUM.txt) and [TRADEMARKS.md](TRADEMARKS.md).

The icons on the Skill Paths, Labs, profile and ranking pages are [Uicons by Flaticon](https://www.flaticon.com/uicons). They are used under the Flaticon licence, which asks for the credit shown on those pages and on the About page, and are not covered by the AGPL. [tools/uicons](tools/uicons) copies the ones in use out of Flaticon's package.

The University of Dar es Salaam's logo on certificates (`src/GZCTF/ClientApp/src/assets/udsm-logo.webp`) belongs to the university and is not covered by the AGPL either. Use it, and the principal's signature, with the college's consent.

This service is based on the open core of GZCTF (AGPLv3). GZCTF is a trademark of its respective owner. No endorsement is implied.
