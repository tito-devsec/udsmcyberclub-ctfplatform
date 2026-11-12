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
- **A new machine** goes in `preview/examples/<name>`, with a Dockerfile, and the lab's image is then `club/<name>:latest`. It must serve on the port the lab names, and make whatever holds the flag from `GZCTF_FLAG` when it starts, so the image itself never contains a flag. The folders there are small examples to copy.
- **A category with no labs** is still listed in the catalogue, marked as coming.

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
