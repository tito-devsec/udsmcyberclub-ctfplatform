Start your machine and open the club shop. You have **10 coins**. A club sticker costs 5, and the flag costs a lot more.

1. Right-click the flag's **Buy** button and choose *Inspect*.
2. Look at the form around the button: which fields does it send?
3. Change the value that decides what you pay, then click **Buy**.

If editing in the developer tools does not work for you, send the request with `curl`. The `-d` option sends form fields in a POST body:

```bash
curl -d "item=ITEM&price=PRICE" http://ADDRESS/buy
```
