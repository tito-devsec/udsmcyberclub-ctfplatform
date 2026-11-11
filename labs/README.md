# Labs

The lessons behind the **Labs** section of the platform. Each learning path is a list of modules, each module a list of labs, and each lab a few tasks: a short lesson followed by questions. Labs open one after another: a student finishes one to unlock the next.

The Labs service ([services/labs](../services/labs)) reads this folder when it starts. After editing, restart it, or sign in as an admin and send `POST /api/labs/admin/reload`.

## Layout

```
labs/
  paths/<path>.yml      a learning path: its modules and their labs, in order
  <lab>/lab.yml         a lab: its machine and its tasks with their questions
  <lab>/<task>.md       the lesson text of one task (Markdown)
```

Folder and file names use lowercase letters, digits and dashes. A lab belongs to one path.

## A path

```yaml
title: Web Security Beginner
summary: One line for the path's card.
description: |
  A few sentences at the top of the path's page.
level: beginner          # shown on the card
order: 10                # paths are listed by this number
sequential: true         # each lab opens when the one before it is complete (default)
modules:
  - title: How the web works
    summary: One line under the module's title.
    labs: [web-requests, hidden-pages]   # lab folder names, in order
```

## A lab

```yaml
title: Recon with robots.txt
summary: One line for the lab's row in the path.
difficulty: easy         # easy, medium or hard
minutes: 20              # roughly how long it takes
machine:                 # optional: the student's own target
  image: club/hidden-pages:latest
  port: 80               # the port the machine serves on
  memory: 64             # MB (default 64)
  flag: udsm{robots_txt_is_public_[USER_HASH]}
tasks:
  - title: How search engines read a site
    file: 1-robots.md
    questions:
      - id: file-name                     # unique within the lab; keep it once students use it
        question: What is the file called?
        answer: [robots.txt, /robots.txt] # every accepted answer
        format: "******.***"              # optional: the shape of the answer
        hint: Look at the end of the lesson.  # optional
  - title: Find the hidden page
    file: 2-find.md
    questions:
      - id: flag
        question: What is the flag on the hidden page?
        flag: true                        # answered with the flag from the student's machine
```

- **Answers** are compared without regard to upper/lower case or extra spaces. Add `caseSensitive: true` when case matters. Students never receive them: the service keeps only their hashes. Remember that this repository is public, so these answers are readable here: knowledge questions only check that the lesson was understood.
- **Machine flags** are where the real proof is. The machine receives its flag in the `GZCTF_FLAG` environment variable, like a platform challenge, so the images in [preview/examples](../preview/examples) work as lab machines unchanged. `[USER_HASH]` is calculated from the server's secret, so every student's flag is different, and a flag is never stored or published.
- **Machines** run like challenge instances: one per student at a time, 60 minutes plus extensions, no traffic between them, no internet, and limited CPU, memory and processes. A machine's image must be built on the server first (`docker build -t club/hidden-pages:latest preview/examples/hidden-pages`).

## Writing a good lab

- Teach one idea. Explain it, show it, then let the student use it.
- Ask questions that the lesson or the machine answers, never trivia from elsewhere.
- End each lesson with how to defend against the problem, not only how to exploit it.
