import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { FC, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { terminalUrl } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import '@xterm/xterm/css/xterm.css'

// the club's navy, blue and gold, and colours that read well on them
const THEME = {
  background: '#0b1424',
  foreground: '#dbe7f7',
  cursor: '#f5b82e',
  cursorAccent: '#0b1424',
  selectionBackground: '#2b4a7a',
  black: '#0b1424',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f5b82e',
  blue: '#3b82f6',
  magenta: '#d946ef',
  cyan: '#0ea5e9',
  white: '#dbe7f7',
  brightBlack: '#56698a',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fcd34d',
  brightBlue: '#60a5fa',
  brightMagenta: '#e879f9',
  brightCyan: '#38bdf8',
  brightWhite: '#ffffff',
}

const FONT = "'JetBrains Mono', 'Cascadia Mono', 'Fira Code', Consolas, 'DejaVu Sans Mono', monospace"

interface BoxTerminalProps {
  // false while the box is off: nothing to connect to
  running: boolean
}

// A shell in the student's attack box, over a WebSocket: what is typed goes as bytes, what the
// shell prints comes back as bytes, and the box's size follows the window's.
export const BoxTerminal: FC<BoxTerminalProps> = ({ running }) => {
  const { t } = useTranslation()
  const holder = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fitter = useRef<FitAddon | null>(null)
  const [ended, setEnded] = useState<string | null>(null)
  const [session, setSession] = useState(0)
  const [fontSize, setFontSize] = useState(14)
  // the size a new terminal starts with; changing it later needs no new connection
  const size = useRef(fontSize)

  useEffect(() => {
    if (!running || !holder.current) return
    setEnded(null)
    const terminal = new Terminal({
      fontFamily: FONT,
      fontSize: size.current,
      theme: THEME,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: false,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(holder.current)
    fit.fit()
    term.current = terminal
    fitter.current = fit

    const copy = () => {
      const text = terminal.getSelection()
      if (text) navigator.clipboard?.writeText(text).catch(() => {})
    }
    const paste = () => {
      navigator.clipboard
        ?.readText()
        .then((text) => terminal.paste(text))
        .catch(() => {})
    }
    // Ctrl+Shift+C and Ctrl+Shift+V copy and paste; Ctrl+C stays the shell's own
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown' || !event.ctrlKey || !event.shiftKey) return true
      if (event.code === 'KeyC') {
        copy()
        return false
      }
      if (event.code === 'KeyV') {
        paste()
        return false
      }
      return true
    })

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

    // the window was moved, resized, hidden or shown
    let pending = 0
    const observer = new ResizeObserver(() => {
      window.clearTimeout(pending)
      pending = window.setTimeout(() => {
        try {
          fit.fit()
        } catch {
          // hidden: no size to fit
        }
      }, 60)
    })
    observer.observe(holder.current)
    terminal.focus()

    return () => {
      window.clearTimeout(pending)
      observer.disconnect()
      typed.dispose()
      typedBinary.dispose()
      resized.dispose()
      ws.onclose = null
      ws.close()
      terminal.dispose()
      term.current = null
      fitter.current = null
    }
  }, [running, session, t])

  useEffect(() => {
    size.current = fontSize
    const terminal = term.current
    if (!terminal) return
    terminal.options.fontSize = fontSize
    try {
      fitter.current?.fit()
    } catch {
      // hidden: fitted when shown
    }
  }, [fontSize])

  const act = (action: 'copy' | 'paste') => {
    const terminal = term.current
    if (!terminal) return
    if (action === 'copy') navigator.clipboard?.writeText(terminal.getSelection()).catch(() => {})
    else
      navigator.clipboard
        ?.readText()
        .then((text) => terminal.paste(text))
        .catch(() => {})
    terminal.focus()
  }

  return (
    <>
      <div className={classes.toolbar}>
        <button type="button" className={classes.button} onClick={() => act('copy')} title="Ctrl+Shift+C">
          <Uicon name="copy-alt" />
          {t('range.box.terminal.copy')}
        </button>
        <button type="button" className={classes.button} onClick={() => act('paste')} title="Ctrl+Shift+V">
          {t('range.box.terminal.paste')}
        </button>
        <button
          type="button"
          className={classes.button}
          onClick={() => {
            term.current?.clear()
            term.current?.focus()
          }}
        >
          {t('range.box.terminal.clear')}
        </button>
        <div className={classes.spacer} />
        <button
          type="button"
          className={classes.button}
          onClick={() => setFontSize((size) => Math.max(10, size - 1))}
          aria-label={t('range.box.terminal.smaller')}
        >
          A−
        </button>
        <button
          type="button"
          className={classes.button}
          onClick={() => setFontSize((size) => Math.min(24, size + 1))}
          aria-label={t('range.box.terminal.bigger')}
        >
          A+
        </button>
      </div>
      <div ref={holder} className={classes.terminal} />
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
            <Uicon name="refresh" />
            {t('range.box.terminal.again')}
          </button>
        </div>
      )}
    </>
  )
}
