Search engines like Google use programs called **crawlers** that visit websites and follow every link they find. A site can ask crawlers to skip some of its pages, with a plain text file at the top of the site: **`/robots.txt`**.

```text
User-agent: *
Disallow: /admin/
Disallow: /backups/
```

- `User-agent: *` means "these rules are for every crawler".
- Each `Disallow:` line names a path that crawlers should not visit.

This file is a **polite request**, not a lock. Well-behaved crawlers follow it, but anyone can open `/robots.txt` in a browser and read it. To an attacker, it is a list of the places the site's owner considers private: exactly where they want to look first.

Reading `robots.txt` is part of **reconnaissance** ("recon"): learning as much as possible about a target before attacking it. Other files worth checking on a website include `/sitemap.xml` (a list of the site's pages) and `/.well-known/security.txt` (who to contact about security problems).

**How to defend:** never rely on `robots.txt` to hide anything. Protect private pages with a real login and permission checks, and do not mention them in public files at all.
