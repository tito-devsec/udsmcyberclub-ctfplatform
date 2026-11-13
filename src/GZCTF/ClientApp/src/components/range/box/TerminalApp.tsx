import { FC, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '@Styles/AttackBox.module.css'
import { ContextMenu, Menu, MenuAction, MenuBar } from './MenuBar'
import { BoxTerminal, BoxTerminalHandle, TermCommand } from './Terminal'
import { Icons, Sym } from './icons'

// One tab: one terminal, or two side by side ('h') or one over the other ('v').
interface Tab {
  id: string
  panes: string[]
  split: 'h' | 'v' | null
  active: number
}

let counter = 0
const newId = (kind: string) => `${kind}-${Date.now()}-${++counter}`
const newTab = (): Tab => ({ id: newId('tab'), panes: [newId('pane')], split: null, active: 0 })

const FONT_SIZE = 14

interface TerminalAppProps {
  running: boolean
  onClose: () => void
  onNewWindow: () => void
  onFullscreen: () => void
}

// What a terminal window holds, made like Kali's terminal (QTerminal): its menus with their keys,
// tabs, split view, finding text, and a menu on the right click.
export const TerminalApp: FC<TerminalAppProps> = ({ running, onClose, onNewWindow, onFullscreen }) => {
  const { t } = useTranslation()
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [current, setCurrent] = useState(0)
  const [fontSize, setFontSize] = useState(FONT_SIZE)
  const [showTabBar, setShowTabBar] = useState(true)
  const [finding, setFinding] = useState(false)
  const [query, setQuery] = useState('')
  const [missing, setMissing] = useState(false)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [about, setAbout] = useState(false)
  const handles = useRef(new Map<string, BoxTerminalHandle>())

  const tab = tabs[Math.min(current, tabs.length - 1)]!
  const activePane = () => handles.current.get(tab.panes[tab.active]!)

  const command = useCallback(
    (what: TermCommand) => {
      const pane = handles.current.get(tab.panes[tab.active]!)
      switch (what) {
        case 'copy':
          return pane?.copy()
        case 'paste':
          return pane?.paste()
        case 'pasteSelection':
          return pane?.pasteSelection()
        case 'clear':
          return pane?.clear()
        case 'zoomIn':
          return setFontSize((size) => Math.min(28, size + 1))
        case 'zoomOut':
          return setFontSize((size) => Math.max(9, size - 1))
        case 'zoomReset':
          return setFontSize(FONT_SIZE)
        case 'newTab':
          setTabs((list) => [...list, newTab()])
          return setCurrent(tabs.length)
        case 'closeTab':
          if (tabs.length === 1) return onClose()
          setTabs((list) => list.filter((_, index) => index !== current))
          return setCurrent((index) => Math.max(0, index - 1))
        case 'newWindow':
          return onNewWindow()
        case 'nextTab':
          return setCurrent((index) => (index + 1) % tabs.length)
        case 'prevTab':
          return setCurrent((index) => (index - 1 + tabs.length) % tabs.length)
        case 'splitH':
        case 'splitV':
          if (tab.panes.length > 1) return
          return setTabs((list) =>
            list.map((each) =>
              each.id === tab.id
                ? { ...each, panes: [...each.panes, newId('pane')], split: what === 'splitH' ? 'h' : 'v', active: 1 }
                : each
            )
          )
        case 'closePane':
          if (tab.panes.length < 2) return
          return setTabs((list) =>
            list.map((each) =>
              each.id === tab.id
                ? { ...each, panes: each.panes.filter((_, index) => index !== each.active), split: null, active: 0 }
                : each
            )
          )
        case 'paneLeft':
        case 'paneRight':
        case 'paneUp':
        case 'paneDown': {
          const sideways = what === 'paneLeft' || what === 'paneRight'
          if (tab.panes.length < 2 || (tab.split === 'h') !== sideways) return
          const next = what === 'paneLeft' || what === 'paneUp' ? 0 : 1
          return setTabs((list) => list.map((each) => (each.id === tab.id ? { ...each, active: next } : each)))
        }
        case 'find':
          return setFinding(true)
        case 'fullscreen':
          return onFullscreen()
      }
    },
    [tab, tabs.length, current, onClose, onNewWindow, onFullscreen]
  )

  const find = (backwards = false) => setMissing(!activePane()?.find(query, backwards))
  const closeFind = () => {
    setFinding(false)
    setMissing(false)
    activePane()?.stopFind()
  }

  const item = (label: string, what: TermCommand, shortcut?: string, disabled?: boolean): MenuAction => ({
    label: t(`range.box.term.${label}`),
    shortcut,
    disabled,
    onSelect: () => command(what),
  })
  const split = tab.panes.length > 1
  const menus: Menu[] = [
    {
      label: t('range.box.term.session'),
      items: [
        { ...item('new_tab', 'newTab', 'Ctrl+Shift+T'), icon: Icons.add },
        { ...item('close_tab', 'closeTab', 'Ctrl+Shift+W'), icon: Icons.close },
        item('new_window', 'newWindow', 'Ctrl+Shift+N'),
        'separator',
        { label: t('range.box.term.quit'), onSelect: onClose },
      ],
    },
    {
      label: t('range.box.term.actions'),
      items: [
        item('clear', 'clear'),
        'separator',
        item('next_tab', 'nextTab', 'Ctrl+PgDown', tabs.length < 2),
        item('previous_tab', 'prevTab', 'Ctrl+PgUp', tabs.length < 2),
        'separator',
        item('split_v', 'splitV', 'Ctrl+Shift+D', split),
        item('split_h', 'splitH', 'Ctrl+Shift+R', split),
        item('close_pane', 'closePane', 'Ctrl+Shift+E', !split),
        item('pane_up', 'paneUp', 'Alt+Up', tab.split !== 'v'),
        item('pane_down', 'paneDown', 'Alt+Down', tab.split !== 'v'),
        item('pane_left', 'paneLeft', 'Alt+Left', tab.split !== 'h'),
        item('pane_right', 'paneRight', 'Alt+Right', tab.split !== 'h'),
        'separator',
        { ...item('find', 'find', 'Ctrl+Shift+F'), icon: Icons.find },
      ],
    },
    {
      label: t('range.box.term.edit'),
      items: [
        item('copy', 'copy', 'Ctrl+Shift+C'),
        item('paste', 'paste', 'Ctrl+Shift+V'),
        item('paste_selection', 'pasteSelection', 'Shift+Ins'),
        'separator',
        item('zoom_in', 'zoomIn', 'Ctrl++'),
        item('zoom_out', 'zoomOut', 'Ctrl+-'),
        item('zoom_reset', 'zoomReset', 'Ctrl+0'),
      ],
    },
    {
      label: t('range.box.term.view'),
      items: [
        { label: t('range.box.term.tab_bar'), checked: showTabBar, onSelect: () => setShowTabBar((on) => !on) },
        item('fullscreen', 'fullscreen', 'F11'),
      ],
    },
    {
      label: t('range.box.term.help'),
      items: [{ label: t('range.box.term.about'), onSelect: () => setAbout(true) }],
    },
  ]

  return (
    <>
      <MenuBar menus={menus} />
      {showTabBar && tabs.length > 1 && (
        <div className={classes.tabbar} role="tablist">
          {tabs.map((each, index) => (
            <div
              key={each.id}
              role="tab"
              aria-selected={index === current}
              className={classes.tab}
              data-active={index === current || undefined}
              onPointerDown={() => setCurrent(index)}
            >
              <img src={Icons.terminal} alt="" />
              <span>{t('range.box.term.shell', { number: index + 1 })}</span>
              <button
                type="button"
                className={classes.tabClose}
                aria-label={t('range.box.term.close_tab')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setTabs((list) => list.filter((_, at) => at !== index))
                  setCurrent((at) => (at >= index ? Math.max(0, at - 1) : at))
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={classes.termArea}>
        {tabs.map((each, index) => (
          <div
            key={each.id}
            className={classes.tabPanes}
            data-split={each.split ?? undefined}
            style={{ display: index === Math.min(current, tabs.length - 1) ? 'flex' : 'none' }}
          >
            {each.panes.map((id, pane) => (
              <BoxTerminal
                key={id}
                ref={(handle) => {
                  if (handle) handles.current.set(id, handle)
                  else handles.current.delete(id)
                }}
                running={running}
                fontSize={fontSize}
                active={index === current && pane === each.active}
                split={each.panes.length > 1}
                onCommand={command}
                onFocus={() =>
                  setTabs((list) =>
                    list.map((other) =>
                      other.id === each.id && other.active !== pane ? { ...other, active: pane } : other
                    )
                  )
                }
                onContextMenu={(x, y) => setMenuAt({ x, y })}
              />
            ))}
          </div>
        ))}
      </div>
      {finding && (
        <div className={classes.findBar}>
          <Sym src={Icons.find} />
          <input
            className={classes.input}
            value={query}
            autoFocus
            placeholder={t('range.box.term.find_placeholder')}
            data-missing={missing || undefined}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') find(event.shiftKey)
              if (event.key === 'Escape') closeFind()
            }}
          />
          <button type="button" className={classes.button} onClick={() => find(true)}>
            {t('range.box.term.find_previous')}
          </button>
          <button type="button" className={classes.button} onClick={() => find(false)}>
            {t('range.box.term.find_next')}
          </button>
          {missing && <span className={classes.findMissing}>{t('range.box.term.find_none')}</span>}
          <div className={classes.spacer} />
          <button
            type="button"
            className={classes.iconButton}
            onClick={closeFind}
            aria-label={t('range.box.window.close')}
          >
            <Sym src={Icons.close} />
          </button>
        </div>
      )}
      <ContextMenu
        at={menuAt}
        onClose={() => setMenuAt(null)}
        items={[
          item('copy', 'copy', 'Ctrl+Shift+C'),
          item('paste', 'paste', 'Ctrl+Shift+V'),
          item('paste_selection', 'pasteSelection', 'Shift+Ins'),
          'separator',
          item('clear', 'clear'),
          'separator',
          item('split_v', 'splitV', 'Ctrl+Shift+D', split),
          item('split_h', 'splitH', 'Ctrl+Shift+R', split),
          item('close_pane', 'closePane', 'Ctrl+Shift+E', !split),
          'separator',
          { ...item('find', 'find', 'Ctrl+Shift+F'), icon: Icons.find },
        ]}
      />
      {about && (
        <div className={classes.dialogShade} onPointerDown={() => setAbout(false)}>
          <div className={classes.dialog} onPointerDown={(event) => event.stopPropagation()}>
            <img src={Icons.terminal} alt="" style={{ width: 48, height: 48 }} />
            <div className={classes.dialogTitle}>{t('range.box.term.about_title')}</div>
            <p className={classes.dialogText}>{t('range.box.term.about_text')}</p>
            <div className={classes.dialogButtons}>
              <button type="button" className={classes.button} data-tone="primary" onClick={() => setAbout(false)}>
                {t('range.box.term.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
