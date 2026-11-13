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

const names = (name: string, fallback: string) =>
  (process.env[name] ?? fallback)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

export const config = {
  port: positive('PORT', 8080),
  // postgres://user:password@host:5432/cyberrange; the database is created on first start
  databaseUrl: required('DATABASE_URL'),
  // where the service asks GZCTF who a visitor is
  gzctfUrl: process.env.GZCTF_URL ?? 'http://gzctf:8080',
  // turns into every student's own machine flags; keep it secret and keep it the same
  secret: required('RANGE_SECRET'),
  // platform admins listed here, by user name or user id, are superadmins: they hand out roles
  superadmins: names('SUPERADMINS', 'Admin'),
  // a week (for weekly XP, streaks and the Hall of Fame) starts on Monday in this time zone
  timezone: process.env.TIMEZONE ?? 'Africa/Dar_es_Salaam',
  // the XP to earn in a week to keep a streak going
  weeklyGoal: positive('WEEKLY_GOAL', 100),
  contentDir: process.env.CONTENT_DIR ?? '/content',
  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  // the address students use to reach their machine: the server's domain or IP in production
  publicEntry: process.env.PUBLIC_ENTRY ?? '127.0.0.1',
  machineNetwork: process.env.MACHINE_NETWORK ?? 'gzctf-isolated',
  // the images staff may pick as machines in the web interface; a trailing * matches the rest
  machineImages: (process.env.MACHINE_IMAGES ?? 'club/*')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  machineMinutes: positive('MACHINE_MINUTES', 60),
  extendMinutes: positive('EXTEND_MINUTES', 30),
  renewalWindowMinutes: positive('RENEWAL_WINDOW_MINUTES', 10),
  machineCpus: positive('MACHINE_CPUS', 0.5),
  machinePids: positive('MACHINE_PIDS', 256),

  // The attack box: a Kali Linux container of the student's own, used from the browser.
  boxImage: process.env.BOX_IMAGE ?? 'club/attack-box:latest',
  boxMinutes: positive('BOX_MINUTES', 120),
  // what one box may use: memory in MB, CPU cores, processes, and MB written to its disk
  boxMemory: positive('BOX_MEMORY_MB', 768),
  boxCpus: positive('BOX_CPUS', 1),
  boxPids: positive('BOX_PIDS', 512),
  boxDisk: positive('BOX_DISK_MB', 2048),
  // how many boxes may run at the same time
  boxSeats: positive('BOX_SEATS', 40),
  // every box gets a private network of 16 addresses cut from this range
  boxSubnets: process.env.BOX_SUBNETS ?? '10.213.0.0/16',
  // the Docker volume of approved packages, read-only in every box (see preview/attack-box)
  boxMirror: process.env.BOX_MIRROR ?? 'cyberrange-mirror',
  // a stricter container runtime for boxes, such as runsc (gVisor); empty for Docker's own
  boxRuntime: process.env.BOX_RUNTIME ?? '',
  // the largest file sent into or fetched out of a box, in MB
  boxFile: positive('BOX_FILE_MB', 25),
  // Firefox for the attack box, run on the server and shown in the box's window (see
  // preview/attack-browser); BOX_BROWSER=off turns it off
  browserEnabled: (process.env.BOX_BROWSER ?? 'on').trim().toLowerCase() !== 'off',
  browserImage: process.env.BROWSER_IMAGE ?? 'club/attack-browser:latest',
  // what one browser may use: memory in MB and CPU cores
  browserMemory: positive('BROWSER_MEMORY_MB', 1024),
  browserCpus: positive('BROWSER_CPUS', 1),
  // Burp Suite, which runs next to a student's Firefox once they open its window: the memory in
  // MB and CPU cores it adds to theirs (Java starts in about 35 seconds on one more core)
  burpMemory: positive('BURP_MEMORY_MB', 1024),
  burpCpus: positive('BURP_CPUS', 1),
  // a browser nobody has looked at for this long is stopped, which gives its memory back
  browserIdleMinutes: positive('BROWSER_IDLE_MINUTES', 20),
  // the network the browsers share with their proxy to the web (see preview/docker-compose.yml)
  browserNetwork: process.env.BROWSER_NETWORK ?? 'cyberrange-browsers',
  // where the browser tools (CyberChef) are served; empty when they are not installed
  toolsUrl: (process.env.TOOLS_URL ?? '').replace(/\/+$/, ''),
}

if (config.secret.length < 32) throw new Error('RANGE_SECRET must be at least 32 characters long')
