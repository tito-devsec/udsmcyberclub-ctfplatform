Headers are the `Name: value` lines at the top of every request. Your browser adds them for you:

| Header | What it says |
| --- | --- |
| `Host` | which website the request is for |
| `User-Agent` | which browser (or program) is asking |
| `Cookie` | data the site stored in your browser earlier |
| `Referer` | which page the visitor came from |
| `Accept-Language` | which languages the visitor prefers |

Because the visitor's own computer writes the headers, **the visitor can write anything they like** in them. With a browser's developer tools, with an intercepting proxy such as Burp Suite, or with `curl` on the command line:

```bash
# set the User-Agent
curl -A "MyBrowser/1.0" http://ADDRESS/

# set any header
curl -H "Referer: https://club.example/admin" http://ADDRESS/
```

So a header can tell a server what the visitor *says*, but never prove it. A site that lets people in because the `User-Agent` names a special browser, or because the `Referer` says they came from the admin page, can be fooled with one command.

**How to defend:** use headers for convenience only (choosing a language, a page layout). Decide who may see what with something the visitor cannot forge, such as a session from a real login that the server checks.
