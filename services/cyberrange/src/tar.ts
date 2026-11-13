// One file as a tar archive, and the first file out of one: what Docker takes and gives when a
// file is copied into or out of a container.

const octal = (value: number, width: number) => value.toString(8).padStart(width - 1, '0') + '\0'

// `name` may be up to 100 bytes long.
export function tarOf(name: string, data: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  header.write(octal(0o644, 8), 100, 'ascii')
  header.write(octal(0, 8), 108, 'ascii')
  header.write(octal(0, 8), 116, 'ascii')
  header.write(octal(data.length, 12), 124, 'ascii')
  header.write(octal(Math.floor(Date.now() / 1000), 12), 136, 'ascii')
  header.fill(' ', 148, 156)
  header.write('0', 156, 'ascii')
  header.write('ustar\0' + '00', 257, 'ascii')
  let sum = 0
  for (const byte of header) sum += byte
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512), Buffer.alloc(1024)])
}

// The contents of the archive's first entry when that is a file; null for a folder or a link.
export function firstFile(tar: Buffer): Buffer | null {
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512)
    if (header.every((byte) => byte === 0)) return null
    const size = parseInt(header.toString('ascii', 124, 136).replace(/[\0 ]+$/, '') || '0', 8)
    const kind = String.fromCharCode(header[156]!)
    if (kind === '0' || kind === '\0') return tar.subarray(at + 512, at + 512 + size)
    // notes about the next entry (a long name, extra fields): skip them
    if (kind !== 'x' && kind !== 'g' && kind !== 'L') return null
    at += 512 + Math.ceil(size / 512) * 512
  }
  return null
}
