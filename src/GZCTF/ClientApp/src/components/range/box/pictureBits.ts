// The picture viewer's arithmetic: ways of showing a picture that bring out what hides in it,
// and reading the bits hidden in its pixels.

export type ViewMode =
  | 'normal'
  | 'stretch'
  | 'random'
  | 'invert'
  | 'gray'
  | 'red'
  | 'green'
  | 'blue'
  | 'alpha'
  | `plane-${'r' | 'g' | 'b' | 'a'}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`

export const CHANNELS = ['r', 'g', 'b', 'a'] as const
export const PLANE_MODES = CHANNELS.flatMap((c) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((bit) => `plane-${c}${bit}` as ViewMode)
)

// a whole number that looks random, the same for the same colour
function scramble(value: number) {
  let x = value ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

// The picture as the mode shows it.
export function render(source: ImageData, mode: ViewMode): ImageData {
  const { width, height, data } = source
  const out = new ImageData(width, height)
  const to = out.data
  const grey = (i: number, value: number) => {
    to[i] = to[i + 1] = to[i + 2] = value
    to[i + 3] = 255
  }

  if (mode === 'stretch') {
    // each colour's darkest and lightest values become black and full colour, so that
    // shades one step apart turn far apart
    const low = [255, 255, 255]
    const high = [0, 0, 0]
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        low[c] = Math.min(low[c]!, data[i + c]!)
        high[c] = Math.max(high[c]!, data[i + c]!)
      }
    }
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const span = high[c]! - low[c]!
        to[i + c] = span ? Math.round(((data[i + c]! - low[c]!) * 255) / span) : 0
      }
      to[i + 3] = 255
    }
    return out
  }

  const plane = /^plane-([rgba])(\d)$/.exec(mode)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const a = data[i + 3]!
    if (plane) {
      grey(i, ((data[i + 'rgba'.indexOf(plane[1]!)]! >> Number(plane[2])) & 1) * 255)
    } else if (mode === 'random') {
      // every distinct colour gets its own random one: shades that look the same come apart
      const colour = scramble((r << 16) | (g << 8) | b)
      to[i] = colour & 255
      to[i + 1] = (colour >> 8) & 255
      to[i + 2] = (colour >> 16) & 255
      to[i + 3] = 255
    } else if (mode === 'invert') {
      to[i] = 255 - r
      to[i + 1] = 255 - g
      to[i + 2] = 255 - b
      to[i + 3] = a
    } else if (mode === 'gray') {
      grey(i, Math.round(0.299 * r + 0.587 * g + 0.114 * b))
    } else if (mode === 'red' || mode === 'green' || mode === 'blue' || mode === 'alpha') {
      grey(i, data[i + ['red', 'green', 'blue', 'alpha'].indexOf(mode)]!)
    } else {
      to[i] = r
      to[i + 1] = g
      to[i + 2] = b
      to[i + 3] = a
    }
  }
  return out
}

export interface ExtractOptions {
  // which colours give a bit each, in this order: 0 red, 1 green, 2 blue, 3 alpha
  channels: number[]
  // which bit of each value, 0 being the lowest
  bit: number
  byColumns: boolean
  // the first bit read is the byte's highest
  msbFirst: boolean
  // stop at the first byte that is zero, as hidden text usually ends
  stopAtZero: boolean
}

// The bytes hidden in the chosen bit of the chosen colours, pixel after pixel.
export function extract(source: ImageData, options: ExtractOptions, most = 256 * 1024): Uint8Array {
  const { width, height, data } = source
  const out = new Uint8Array(Math.min(most, Math.ceil((width * height * options.channels.length) / 8)))
  let count = 0
  let value = 0
  let bits = 0
  const outer = options.byColumns ? width : height
  const inner = options.byColumns ? height : width
  for (let a = 0; a < outer; a++) {
    for (let b = 0; b < inner; b++) {
      const i = ((options.byColumns ? b * width + a : a * width + b) * 4) | 0
      for (const channel of options.channels) {
        const bit = (data[i + channel]! >> options.bit) & 1
        value = options.msbFirst ? (value << 1) | bit : value | (bit << bits)
        if (++bits < 8) continue
        if (options.stopAtZero && value === 0) return out.slice(0, count)
        out[count++] = value
        value = 0
        bits = 0
        if (count >= out.length) return out
      }
    }
  }
  return out.slice(0, count)
}

// Bytes as text, with what cannot be printed shown as dots.
export const asText = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) =>
    byte === 10 || byte === 9 || (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '.'
  ).join('')

// Bytes as a hex dump: offset, sixteen bytes, and the same as text.
export function asHex(bytes: Uint8Array, most = 2048) {
  const lines: string[] = []
  for (let at = 0; at < Math.min(bytes.length, most); at += 16) {
    const row = bytes.subarray(at, at + 16)
    const hex = Array.from(row, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
    const text = Array.from(row, (byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.')).join('')
    lines.push(`${at.toString(16).padStart(6, '0')}  ${hex.padEnd(47)}  ${text}`)
  }
  return lines.join('\n')
}
