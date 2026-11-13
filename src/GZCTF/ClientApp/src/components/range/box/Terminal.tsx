import { CanvasAddon } from '@xterm/addon-canvas'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Terminal } from '@xterm/xterm'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MainIcon } from '@Components/icon/MainIcon'
import { terminalUrl } from '@Utils/AttackBox'
import { useConfig } from '@Hooks/useConfig'
import classes from '@Styles/AttackBox.module.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/700.css'
import '@xterm/xterm/css/xterm.css'

// what the menus and the keyboard shortcuts of Kali's terminal (QTerminal) ask for
export type TermCommand =
  | 'copy'
  | 'paste'
  | 'pasteSelection'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'clear'
  | 'newTab'
  | 'closeTab'
  | 'newWindow'
  | 'nextTab'
  | 'prevTab'
  | 'splitH'
  | 'splitV'
  | 'closePane'
  | 'paneLeft'
  | 'paneRight'
  | 'paneUp'
  | 'paneDown'
  | 'find'
  | 'fullscreen'

export interface BoxTerminalHandle {
  copy: () => void
  paste: () => void
  pasteSelection: () => void
  clear: () => void
  focus: () => void
  // finds the next (or the previous) place the text shows up; false when it is nowhere
  find: (query: string, backwards?: boolean) => boolean
  stopFind: () => void
}

// Kali's terminal font, with fallbacks, and colours close to its dark theme. The background is
// see-through so that the club's watermark shows behind the text.
const FONT = "'Fira Code', 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', monospace"
const THEME = {
  background: 'rgba(0, 0, 0, 0)',
  foreground: '#f1f3f5',
  cursor: '#ffffff',
  cursorAccent: '#23262f',
  selectionBackground: 'rgba(59, 142, 234, 0.45)',
  black: '#2b2f38',
  red: '#ec5f67',
  green: '#36b6a0',
  yellow: '#f5c66f',
  blue: '#3b8eea',
  magenta: '#c594c5',
  cyan: '#5fb3b3',
  white: '#d8dee9',
  brightBlack: '#65737e',
  brightRed: '#ff7a85',
  brightGreen: '#5fd7a7',
  brightYellow: '#fadb7a',
  brightBlue: '#6cb6ff',
  brightMagenta: '#dcbdfb',
  brightCyan: '#7ad7d2',
  brightWhite: '#ffffff',
}
const FIND = {
  matchBackground: '#3b8eea66',
  matchOverviewRuler: '#3b8eea',
  activeMatchBackground: '#f5b82e',
  activeMatchColorOverviewRuler: '#f5b82e',
}

// The command a key press stands for, with QTerminal's own keys. Moving between the two halves
// of a split only takes Alt+arrows while there are two halves, so that programs keep them.
function commandOf(event: KeyboardEvent, split: boolean): TermCommand | null {
  const { ctrlKey: ctrl, shiftKey: shift, altKey: alt, key, code } = event
  if (ctrl && shift && !alt) {
    const keys: Record<string, TermCommand> = {
      KeyC: 'copy',
      KeyV: 'paste',
      KeyT: 'newTab',
      KeyW: 'closeTab',
      KeyN: 'newWindow',
      KeyD: 'splitV',
      KeyR: 'splitH',
      KeyE: 'closePane',
      KeyF: 'find',
    }
    if (keys[code]) return keys[code]
    if (key === '+') return 'zoomIn'
  }
  if (ctrl && !shift && !alt) {
    if (key === '+' || key === '=') return 'zoomIn'
    if (key === '-') return 'zoomOut'
    if (key === '0') return 'zoomReset'
    if (key === 'PageDown') return 'nextTab'
    if (key === 'PageUp') return 'prevTab'
  }
  if (shift && !ctrl && !alt && key === 'Insert') return 'pasteSelection'
  if (alt && !ctrl && !shift && split) {
    const arrows: Record<string, TermCommand> = {
      ArrowLeft: 'paneLeft',
      ArrowRight: 'paneRight',
      ArrowUp: 'paneUp',
      ArrowDown: 'paneDown',
    }
    if (arrows[key]) return arrows[key]
  }
  if (key === 'F11' && !ctrl && !alt && !shift) return 'fullscreen'
  return null
}

interface BoxTerminalProps {
  // false while the box is off: nothing to connect to
  running: boolean
  fontSize: number
  // the terminal the keyboard goes to
  active: boolean
  // whether it shares its tab with another one
  split: boolean
  onCommand: (command: TermCommand) => void
  onFocus: () => void
  onContextMenu: (x: number, y: number) => void
}

// The club's logo and name, faint behind the text, where Kali's terminal has its own.
const Watermark = () => {
  const { config } = useConfig()
  return (
    <div className={classes.termMark} aria-hidden>
      {config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />}
      <div className={classes.termMarkBox}>UDSM CyberRange</div>
    </div>
  )
}

// A shell in the student's attack box, over a WebSocket: what is typed goes as bytes, what the
// shell prints comes back as bytes, and the box's terminal size follows the window's.
export const BoxTerminal = forwardRef<BoxTerminalHandle, BoxTerminalProps>(
  ({ running, fontSize, active, split, onCommand, onFocus, onContextMenu }, ref) => {
    const { t } = useTranslation()
    const holder = useRef<HTMLDivElement>(null)
    const term = useRef<Terminal | null>(null)
    const fitter = useRef<FitAddon | null>(null)
    const finder = useRef<SearchAddon | null>(null)
    const [ended, setEnded] = useState<string | null>(null)
    const [session, setSession] = useState(0)
    // the latest of what changes, for the terminal's handlers, which are set up once
    const latest = useRef({ fontSize, split, onCommand, onFocus })
    useLayoutEffect(() => {
      latest.current = { fontSize, split, onCommand, onFocus }
    })

    useImperativeHandle(ref, () => ({
      copy: () => {
        const text = term.current?.getSelection()
        if (text) navigator.clipboard?.writeText(text).catch(() => {})
        term.current?.focus()
      },
      paste: () => {
        navigator.clipboard
          ?.readText()
          .then((text) => term.current?.paste(text))
          .catch(() => {})
        term.current?.focus()
      },
      pasteSelection: () => {
        const text = term.current?.getSelection()
        if (text) term.current?.paste(text)
        term.current?.focus()
      },
      clear: () => {
        term.current?.clear()
        term.current?.focus()
      },
      focus: () => term.current?.focus(),
      find: (query, backwards) =>
        Boolean(
          query &&
          (backwards
            ? finder.current?.findPrevious(query, { decorations: FIND })
            : finder.current?.findNext(query, { decorations: FIND }))
        ),
      stopFind: () => {
        finder.current?.clearDecorations()
        term.current?.focus()
      },
    }))

    useEffect(() => {
      if (!running || !holder.current) return
      let disposed = false
      let cleanup: (() => void) | null = null

      const start = async () => {
        // the font must be there before the terminal measures its letters
        await Promise.all([
          document.fonts.load(`${latest.current.fontSize}px "Fira Code"`),
          document.fonts.load(`bold ${latest.current.fontSize}px "Fira Code"`),
        ]).catch(() => {})
        if (disposed || !holder.current) return
        setEnded(null)

        const terminal = new Terminal({
          fontFamily: FONT,
          fontSize: latest.current.fontSize,
          theme: THEME,
          allowTransparency: true,
          allowProposedApi: true,
          cursorBlink: true,
          scrollback: 10_000,
        })
        const fit = new FitAddon()
        const search = new SearchAddon()
        terminal.loadAddon(fit)
        terminal.loadAddon(search)
        terminal.open(holder.current)
        try {
          // Drawn on a canvas, block and line characters join up as in Kali's own terminal: the
          // welcome's letters, the prompt's corners, tables drawn by tools.
          terminal.loadAddon(new CanvasAddon())
        } catch {
          // no canvas to draw on: the browser's own text is used
        }
        fit.fit()
        term.current = terminal
        fitter.current = fit
        finder.current = search

        terminal.attachCustomKeyEventHandler((event) => {
          if (event.type !== 'keydown') return true
          const command = commandOf(event, latest.current.split)
          if (!command) return true
          event.preventDefault()
          event.stopPropagation()
          latest.current.onCommand(command)
          return false
        })
        const focused = () => latest.current.onFocus()
        terminal.textarea?.addEventListener('focus', focused)

        const ws = new WebSocket(terminalUrl(terminal.cols, terminal.rows))
        ws.binaryType = 'arraybuffer'
        const encoder = new TextEncoder()
        let said: string | null = null
        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              said = (JSON.parse(event.data) as { closed?: string }).closed ?? said
            } catch {
              // not a message for us
            }
            return
          }
          terminal.write(new Uint8Array(event.data as ArrayBuffer))
        }
        ws.onclose = () => setEnded(said ?? t('range.box.terminal.lost'))
        const typed = terminal.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(encoder.encode(data))
        })
        const typedBinary = terminal.onBinary((data) => {
          if (ws.readyState === ws.OPEN) ws.send(Uint8Array.from(data, (c) => c.charCodeAt(0)))
        })
        const resized = terminal.onResize(({ cols, rows }) => {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ resize: [cols, rows] }))
        })

        // the window was moved, resized, split, hidden or shown
        let pending = 0
        const observer = new ResizeObserver(() => {
          window.clearTimeout(pending)
          pending = window.setTimeout(() => {
            try {
              fit.fit()
            } catch {
              // hidden: no size to fit
            }
          }, 50)
        })
        observer.observe(holder.current)
        terminal.focus()

        cleanup = () => {
          window.clearTimeout(pending)
          observer.disconnect()
          terminal.textarea?.removeEventListener('focus', focused)
          typed.dispose()
          typedBinary.dispose()
          resized.dispose()
          ws.onclose = null
          ws.close()
          terminal.dispose()
          term.current = null
          fitter.current = null
          finder.current = null
        }
      }
      void start()
      return () => {
        disposed = true
        cleanup?.()
      }
    }, [running, session, t])

    useEffect(() => {
      const terminal = term.current
      if (!terminal) return
      terminal.options.fontSize = fontSize
      try {
        fitter.current?.fit()
      } catch {
        // hidden: fitted when shown
      }
    }, [fontSize])

    useEffect(() => {
      if (active) term.current?.focus()
    }, [active])

    return (
      <div className={classes.termPane} data-active={active || undefined}>
        <Watermark />
        <div
          ref={holder}
          className={classes.terminal}
          onContextMenu={(event) => {
            event.preventDefault()
            onFocus()
            onContextMenu(event.clientX, event.clientY)
          }}
        />
        {running && ended && (
          <div className={classes.notice}>
            <h3>{t('range.box.terminal.ended')}</h3>
            <p>{ended}</p>
            <button
              type="button"
              className={classes.button}
              data-tone="primary"
              data-size="lg"
              onClick={() => setSession((n) => n + 1)}
            >
              {t('range.box.terminal.again')}
            </button>
          </div>
        )}
      </div>
    )
  }
)

BoxTerminal.displayName = 'BoxTerminal'
