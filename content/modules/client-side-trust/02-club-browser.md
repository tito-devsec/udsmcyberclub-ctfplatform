Start your machine and open it in your browser. The page refuses to open for you, and tells you which browser it wants, and which browser it thinks you are using.

There is no such browser to download. Instead, send a request that **says** it comes from that browser. Use `curl` with the `-A` option from the lesson:

```bash
curl -A "BROWSER-NAME" http://ADDRESS/
```

Replace `BROWSER-NAME` with the name the page asks for, and `ADDRESS` with your machine's address.

On Windows, `curl` is built in: open *Command Prompt* or *PowerShell* and type `curl.exe` (with `.exe`, so PowerShell does not use its own command of the same name).
