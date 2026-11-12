import pg from 'pg'
import { config } from './config.js'

// Only what students do is stored here. The lessons themselves are files (see content.ts).
const SCHEMA = `
-- one row for everyone who has signed in; accounts themselves belong to the platform
CREATE TABLE IF NOT EXISTS users (
  id             uuid        PRIMARY KEY,
  name           text        NOT NULL,
  -- student or tutor; admins and superadmins are worked out from the platform account
  role           text        NOT NULL DEFAULT 'student',
  -- beginner, intermediate or expert: chosen at registration
  skill_level    text,
  enrolled_path  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);
-- shown on profiles and in the ranking
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin    boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS links    jsonb NOT NULL DEFAULT '{}';
-- the name on certificates, from the platform profile; never shown anywhere else
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name text;

-- questions answered correctly, with the XP each was worth at the time
CREATE TABLE IF NOT EXISTS solves (
  user_id   uuid        NOT NULL,
  module    text        NOT NULL,
  section   text        NOT NULL,
  question  text        NOT NULL,
  xp        integer     NOT NULL,
  solved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module, section, question)
);
-- answered with a flag from a machine
ALTER TABLE solves ADD COLUMN IF NOT EXISTS flag boolean NOT NULL DEFAULT false;

-- sections finished, with their bonus XP
CREATE TABLE IF NOT EXISTS completions (
  user_id      uuid        NOT NULL,
  module       text        NOT NULL,
  section      text        NOT NULL,
  xp           integer     NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module, section)
);

-- everything that earned XP, for totals, weekly sums and the ranking
CREATE OR REPLACE VIEW xp_events AS
  SELECT user_id, xp, solved_at AS at, 'answer'::text AS kind FROM solves
  UNION ALL
  SELECT user_id, xp, completed_at AS at, 'completion'::text AS kind FROM completions;

-- a certificate for every module and skill path a student finishes, kept as it was issued
CREATE TABLE IF NOT EXISTS certificates (
  id        text        PRIMARY KEY,
  user_id   uuid        NOT NULL,
  kind      text        NOT NULL,
  ref       text        NOT NULL,
  title     text        NOT NULL,
  issued_at timestamptz NOT NULL,
  UNIQUE (user_id, kind, ref)
);

-- every answer submitted, right or wrong (the answer itself is not kept)
CREATE TABLE IF NOT EXISTS attempts (
  id       bigserial   PRIMARY KEY,
  user_id  uuid        NOT NULL,
  module   text        NOT NULL,
  section  text        NOT NULL,
  question text        NOT NULL,
  correct  boolean     NOT NULL,
  ip       text,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_by_user ON attempts (user_id, at);

-- at most one running machine per student
CREATE TABLE IF NOT EXISTS machines (
  user_id      uuid        PRIMARY KEY,
  module       text        NOT NULL,
  section      text        NOT NULL,
  container_id text        NOT NULL,
  entry        text        NOT NULL,
  started_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL
);
`

export let db: pg.Pool

// Creates the database on the same PostgreSQL server the first time.
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
  // fails here, with PostgreSQL's own message, if TIMEZONE is not a time zone it knows
  await db.query('SELECT now() AT TIME ZONE $1', [config.timezone])
}
