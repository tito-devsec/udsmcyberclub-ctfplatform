import pg from 'pg'
import { config } from './config.js'

// Only what students do is stored here. The labs themselves are files (see content.ts).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS solves (
  user_id   uuid        NOT NULL,
  lab       text        NOT NULL,
  question  text        NOT NULL,
  solved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lab, question)
);

-- every answer submitted, right or wrong (the answer itself is not kept)
CREATE TABLE IF NOT EXISTS attempts (
  id       bigserial   PRIMARY KEY,
  user_id  uuid        NOT NULL,
  lab      text        NOT NULL,
  question text        NOT NULL,
  correct  boolean     NOT NULL,
  ip       text,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_by_user ON attempts (user_id, at);

-- at most one running machine per student
CREATE TABLE IF NOT EXISTS machines (
  user_id      uuid        PRIMARY KEY,
  path         text        NOT NULL,
  lab          text        NOT NULL,
  container_id text        NOT NULL,
  entry        text        NOT NULL,
  started_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL
);
`

export let db: pg.Pool

// Creates the labs database on the same PostgreSQL server the first time.
async function ensureDatabase() {
  const url = new URL(config.databaseUrl)
  const name = decodeURIComponent(url.pathname.slice(1))
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('the database name may only contain a-z, 0-9 and _')

  url.pathname = '/postgres'
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (rowCount === 0) {
      try {
        await client.query(`CREATE DATABASE "${name}"`)
      } catch (error) {
        // created by someone else in the meantime
        if ((error as { code?: string }).code !== '42P04') throw error
      }
    }
  } finally {
    await client.end()
  }
}

export async function openDatabase() {
  // PostgreSQL may still be starting
  for (let attempt = 1; ; attempt++) {
    try {
      await ensureDatabase()
      break
    } catch (error) {
      if (attempt >= 30) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  db = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
  await db.query(SCHEMA)
}
