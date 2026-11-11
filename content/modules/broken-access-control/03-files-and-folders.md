On Linux, every file has a **path**: the folders you go through to reach it, starting at the top of the file system, `/`.

```text
/                     the top
/etc/passwd           the file "passwd" in the folder "etc"
/app/books/rules.txt  the file "rules.txt" in "books", which is in "app"
```

Two special names work in every folder: `.` means "this folder", and `..` means "**the folder above**". So `/app/books/../config.txt` is really `/app/config.txt`, and every `../` climbs one level up.

Some pages open a file whose name comes from the visitor:

```text
https://club.example/read?book=rules.txt
```

and the server joins that name to its folder: `/app/books/` + `rules.txt`. If the name is used as it is, a visitor can climb out of the folder:

```text
https://club.example/read?book=../../etc/passwd
```

`/app/books/../../etc/passwd` is `/etc/passwd`, the list of the system's user accounts, which is why it is the classic first test. This is **path traversal** (also called *directory traversal*). Depending on the server, it can expose configuration files, passwords and source code.

**How to defend:** do not build file paths from what visitors send. If you must, keep a list of the allowed names, or work out the full path and refuse it unless it still starts with the intended folder. Simply removing `../` from the name is not enough: attackers use other spellings, such as `..%2f` or `....//`.
