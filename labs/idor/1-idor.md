Websites keep records (orders, invoices, messages, profiles) and give each one a number or ID. Pages often name the record they want right in the address:

```text
https://club.example/invoice?id=1042
https://club.example/messages/88
```

Every time, the server should ask two questions: *does this record exist?* and *is this visitor allowed to see it?* An **IDOR** (**I**nsecure **D**irect **O**bject **R**eference) is what happens when it forgets the second one. Change `1042` to `1041`, and you are reading someone else's invoice.

IDOR is part of what OWASP (the Open Worldwide Application Security Project) calls **Broken Access Control**, the category at the top of its Top 10 list of web application risks. It is simple, common, and often serious: one changed number can expose another person's private data.

Things to try when you look for IDOR:

- Numbers in the address, in form fields and in API requests.
- The numbers next to yours: one higher, one lower, and small ones such as `1`, which often belong to the first user, usually an admin.
- IDs that look random: they are harder to guess, but still need the permission check.

**How to defend:** on every request, check on the server that the record belongs to (or is shared with) the signed-in user. Random-looking IDs help, but they never replace that check.
