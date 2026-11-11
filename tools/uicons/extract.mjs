// Copies the icons listed in icons.txt out of Flaticon's Uicons font and writes their
// shapes into the web interface, as src/GZCTF/ClientApp/src/utils/Uicons.ts.
//
//   npm install
//   node extract.mjs
//
// Uicons are free to use with a credit to Flaticon, which the About page gives.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = dirname(fileURLToPath(import.meta.url));
const fonts = join(here, "node_modules/@flaticon/flaticon-uicons/css");
const output = join(here, "../../src/GZCTF/ClientApp/src/utils/Uicons.ts");

// the two styles used: outlined ("regular rounded") and filled ("solid rounded")
const STYLES = {
  regular: {
    css: "regular/rounded.css",
    font: /^uicons-regular-rounded-.*\.woff$/,
    prefix: "fi-rr-",
  },
  solid: {
    css: "solid/rounded.css",
    font: /^uicons-solid-rounded-.*\.woff$/,
    prefix: "fi-sr-",
  },
};

function load(style) {
  const { css, font, prefix } = STYLES[style];
  const file = readdirSync(fonts).find((name) => font.test(name));
  if (!file)
    throw new Error(`the ${style} font is missing: run "npm install" first`);
  const bytes = readFileSync(join(fonts, file));
  const parsed = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );

  // the stylesheet says which character each icon name stands for
  const codes = new Map();
  const rule = new RegExp(
    `\\.${prefix}([a-z0-9-]+):before\\{content:"\\\\([0-9a-f]+)"\\}`,
    "g",
  );
  for (const [, name, code] of readFileSync(join(fonts, css), "utf8").matchAll(
    rule,
  )) {
    codes.set(name, parseInt(code, 16));
  }
  return { font: parsed, codes };
}

const loaded = {};
const icons = new Map();
let size;

for (const line of readFileSync(join(here, "icons.txt"), "utf8").split(
  /\r?\n/,
)) {
  const [name, style = "regular"] = line.replace(/#.*/, "").trim().split(/\s+/);
  if (!name) continue;
  if (!STYLES[style])
    throw new Error(`"${line}": the style must be "solid" or left out`);

  const { font, codes } = (loaded[style] ??= load(style));
  const code = codes.get(name);
  if (code === undefined)
    throw new Error(`there is no ${style} icon called "${name}" in Uicons`);

  // every icon is drawn on a square as wide as the font's em
  size ??= font.unitsPerEm;
  if (font.unitsPerEm !== size)
    throw new Error("the two fonts are drawn at different sizes");
  const shape = font
    .charToGlyph(String.fromCodePoint(code))
    .getPath(0, font.ascender, font.unitsPerEm);
  icons.set(style === "solid" ? `${name}-solid` : name, shape.toPathData(1));
}

const key = (name) => (/^[a-z_$][a-z0-9_$]*$/i.test(name) ? name : `'${name}'`);
// Laid out the way the interface's formatter (prettier) would, so the file needs no
// reformatting: a value goes on its own line unless its name is very short.
const entries = [...icons]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(
    ([name, d]) =>
      `  ${key(name)}:${key(name).length < 5 ? " " : "\n    "}'${d}',`,
  );

writeFileSync(
  output,
  `// Icon shapes from Uicons by Flaticon (https://www.flaticon.com/uicons), used under the
// Flaticon licence. The licence asks for a credit, which the About page gives.
//
// Written by tools/uicons from tools/uicons/icons.txt. To add an icon, add its name
// there and run the tool again, rather than editing this file.

// every icon is drawn on a square this many units wide
export const UICON_SIZE = ${size}

export const uicons = {
${entries.join("\n")}
} as const

export type UiconName = keyof typeof uicons
`,
);

console.log(`wrote ${icons.size} icons to ${output}`);
