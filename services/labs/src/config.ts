// Settings, all from environment variables (preview/docker-compose.yml sets them).

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function positive(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`)
  return value
}

export const config = {
  port: positive('PORT', 8080),
  // postgres://user:password@host:5432/labs; the database is created on first start
  databaseUrl: required('DATABASE_URL'),
  // where the service asks GZCTF who a visitor is
  gzctfUrl: process.env.GZCTF_URL ?? 'http://gzctf:8080',
  // turns into every student's own machine flags; keep it secret and keep it the same
  secret: required('LABS_SECRET'),
  contentDir: process.env.CONTENT_DIR ?? '/content',
  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  // the address students use to reach their machine: the server's domain or IP in production
  publicEntry: process.env.PUBLIC_ENTRY ?? '127.0.0.1',
  machineNetwork: process.env.MACHINE_NETWORK ?? 'gzctf-isolated',
  machineMinutes: positive('MACHINE_MINUTES', 60),
  extendMinutes: positive('EXTEND_MINUTES', 30),
  renewalWindowMinutes: positive('RENEWAL_WINDOW_MINUTES', 10),
  machineCpus: positive('MACHINE_CPUS', 0.5),
  machinePids: positive('MACHINE_PIDS', 256),
}

if (config.secret.length < 32) throw new Error('LABS_SECRET must be at least 32 characters long')
