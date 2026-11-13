import { CSSProperties, FC } from 'react'
import { BoxEntry } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import cyberchef from '../../../assets/attackbox/cyberchef.png'
import help from '../../../assets/attackbox/help.svg'
import home from '../../../assets/attackbox/home.svg'
import pdf from '../../../assets/attackbox/icons/application-pdf.svg'
import archive from '../../../assets/attackbox/icons/application-x-archive.svg'
import executable from '../../../assets/attackbox/icons/application-x-executable.svg'
import sharedlib from '../../../assets/attackbox/icons/application-x-sharedlib.svg'
import shellscript from '../../../assets/attackbox/icons/application-x-shellscript.svg'
import zip from '../../../assets/attackbox/icons/application-zip.svg'
import audio from '../../../assets/attackbox/icons/audio-x-generic.svg'
import computer from '../../../assets/attackbox/icons/computer.svg'
import drive from '../../../assets/attackbox/icons/drive-harddisk-system.svg'
import find from '../../../assets/attackbox/icons/edit-find-symbolic.svg'
import documents from '../../../assets/attackbox/icons/folder-documents.svg'
import download from '../../../assets/attackbox/icons/folder-download.svg'
import music from '../../../assets/attackbox/icons/folder-music.svg'
import pictures from '../../../assets/attackbox/icons/folder-pictures.svg'
import publicshare from '../../../assets/attackbox/icons/folder-publicshare.svg'
import templates from '../../../assets/attackbox/icons/folder-templates.svg'
import videos from '../../../assets/attackbox/icons/folder-videos.svg'
import folder from '../../../assets/attackbox/icons/folder.svg'
import homeSymbolic from '../../../assets/attackbox/icons/go-home-symbolic.svg'
import forward from '../../../assets/attackbox/icons/go-next-symbolic.svg'
import back from '../../../assets/attackbox/icons/go-previous-symbolic.svg'
import up from '../../../assets/attackbox/icons/go-up-symbolic.svg'
import image from '../../../assets/attackbox/icons/image-x-generic.svg'
import add from '../../../assets/attackbox/icons/list-add-symbolic.svg'
import packageIcon from '../../../assets/attackbox/icons/package-x-generic.svg'
import html from '../../../assets/attackbox/icons/text-html.svg'
import text from '../../../assets/attackbox/icons/text-x-generic.svg'
import python from '../../../assets/attackbox/icons/text-x-python.svg'
import unknown from '../../../assets/attackbox/icons/unknown.svg'
import desktop from '../../../assets/attackbox/icons/user-desktop.svg'
import trash from '../../../assets/attackbox/icons/user-trash.svg'
import video from '../../../assets/attackbox/icons/video-x-generic.svg'
import reload from '../../../assets/attackbox/icons/view-refresh-symbolic.svg'
import browser from '../../../assets/attackbox/icons/web-browser.svg'
import close from '../../../assets/attackbox/icons/window-close-symbolic.svg'
import imageViewer from '../../../assets/attackbox/image-viewer.svg'
import science from '../../../assets/attackbox/science.svg'
import terminal from '../../../assets/attackbox/terminal.svg'

// Kali's own icons (its Flat Remix theme), and CyberChef's: see assets/attackbox/README.md.
export const Icons = {
  terminal,
  home,
  help,
  science,
  imageViewer,
  cyberchef,
  browser,
  folder,
  desktop,
  documents,
  download,
  music,
  pictures,
  videos,
  trash,
  drive,
  computer,
  // the grey "symbolic" ones, drawn in the text's colour with <Sym>
  back,
  forward,
  up,
  homeSymbolic,
  find,
  reload,
  add,
  close,
}

// the folders Kali puts in a home folder, each with its own picture
const HOME_FOLDERS: Record<string, string> = {
  Desktop: desktop,
  Documents: documents,
  Downloads: download,
  Music: music,
  Pictures: pictures,
  Videos: videos,
  Templates: templates,
  Public: publicshare,
}

const BY_EXTENSION: Record<string, string> = {
  png: image,
  jpg: image,
  jpeg: image,
  gif: image,
  bmp: image,
  webp: image,
  svg: image,
  ico: image,
  txt: text,
  md: text,
  log: text,
  csv: text,
  json: text,
  xml: text,
  yml: text,
  yaml: text,
  conf: text,
  cfg: text,
  ini: text,
  c: text,
  h: text,
  js: text,
  html: html,
  htm: html,
  php: html,
  pdf: pdf,
  zip: zip,
  jar: zip,
  apk: zip,
  tar: archive,
  gz: archive,
  tgz: archive,
  bz2: archive,
  xz: archive,
  '7z': archive,
  rar: archive,
  deb: packageIcon,
  rpm: packageIcon,
  sh: shellscript,
  bash: shellscript,
  py: python,
  mp3: audio,
  wav: audio,
  ogg: audio,
  flac: audio,
  mp4: video,
  mkv: video,
  avi: video,
  webm: video,
  so: sharedlib,
  exe: executable,
  elf: executable,
  bin: executable,
}

// The picture of a file or folder, as Kali's file manager draws it.
export function entryIcon(entry: BoxEntry, inFolder: string): string {
  if (entry.type === 'folder') return (inFolder === '/root' && HOME_FOLDERS[entry.name]) || folder
  const dot = entry.name.lastIndexOf('.')
  const known = dot > 0 ? BY_EXTENSION[entry.name.slice(dot + 1).toLowerCase()] : undefined
  if (known) return known
  return entry.executable ? executable : entry.type === 'link' ? unknown : dot > 0 ? unknown : text
}

// A grey "symbolic" icon, drawn in the colour of the text around it.
export const Sym: FC<{ src: string; size?: number; style?: CSSProperties }> = ({ src, size = 16, style }) => (
  <span
    className={classes.sym}
    style={{ width: size, height: size, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`, ...style }}
    aria-hidden
  />
)
