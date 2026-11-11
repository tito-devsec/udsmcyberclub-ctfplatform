Every time you open a website, your browser and a web server have a short conversation in **HTTP**. Your browser sends a **request**, and the server sends back a **response**.

A request looks like this:

```http
GET /index.html HTTP/1.1
Host: club.example
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/140.0
Accept: text/html
```

- The first line holds the **method** (`GET`: give me this), the **path** (`/index.html`) and the protocol version.
- The lines after it are **headers**: extra information, one `Name: value` per line.
- Some requests also have a **body**. When you submit a form, the method is usually `POST` and the form's fields travel in the body.

The server answers with a response:

```http
HTTP/1.1 200 OK
Content-Type: text/html

<!doctype html>
<html><body><h1>Welcome to the club</h1></body></html>
```

Its first line has a **status code** that says how it went:

| Code | Meaning |
| --- | --- |
| `200` | OK, here it is |
| `302` | Look somewhere else (a redirect) |
| `403` | Forbidden: you may not see this |
| `404` | Not found: there is no such page |
| `500` | The server had an error |

You can watch these conversations yourself: open the developer tools with **F12**, go to the **Network** tab and reload the page. Every line is one request; click one to see its headers and its response.
