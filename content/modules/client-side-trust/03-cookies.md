HTTP has no memory: every request stands on its own. To remember who you are between pages, a site gives your browser a **cookie**, a small `name=value` note, in a response header:

```http
HTTP/1.1 200 OK
Set-Cookie: session=8f2c41a9e07b; HttpOnly; Secure
```

From then on, your browser sends it back with every request to that site:

```http
GET /account HTTP/1.1
Host: club.example
Cookie: session=8f2c41a9e07b
```

Cookies are stored **in your browser**, so you can read and change them. Press **F12** and look under *Application → Cookies* (Chrome and Edge) or *Storage → Cookies* (Firefox). Double-click a value to edit it, then reload the page.

This is safe when the cookie holds only a long random **session ID**, with everything that matters (who you are, what you may do) kept on the server. It is broken when the site keeps the important part in the cookie itself, like `role=guest` or `isAdmin=false`, and believes whatever comes back.

**How to defend:** keep user data and permissions on the server, and give the browser only a random session ID. If a cookie must carry data, sign it so the server can tell when it has been changed. Mark session cookies `HttpOnly` (JavaScript cannot read them) and `Secure` (sent only over HTTPS).
