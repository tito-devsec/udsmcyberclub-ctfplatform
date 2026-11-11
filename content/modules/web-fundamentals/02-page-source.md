The body of a response is **HTML**, and your browser draws it as a page. Not everything in the HTML is drawn, though. A **comment** is ignored by the browser:

```html
<h1>Staff portal</h1>
<!-- TODO: remove the test account before launch -->
```

The visitor never sees that note on the page, but it is still sent to them. Anyone can read the full HTML:

- **View Page Source**: right-click the page and choose *View Page Source*, or press **Ctrl+U**.
- **Developer tools**: press **F12** and open the *Elements* (Chrome) or *Inspector* (Firefox) tab.

Developers sometimes forget notes, test passwords, hidden links or internal addresses in comments. Reading the source is one of the first things a security tester does on any site.

**How to defend:** treat everything you send to the browser as public. Remove comments and test data before a site goes live, and never put secrets in HTML, JavaScript or CSS.

### Your turn

Start your machine with the **Start machine** button below. It runs the club's unfinished staff portal, which looks empty. Open it, read its source, and find the flag.
