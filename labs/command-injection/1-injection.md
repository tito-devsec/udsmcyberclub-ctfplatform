Some web pages run programs on the server for you: a network check that runs `ping`, a converter that runs an image tool, a lookup that runs `nslookup`. A quick way to build one is to paste the visitor's input into a command and hand it to the **shell**, the program that runs commands on Linux:

```text
ping -c 1 <what the visitor typed>
```

With `127.0.0.1` that is a normal ping. But the shell gives some characters a special meaning:

| You type | The shell runs |
| --- | --- |
| `127.0.0.1; whoami` | `ping`, then `whoami` |
| `127.0.0.1 && whoami` | `whoami` if `ping` worked |
| `127.0.0.1 \| whoami` | `whoami`, fed the output of `ping` |

So a visitor who types `127.0.0.1; whoami` gets the ping **and** the name of the user the server runs as. This is **command injection**: any command, with the server's permissions. Reading files, creating accounts, installing malware: everything that user can do, the attacker can do too.

Useful commands for exploring a Linux machine:

| Command | Shows |
| --- | --- |
| `whoami` | the current user |
| `id` | the user and their groups |
| `ls /` | the files at the top of the file system |
| `cat FILE` | the contents of a file |

**How to defend:** do not pass input to a shell at all. Most languages can start a program with its arguments as a list (for example `subprocess.run(["ping", "-c", "1", address])` in Python), so nothing the user types is read as shell syntax. Also check the input first: a ping tool should accept an IP address and nothing else. And run the web server as a user with as few permissions as possible.
