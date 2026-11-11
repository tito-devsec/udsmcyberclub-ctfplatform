Start your machine and open it. The members area is for admins only, and the site says you are not one.

1. Open the developer tools (**F12**) and find your machine's cookies, as in the lesson.
2. Look at the cookie the site gave you. What does it say about you?
3. Change its value to what an admin would have, and reload the page.

With `curl`, you can send any cookie you like with `-b`:

```bash
curl -b "name=value" http://ADDRESS/
```
