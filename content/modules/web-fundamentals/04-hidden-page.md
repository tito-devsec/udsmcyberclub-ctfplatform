Start your machine. It runs the club's public website, which claims to have nothing secret.

1. Open the address of your machine in your browser.
2. Add `/robots.txt` to the end of the address and open that.
3. Visit the path the file tells crawlers to stay away from.

You can do the same from a terminal with `curl`, a tool that sends HTTP requests and prints the response:

```bash
curl http://ADDRESS/robots.txt
```

Replace `ADDRESS` with your machine's address, shown below once it is running.
