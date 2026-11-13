// The attack boxes' approved package mirror: a Docker volume that every box reads (and cannot
// change) at /opt/mirror. Inside a box, `apt install` and `pip install` find their packages
// there and nowhere else, because a box has no internet. Admins add to it from here, on the
// server, and a new package can be installed in every box at once.
//
//   node mirror.mjs list
//   node mirror.mjs add apt <package...>     a Kali package, with whatever it needs
//   node mirror.mjs add pip <package...>     a Python package, with whatever it needs
//   node mirror.mjs remove apt <package...>
//   node mirror.mjs remove pip <package...>
//
// Packages are fetched by a throwaway copy of the attack box that does have internet, so
// they match the box exactly. Run `docker build -t club/attack-box attack-box` first.
import { spawnSync } from 'node:child_process'

const VOLUME = process.env.BOX_MIRROR ?? 'cyberrange-mirror'
const IMAGE = process.env.BOX_IMAGE ?? 'club/attack-box:latest'
// a package name, with an optional version (name=1.2, name==1.2)
const PACKAGE = /^[A-Za-z0-9][A-Za-z0-9+._-]*([=<>~!]=?[A-Za-z0-9+._:~-]+)?$/

// Runs a shell script in a copy of the box with the mirror writable, and the package names as
// its arguments (never as part of the script).
function inBox(script, args = [], online = false) {
  const result = spawnSync(
    'docker',
    [
      'run', '--rm',
      '-v', `${VOLUME}:/opt/mirror`,
      ...(online ? [] : ['--network', 'none']),
      '--entrypoint', 'bash',
      IMAGE, '-c', `set -e\nmkdir -p /opt/mirror/apt /opt/mirror/pip\n${script}`, 'mirror', ...args,
    ],
    { stdio: 'inherit' }
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Writes the list apt reads, from the packages in the folder.
const INDEX = `
cd /opt/mirror/apt
rm -rf partial lock
if ls *.deb > /dev/null 2>&1; then
  command -v dpkg-scanpackages > /dev/null || { echo 'deb http://http.kali.org/kali kali-rolling main contrib non-free non-free-firmware' > /etc/apt/sources.list; /usr/bin/apt-get update -qq; /usr/bin/apt-get install -y -qq --no-install-recommends dpkg-dev > /dev/null; }
  dpkg-scanpackages --multiversion . /dev/null > Packages 2> /dev/null
else
  : > Packages
fi`

const [command, kind, ...names] = process.argv.slice(2)
const usage = () => {
  console.log('Usage: node mirror.mjs list | add apt|pip <package...> | remove apt|pip <package...>')
  process.exit(1)
}

if (command === 'list') {
  inBox(`
echo "Kali packages (apt install):"
ls /opt/mirror/apt/*.deb 2> /dev/null | xargs -r -n1 basename | sed 's/_.*//' | sort -u | sed 's/^/  /' || true
echo "Python packages (pip install):"
ls /opt/mirror/pip 2> /dev/null | sed 's/-[0-9].*//' | sort -u | sed 's/^/  /' || true`)
} else if ((command === 'add' || command === 'remove') && (kind === 'apt' || kind === 'pip') && names.length) {
  const bad = names.find((name) => !PACKAGE.test(name))
  if (bad) {
    console.error(`"${bad}" is not a package name.`)
    process.exit(1)
  }
  if (command === 'add' && kind === 'apt') {
    // what the box lacks is downloaded first, before anything is installed in this copy
    inBox(
      `echo 'deb http://http.kali.org/kali kali-rolling main contrib non-free non-free-firmware' > /etc/apt/sources.list
/usr/bin/apt-get update -qq
/usr/bin/apt-get install -y --no-install-recommends --download-only -o Dir::Cache::archives=/opt/mirror/apt/ "$@"
${INDEX}
echo "Added. In a box: apt install $*"`,
      names,
      true
    )
  } else if (command === 'add') {
    inBox(
      `PIP_CONFIG_FILE=/dev/null /usr/bin/pip download --no-cache-dir --disable-pip-version-check -d /opt/mirror/pip "$@"
echo "Added. In a box: pip install $*"`,
      names,
      true
    )
  } else if (kind === 'apt') {
    inBox(`for name in "$@"; do rm -f "/opt/mirror/apt/\${name}_"*.deb; done${INDEX}
echo "Removed."`, names, true)
  } else {
    inBox(`cd /opt/mirror/pip
for name in "$@"; do
  file=$(printf '%s' "$name" | tr '-' '_')
  rm -f "\${name}"-[0-9]* "\${file}"-[0-9]*
done
echo "Removed."`, names)
  }
} else {
  usage()
}
