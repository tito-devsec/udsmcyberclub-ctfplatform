Most websites keep their data in a **database**, and ask it questions in **SQL**. A login page might check a username and password like this:

```sql
SELECT username FROM users WHERE username = 'alice' AND password = 'sunshine'
```

If a row comes back, the password was right. Text values in SQL go between **single quotes** (`'`), and `--` starts a **comment**: the database ignores everything after it on that line.

Now imagine the page builds that query by pasting in whatever the visitor typed:

```text
"... WHERE username = '" + username + "' AND password = '" + password + "'"
```

A visitor who types `admin' --` as the username, and anything as the password, produces:

```sql
SELECT username FROM users WHERE username = 'admin' --' AND password = 'anything'
```

The quote ends the username early, and `--` turns the password check into a comment. The database returns the admin's row, and the page logs the visitor in as admin. This is **SQL injection**. Depending on the database and the page, it can also read every table, change data, or delete it.

A single quote is the classic first test: if typing `'` into a field causes a database error, the page is probably building its SQL from your input.

**How to defend:** use **parameterized queries** (also called *prepared statements*). The SQL text is fixed, and the values are passed separately, so the database never reads them as SQL:

```python
db.execute("SELECT username FROM users WHERE username = ? AND password = ?", (username, password))
```

Store passwords as slow, salted hashes (bcrypt, scrypt or Argon2), never as plain text, and never show database errors to visitors.
