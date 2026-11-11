An HTML form sends one value for every `<input>` that has a `name`:

```html
<form method="post" action="/order">
  <input name="quantity" value="1">
  <input type="hidden" name="item" value="hoodie">
  <button>Order</button>
</form>
```

Clicking *Order* sends a `POST` request whose **body** carries the fields:

```http
POST /order HTTP/1.1
Host: club.example
Content-Type: application/x-www-form-urlencoded

quantity=1&item=hoodie
```

An input with `type="hidden"` is not drawn on the page, but it is sent like any other. Developers use hidden fields to carry values the visitor is not meant to change, such as an item number, a price or a user ID.

Hidden is not the same as protected. The field is in the page's HTML, and the visitor can change it before sending:

- **Developer tools:** right-click the button, choose *Inspect*, find the hidden input and double-click its `value` to edit it. Then click the button.
- **An intercepting proxy** (such as Burp Suite) can change the request after the browser sends it, whatever the page says.

**How to defend:** the server must work out anything that matters itself. Look the price up in the shop's own database, and take the user from the login session, never from a form field.
