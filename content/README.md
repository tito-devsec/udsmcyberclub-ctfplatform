# Content

The lessons behind **Skill Paths** and the challenges behind **Labs**.

A skill path is a list of modules. A module has chapters, each chapter has sections, and a section is a short text followed by questions. A lab has no lesson: it is a scenario, a machine or some files, and a few tasks that end with the flag. Answering questions and tasks earns XP.

There are two ways to write them. This folder holds the ones that ship with the platform, as files. Tutors and admins can also write modules, labs and skill paths in the web interface, under **Studio**: those are kept in the database, follow the same rules as the files described here, and need no restart.

The CyberRange service ([services/cyberrange](../services/cyberrange)) reads this folder when it starts. After editing, restart it, or sign in as an admin and send `POST /api/range/admin/reload`.

## Layout

```
content/
  paths/<path>.yml              a skill path: its modules, in order
  modules/<module>/module.yml   a module: its chapters, their sections and the questions
  modules/<module>/<file>.md    the text of one section (Markdown)
  labs/<lab>/lab.yml            a lab: its scenario, its machine and its tasks
  labs/<lab>/files/             optional: files students download for the lab
```

Folder and file names use lowercase letters, digits and dashes. A module can be in several paths, or in none: every module is also in the catalogue.

## A path

```yaml
title: Web Security Beginner
summary: One or two lines for the path's card.
description: |
  A few sentences for the path's own page. Markdown works here.
difficulty: easy         # easy, medium or hard; beginners are offered an easy path first
icon: spider-web         # the cover art (see Icons)
order: 10                # paths are listed by this number
modules:                 # module folder names, in order
  - web-fundamentals
  - client-side-trust
```

The path's certificate wears the logo of the category most of its modules belong to. When two categories are level, it shows the path's icon instead, as does a module of the general category.

## A module

```yaml
title: Web Fundamentals
summary: One line for the module's card.
description: |
  What the module covers and what students will be able to do. Shown under "Module details".
category: web            # general, web, crypto, forensics, osint, reverse, pwn, stego, misc,
                         # hardware, ics, ai or web3
difficulty: easy
minutes: 35              # roughly how long the whole module takes
icon: globe              # optional: without it, the category's icon is used
updated: "2026-11-12"    # optional, in quotes
order: 10                # position in the catalogue
sequential: true         # each section opens when the one before it is finished (default)
chapters:
  - title: How the Web Works
    sections:
      - title: Requests and responses
        file: 01-requests-and-responses.md
        xp: 10                             # bonus for finishing the section (default 10)
        questions:
          - id: method                     # unique within the section; keep it once students use it
            question: Which HTTP method does a browser use to load a page?
            answer: GET                    # or a list: [robots.txt, /robots.txt]
            format: "***"                  # optional: the shape of the answer
            hint: Look at the first line of the request.   # optional
            xp: 10                         # what a right answer earns (default 10)
      - title: What the browser does not show
        file: 02-page-source.md
        machine:                           # optional: the student's own target
          image: club/staff-portal:latest
          port: 80                         # the port the machine serves on
          memory: 64                       # MB (default 64)
          flag: udsm{always_check_the_source_[USER_HASH]}
        questions:
          - id: flag
            question: What is the flag hidden in the page source?
            flag: true                     # answered with the flag from the student's machine
            xp: 40                         # default 40 for a flag
```

- **Sections** are named after their file: `03-robots-txt.md` is the section `robots-txt`, at `/modules/<module>/robots-txt`. The number in front only orders the files in the folder; the order students see is the order in `module.yml`. Do not rename a file once students have progress in it.
- **A section without questions** is finished with a "Mark as complete" button.
- **Answers** are compared without regard to upper/lower case or extra spaces. Add `caseSensitive: true` when case matters. Students never receive them: the service keeps only their hashes. Remember that this repository is public, so these answers are readable here: knowledge questions only check that the text was understood.
- **Machine flags** are where the real proof is. The machine receives its flag in the `GZCTF_FLAG` environment variable, like a platform challenge, so the images in [preview/examples](../preview/examples) work as practice machines unchanged. `[USER_HASH]` is calculated from the server's secret, so every student's flag is different, and a flag is never stored or published.
- **Machines** run like challenge instances: one per student at a time, 60 minutes plus extensions, no traffic between them, no internet, and limited CPU, memory and processes. A machine's image must be built on the server first: `node preview/build-lab-images.mjs` builds every image the labs need that is missing, from the folder in `preview/examples` with the same name (or one at a time: `docker build -t club/hidden-pages:latest preview/examples/hidden-pages`).

## A lab

```yaml
title: Staff Portal
summary: One or two lines for the lab's card.
scenario: |
  What the student is told before they start. Markdown works here.
  Say what there is to attack, never how.
category: web            # the same list as for modules; labs are grouped by it
difficulty: easy
minutes: 15
icon: code-simple        # optional: without it, the category's icon is used
updated: "2026-11-12"    # optional, in quotes
order: 10                # position in the catalogue
bonus: 0                 # optional: extra XP for solving the whole lab (default 0)
creator: alice           # optional: the username of whoever made it, shown on its page
machine:                 # optional: leave it out for a challenge solved from files or research
  image: club/staff-portal:latest
  port: 80
  flag: udsm{always_check_the_source_[USER_HASH]}
tasks:                   # written like a section's questions
  - id: hiding-place
    question: What kind of HTML element keeps the developers' note off the page?
    answer: [comment, html comment]
    format: "*******"
    xp: 10
  - id: flag
    question: What is the flag?
    flag: true           # needs a machine
    xp: 40
```

- **The address** of a lab is its folder name: `labs/staff-portal` is at `/labs/staff-portal`. Do not rename the folder once students have solved it.
- **With a machine** the catalogue calls it a Machine, without one a Challenge. A flag task needs a machine: its flag is the student's own, made the same way as in a section.
- **Files** in the lab's `files/` folder are offered for download on its page. Their names use letters, digits, dots, dashes and `_`. Anyone can download them, signed in or not, so never put an answer in a file's name.
- **Tasks** can be answered in any order. The lab is solved when they all are, and it then counts towards the student's badges.
- **Any tool may be needed.** Students have the attack box in their browser (Kali with the common tools, CyberChef and a picture viewer, reaching their machine as `target`), but a lab is not limited to it: say in the scenario what else it needs, and students use their own Linux machine for it.
- **A new machine** goes in `preview/examples/<name>`, with a Dockerfile, and the lab's image is then `club/<name>:latest`. It must serve on the port the lab names, and make whatever holds the flag from `GZCTF_FLAG` when it starts, so the image itself never contains a flag. The folders there are small examples to copy.
- **A category with no labs** is still listed in the catalogue, marked as coming.
- **The creator** is shown on the lab's page, with a Respect Creator button for students, and on their profile. A lab without one is shown as the club's own. In the web interface the creator is required, and must be someone who has signed in here once.
- **When it went online** is shown on its page too: the service notes it the first time it loads the lab.

## A boot-to-root lab

A boot-to-root (B2R) lab is a machine to take over: students get in as an ordinary user and take the user flag, then make themselves root and take the root flag. They work from their attack box, where the machine answers as `target` on every port it serves. The lab's page shows who took each flag first, its User Blood and System Blood, with how long after the lab went online. Staff, who can look inside any machine, and the lab's creator do not count for bloods.

```yaml
title: Club Intranet
summary: One or two lines for the lab's card.
scenario: |
  What the student is told: what the machine is, never how to get in.
type: b2r
os: linux                # linux (windows needs virtual machines, which the platform cannot run yet)
creator: alice
category: web            # still gives the lab its colour and counts towards that category's badges
difficulty: easy
minutes: 60
machine:
  image: club/intranet:latest
  port: 80               # the port its link opens; every port it serves is open to the attack box
  memory: 256
  userFlag: udsm{user_words_[USER_HASH]}
  rootFlag: udsm{root_words_[USER_HASH]}
tasks:
  - id: user
    question: What is the user flag?
    flag: user
    xp: 40
  - id: root
    question: What is the root flag?
    flag: root
    xp: 60
```

- **Both flags are each student's own**, like any machine flag. The machine gets them in `USER_FLAG` and `ROOT_FLAG` when it starts. Every process inherits its parent's variables, so the entrypoint, which runs as root, writes the flags where they belong and removes the variables before it starts anything else:

  ```sh
  #!/bin/sh
  echo "$USER_FLAG" > /home/alice/user.txt
  chown root:alice /home/alice/user.txt && chmod 640 /home/alice/user.txt
  echo "$ROOT_FLAG" > /root/root.txt && chmod 600 /root/root.txt
  unset USER_FLAG ROOT_FLAG
  exec /usr/sbin/sshd -D    # or whatever starts the machine's services
  ```

- **Becoming root must be possible.** A machine with a `rootFlag` runs without Docker's `no-new-privileges`, so `sudo`, `su` and setuid programs work in it, and keeps Docker's usual capabilities except `MKNOD` and `SETFCAP`. Root inside is still only the root of a container. Every other machine keeps `no-new-privileges`.
- **Tasks before the flags** may guide the way in, like any lab's tasks. Exactly one task is answered with `flag: user`, and exactly one with `flag: root`.
- **Boot to Root** has its own place in the Labs catalogue, next to the categories, and the lab's card and page show its system.
- **Windows machines**, and Active Directory networks of several machines, need virtual machines rather than containers. The platform does not run those yet, so a lab with `os: windows` cannot be published from the web interface.

## XP

The author decides what everything is worth. As a guide, this is what the first path uses:

| What | XP |
| --- | --- |
| a question answered from the text | 10 |
| a question that needs the machine | 20 |
| a flag, easy | 40 |
| a flag, medium | 60 |
| finishing a section | 10 |
| a lab's task answered by looking or researching | 10 to 30 |
| a lab's flag | 40 to 60 |

XP adds up to levels and ranks, which are described in the [service's README](../services/cyberrange/README.md#levels-and-ranks).

## Icons

`icon` names an icon from [Uicons by Flaticon](https://www.flaticon.com/uicons). The web interface carries only the ones listed in [tools/uicons/icons.txt](../tools/uicons/icons.txt). To use another, add its name to that list and run the tool there, then rebuild the interface. An unknown name falls back to the category's icon.

## Writing a good section

- Teach one idea. Explain it, show it, then let the student use it.
- Ask questions that the text or the machine answers, never trivia from elsewhere.
- End with how to defend against the problem, not only how to exploit it.
