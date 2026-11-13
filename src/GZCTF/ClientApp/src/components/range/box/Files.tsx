import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BOX_HOME, BoxEntry, BoxFolder, boxApi, boxFileUrl, isPicture, joinPath, readAsBase64 } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import { ContextMenu, Menu, MenuBar, MenuItem, NamePrompt } from './MenuBar'
import { entryIcon, Icons, Sym } from './icons'

// Kali's own places, as its file manager lists them on the left
const PLACES = [
  { key: 'computer', path: '/', icon: Icons.computer },
  { key: 'home', path: BOX_HOME, icon: Icons.home },
  { key: 'Desktop', path: `${BOX_HOME}/Desktop`, icon: Icons.desktop },
  { key: 'Documents', path: `${BOX_HOME}/Documents`, icon: Icons.documents },
  { key: 'Music', path: `${BOX_HOME}/Music`, icon: Icons.music },
  { key: 'Pictures', path: `${BOX_HOME}/Pictures`, icon: Icons.pictures },
  { key: 'Videos', path: `${BOX_HOME}/Videos`, icon: Icons.videos },
  { key: 'Downloads', path: `${BOX_HOME}/Downloads`, icon: Icons.download },
]

// 3861707 -> "3.7 MiB", as the file manager counts
export function binarySize(bytes: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`
}

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

const download = (path: string) => {
  const link = document.createElement('a')
  link.href = boxFileUrl(path)
  link.download = nameOf(path)
  link.click()
}

interface BoxFilesProps {
  running: boolean
  // the largest file that may go in or out, in MB
  limit: number
  // the folder it opens in
  start?: string
  onOpenPicture: (path: string) => void
  onTitle: (title: string) => void
  onClose: () => void
}

// The box's files, in a window made like Kali's file manager (Thunar): places on the left, the
// folder's contents as icons, back, forward, up and home, a location bar and a filter, menus,
// a right-click menu, and files dropped on it sent into the folder that is open.
export const BoxFiles: FC<BoxFilesProps> = ({ running, limit, start = BOX_HOME, onOpenPicture, onTitle, onClose }) => {
  const { t } = useTranslation()
  const [path, setPath] = useState(start)
  const [history, setHistory] = useState<{ back: string[]; forward: string[] }>({ back: [], forward: [] })
  const [folder, setFolder] = useState<BoxFolder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [showHidden, setShowHidden] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [prompt, setPrompt] = useState<{ kind: 'rename' | 'folder'; entry?: BoxEntry } | null>(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number; entry: BoxEntry | null } | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) return
    let gone = false
    boxApi
      .folder(path)
      .then((found) => {
        if (gone) return
        setFolder(found)
        setError(null)
      })
      .catch((failure) => !gone && setError(failure instanceof Error ? failure.message : String(failure)))
    return () => {
      gone = true
    }
  }, [running, path, nonce])

  useEffect(() => {
    onTitle(
      `${path === BOX_HOME ? 'root' : nameOf(path) || t('range.box.files.file_system')} - ${t('range.box.app.files')}`
    )
  }, [path, onTitle, t])

  const shown = (folder && folder.path === path ? folder.entries : [])
    .filter((entry) => showHidden || !entry.name.startsWith('.'))
    .filter((entry) => !filter || entry.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) =>
      a.type === 'folder' && b.type !== 'folder'
        ? -1
        : b.type === 'folder' && a.type !== 'folder'
          ? 1
          : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  const chosen = shown.filter((entry) => selected.includes(entry.name))
  const one = chosen.length === 1 ? chosen[0]! : null

  const go = (to: string) => {
    if (to === path) return
    setHistory((h) => ({ back: [...h.back, path], forward: [] }))
    setPath(to)
    setSelected([])
    setFilter('')
  }
  const back = () => {
    const to = history.back.at(-1)
    if (!to) return
    setHistory((h) => ({ back: h.back.slice(0, -1), forward: [path, ...h.forward] }))
    setPath(to)
    setSelected([])
  }
  const forward = () => {
    const to = history.forward[0]
    if (!to) return
    setHistory((h) => ({ back: [...h.back, path], forward: h.forward.slice(1) }))
    setPath(to)
    setSelected([])
  }
  const up = () => folder?.parent && go(folder.parent)

  const run = async (label: string, work: () => Promise<BoxFolder>) => {
    setBusy(label)
    try {
      const found = await work()
      if (found.path === path) setFolder(found)
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(null)
    }
  }

  const open = (entry: BoxEntry) => {
    const full = joinPath(path, entry.name)
    if (entry.type !== 'file') return go(full)
    if (isPicture(entry.name)) return onOpenPicture(full)
    download(full)
  }
  const remove = (entries: BoxEntry[]) => {
    if (!entries.length) return
    const names = entries.map((entry) => entry.name).join(', ')
    if (!window.confirm(t('range.box.files.delete_confirm', { names }))) return
    void run(names, async () => {
      let last: BoxFolder | null = null
      for (const entry of entries) last = await boxApi.remove(joinPath(path, entry.name))
      setSelected([])
      return last!
    })
  }
  const send = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      if (file.size > limit * 1024 * 1024) {
        setError(t('range.box.files.too_large', { name: file.name, limit }))
        continue
      }
      // names the box accepts: letters, digits, spaces, dots, dashes, brackets and _
      const name =
        file.name
          .replace(/[^A-Za-z0-9._ ()+,-]/g, '_')
          .replace(/^[^A-Za-z0-9]+/, '')
          .slice(0, 100) || 'upload'
      await run(name, async () => boxApi.upload(path, name, await readAsBase64(file)))
    }
  }

  // Thunar's keys, while the folder has the keyboard
  const keyAction = (event: KeyboardEvent<HTMLDivElement>): (() => void) | null => {
    const { key, ctrlKey: ctrl, altKey: alt, shiftKey: shift } = event
    const letter = key.toLowerCase()
    if (key === 'Delete') return () => remove(chosen)
    if (key === 'F2' && one) return () => setPrompt({ kind: 'rename', entry: one })
    if (key === 'Enter' && one) return () => open(one)
    if (key === 'F5' || (ctrl && letter === 'r')) return () => setNonce((n) => n + 1)
    if (key === 'Backspace' || (alt && key === 'ArrowLeft')) return back
    if (alt && key === 'ArrowRight') return forward
    if (alt && key === 'ArrowUp') return up
    if (alt && key === 'Home') return () => go(BOX_HOME)
    if (ctrl && shift && letter === 'n') return () => setPrompt({ kind: 'folder' })
    if (ctrl && !shift && letter === 'a') return () => setSelected(shown.map((entry) => entry.name))
    if (ctrl && !shift && letter === 'h') return () => setShowHidden((on) => !on)
    if (ctrl && !shift && letter === 'w') return onClose
    return null
  }
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = keyAction(event)
    if (!action) return
    event.preventDefault()
    action()
  }

  const menus: Menu[] = [
    {
      label: t('range.box.files.menu.file'),
      items: [
        {
          label: t('range.box.files.new_folder'),
          shortcut: 'Shift+Ctrl+N',
          onSelect: () => setPrompt({ kind: 'folder' }),
        },
        { label: t('range.box.files.send'), onSelect: () => picker.current?.click() },
        'separator',
        { label: t('range.box.files.open'), shortcut: 'Enter', disabled: !one, onSelect: () => one && open(one) },
        {
          label: t('range.box.files.fetch'),
          disabled: !one || one.type !== 'file',
          onSelect: () => one && download(joinPath(path, one.name)),
        },
        {
          label: t('range.box.files.rename'),
          shortcut: 'F2',
          disabled: !one,
          onSelect: () => setPrompt({ kind: 'rename', entry: one! }),
        },
        {
          label: t('range.box.files.delete'),
          shortcut: 'Delete',
          disabled: !chosen.length,
          onSelect: () => remove(chosen),
        },
        'separator',
        { label: t('range.box.files.close'), shortcut: 'Ctrl+W', onSelect: onClose },
      ],
    },
    {
      label: t('range.box.files.menu.edit'),
      items: [
        {
          label: t('range.box.files.select_all'),
          shortcut: 'Ctrl+A',
          onSelect: () => setSelected(shown.map((e) => e.name)),
        },
        { label: t('range.box.files.select_none'), onSelect: () => setSelected([]) },
      ],
    },
    {
      label: t('range.box.files.menu.view'),
      items: [
        {
          label: t('range.box.files.hidden'),
          shortcut: 'Ctrl+H',
          checked: showHidden,
          onSelect: () => setShowHidden((on) => !on),
        },
        {
          label: t('range.box.files.reload'),
          shortcut: 'Ctrl+R',
          icon: Icons.reload,
          onSelect: () => setNonce((n) => n + 1),
        },
      ],
    },
    {
      label: t('range.box.files.menu.go'),
      items: [
        {
          label: t('range.box.files.back'),
          shortcut: 'Alt+Left',
          icon: Icons.back,
          disabled: !history.back.length,
          onSelect: back,
        },
        {
          label: t('range.box.files.forward'),
          shortcut: 'Alt+Right',
          icon: Icons.forward,
          disabled: !history.forward.length,
          onSelect: forward,
        },
        {
          label: t('range.box.files.parent'),
          shortcut: 'Alt+Up',
          icon: Icons.up,
          disabled: !folder?.parent,
          onSelect: up,
        },
        {
          label: t('range.box.files.home'),
          shortcut: 'Alt+Home',
          icon: Icons.homeSymbolic,
          onSelect: () => go(BOX_HOME),
        },
        { label: t('range.box.files.file_system'), onSelect: () => go('/') },
      ],
    },
    {
      label: t('range.box.files.menu.bookmarks'),
      items: PLACES.slice(2).map((place) => ({ label: place.key, onSelect: () => go(place.path) })),
    },
  ]

  const entryMenu = (entry: BoxEntry): MenuItem[] => [
    { label: t('range.box.files.open'), onSelect: () => open(entry) },
    ...(entry.type === 'file' && isPicture(entry.name)
      ? [{ label: t('range.box.files.open_viewer'), onSelect: () => onOpenPicture(joinPath(path, entry.name)) }]
      : []),
    ...(entry.type === 'file'
      ? [{ label: t('range.box.files.fetch'), onSelect: () => download(joinPath(path, entry.name)) }]
      : []),
    'separator',
    { label: t('range.box.files.rename'), shortcut: 'F2', onSelect: () => setPrompt({ kind: 'rename', entry }) },
    {
      label: t('range.box.files.delete'),
      shortcut: 'Delete',
      onSelect: () => remove(selected.includes(entry.name) ? chosen : [entry]),
    },
  ]
  const folderMenu: MenuItem[] = [
    { label: t('range.box.files.new_folder'), onSelect: () => setPrompt({ kind: 'folder' }) },
    { label: t('range.box.files.send'), onSelect: () => picker.current?.click() },
    'separator',
    { label: t('range.box.files.hidden'), checked: showHidden, onSelect: () => setShowHidden((on) => !on) },
    { label: t('range.box.files.reload'), onSelect: () => setNonce((n) => n + 1) },
  ]

  if (!running) {
    return (
      <div className={classes.notice}>
        <img src={Icons.home} alt="" />
        <p>{t('range.box.files.off')}</p>
      </div>
    )
  }

  // the location bar: the drive or the home folder, then each folder on the way
  const crumbs = (() => {
    const inHome = path === BOX_HOME || path.startsWith(`${BOX_HOME}/`)
    const base = inHome ? BOX_HOME : '/'
    const rest = path.slice(base.length).split('/').filter(Boolean)
    return [
      { label: inHome ? 'root' : '/', path: base, icon: inHome ? Icons.home : Icons.drive },
      ...rest.map((part, index) => ({
        label: part,
        path: joinPath(base, rest.slice(0, index + 1).join('/')),
        icon: null,
      })),
    ]
  })()

  const folders = shown.filter((entry) => entry.type === 'folder').length
  const files = shown.length - folders
  const bytes = shown.filter((entry) => entry.type !== 'folder').reduce((sum, entry) => sum + entry.size, 0)

  return (
    <div className={classes.files}>
      <MenuBar menus={menus} />
      <div className={classes.filesToolbar}>
        <button
          type="button"
          className={classes.iconButton}
          onClick={back}
          disabled={!history.back.length}
          aria-label={t('range.box.files.back')}
        >
          <Sym src={Icons.back} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          onClick={forward}
          disabled={!history.forward.length}
          aria-label={t('range.box.files.forward')}
        >
          <Sym src={Icons.forward} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          onClick={up}
          disabled={!folder?.parent}
          aria-label={t('range.box.files.parent')}
        >
          <Sym src={Icons.up} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          onClick={() => go(BOX_HOME)}
          aria-label={t('range.box.files.home')}
        >
          <Sym src={Icons.homeSymbolic} size={18} />
        </button>
        <div className={classes.crumbs}>
          {crumbs.map((crumb, index) => (
            <button
              key={crumb.path}
              type="button"
              className={classes.crumb}
              data-current={index === crumbs.length - 1 || undefined}
              onClick={() => go(crumb.path)}
            >
              {crumb.icon && <img src={crumb.icon} alt="" />}
              {crumb.label}
            </button>
          ))}
        </div>
        <div className={classes.filterBox}>
          <Sym src={Icons.find} />
          <input
            className={classes.filterInput}
            value={filter}
            placeholder={t('range.box.files.filter')}
            onChange={(event) => setFilter(event.currentTarget.value)}
          />
        </div>
      </div>

      <div className={classes.filesMain}>
        <nav className={classes.places}>
          <div className={classes.placesTitle}>{t('range.box.files.places')}</div>
          {PLACES.map((place) => (
            <button
              key={place.path}
              type="button"
              className={classes.place}
              data-current={path === place.path || undefined}
              onClick={() => go(place.path)}
            >
              <img src={place.icon} alt="" />
              {place.key === 'computer' ? t('range.box.files.computer') : place.key === 'home' ? 'root' : place.key}
            </button>
          ))}
          <div className={classes.placesTitle}>{t('range.box.files.devices')}</div>
          <button
            type="button"
            className={classes.place}
            data-current={path === '/' || undefined}
            onClick={() => go('/')}
          >
            <img src={Icons.drive} alt="" />
            {t('range.box.files.file_system')}
          </button>
        </nav>

        <div
          ref={grid}
          className={classes.grid}
          tabIndex={0}
          data-over={over || undefined}
          onKeyDown={keys}
          onPointerDown={(event) => event.target === grid.current && setSelected([])}
          onContextMenu={(event) => {
            event.preventDefault()
            if (event.target === grid.current) setMenuAt({ x: event.clientX, y: event.clientY, entry: null })
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setOver(false)
            void send(event.dataTransfer.files)
          }}
        >
          {shown.map((entry) => (
            <button
              key={entry.name}
              type="button"
              className={classes.item}
              data-selected={selected.includes(entry.name) || undefined}
              data-link={entry.type === 'link' || undefined}
              title={entry.name}
              onClick={(event) =>
                setSelected((list) =>
                  event.ctrlKey || event.metaKey
                    ? list.includes(entry.name)
                      ? list.filter((name) => name !== entry.name)
                      : [...list, entry.name]
                    : [entry.name]
                )
              }
              onDoubleClick={() => open(entry)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (!selected.includes(entry.name)) setSelected([entry.name])
                setMenuAt({ x: event.clientX, y: event.clientY, entry })
              }}
            >
              <img src={entryIcon(entry, path)} alt="" draggable={false} />
              <span>{entry.name}</span>
            </button>
          ))}
          {folder && folder.path === path && shown.length === 0 && (
            <div className={classes.gridEmpty}>
              {filter ? t('range.box.files.no_match') : t('range.box.files.empty')}
            </div>
          )}
        </div>
      </div>

      {(error || busy) && (
        <div className={classes.filesNote} data-error={error ? true : undefined}>
          {error ?? t('range.box.files.working', { name: busy })}
        </div>
      )}
      <div className={classes.statusbar}>
        <span>
          {t('range.box.files.count_folders', { count: folders })} |{' '}
          {t('range.box.files.count_files', { count: files })}
          {files > 0 && `: ${binarySize(bytes)} (${bytes.toLocaleString()} ${t('range.box.files.bytes')})`}
          {folder?.free != null && ` | ${t('range.box.files.free', { size: binarySize(folder.free) })}`}
        </span>
      </div>

      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.currentTarget.files) void send(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
      <ContextMenu
        at={menuAt}
        items={menuAt?.entry ? entryMenu(menuAt.entry) : folderMenu}
        onClose={() => setMenuAt(null)}
      />
      {prompt && (
        <NamePrompt
          title={
            prompt.kind === 'folder'
              ? t('range.box.files.new_folder')
              : t('range.box.files.rename_title', { name: prompt.entry?.name })
          }
          value={prompt.kind === 'folder' ? t('range.box.files.untitled') : prompt.entry!.name}
          confirm={prompt.kind === 'folder' ? t('range.box.files.create') : t('range.box.files.rename')}
          cancel={t('range.box.files.cancel')}
          onDone={(value) => {
            const asked = prompt
            setPrompt(null)
            if (!value) return
            if (asked.kind === 'folder') void run(value, () => boxApi.makeFolder(path, value))
            else if (asked.entry && value !== asked.entry.name) {
              void run(value, () => boxApi.rename(joinPath(path, asked.entry!.name), value))
            }
          }}
        />
      )}
    </div>
  )
}
