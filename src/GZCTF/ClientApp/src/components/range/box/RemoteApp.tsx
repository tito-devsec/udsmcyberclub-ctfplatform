import RFB from '@novnc/novnc'
import { FC, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boxApi, screenUrl } from '@Utils/AttackBox'
import classes from '@Styles/AttackBox.module.css'
import { Icons } from './icons'

type Shown = 'starting' | 'shown' | 'closed' | 'failed'

// The programs that run on the club's server next to the student's box, shown in a window here.
export type RemoteAppName = 'browser' | 'burp'

// what each program's texts are filed under, and its picture
const LOOKS: Record<RemoteAppName, { words: string; icon: string }> = {
  browser: { words: 'firefox', icon: Icons.firefox },
  burp: { words: 'burp', icon: Icons.burp },
}

// Java takes Burp Suite some 10 seconds to draw its window, longer on a busy server. The window
// waits for it, with "starting" on show rather than a black screen, and after this long shows
// whatever is there.
const BURP_WAIT_MS = 4 * 60_000

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface BoxRemoteAppProps {
  app: RemoteAppName
  // false while the box is off: the program runs next to it
  running: boolean
  // whether the server runs the box's Firefox (and Burp Suite with it) at all
  enabled: boolean
  // the window in front, which gets the keyboard
  active: boolean
  onFullscreen: () => void
}

// Firefox or Burp Suite, running on the club's server next to the student's box, shown in this
// window: the page draws its screen and sends it the mouse and the keyboard (over VNC). Searches
// and every site stay in there. The clipboard is shared both ways: what is copied there reaches
// the student's own clipboard, and what they copied elsewhere becomes the program's whenever they
// come back to it, so that Ctrl+V pastes it there as it would on their computer.
export const BoxRemoteApp: FC<BoxRemoteAppProps> = ({ app, running, enabled, active, onFullscreen }) => {
  const { t } = useTranslation()
  const holder = useRef<HTMLDivElement>(null)
  const screen = useRef<RFB | null>(null)
  const [shown, setShown] = useState<Shown>('starting')
  const [problem, setProblem] = useState<string | null>(null)
  const [session, setSession] = useState(0)
  const latest = useRef({ onFullscreen })
  useLayoutEffect(() => {
    latest.current = { onFullscreen }
  })

  useEffect(() => {
    const element = holder.current
    if (!running || !enabled || !element) return
    let gone = false
    // what both clipboards last held, so that neither is sent back to where it came from
    let shared: string | null = null

    // The student's clipboard becomes the program's: when they come back to it from another
    // window, another program, or another tab. The browser asks them once whether it may.
    const share = () => {
      const rfb = screen.current
      if (!rfb || !navigator.clipboard?.readText) return
      navigator.clipboard.readText().then(
        (text) => {
          if (!text || text === shared || screen.current !== rfb) return
          shared = text
          rfb.clipboardPasteFrom(text)
        },
        () => {}
      )
    }

    // Firefox is up once its container runs; Burp Suite once Java has drawn its window
    const start = async () => {
      if (app === 'browser') return void (await boxApi.startBrowser())
      let { ready } = await boxApi.startBurp()
      const until = Date.now() + BURP_WAIT_MS
      while (!ready && !gone && Date.now() < until) {
        await pause(2000)
        if (!gone) ({ ready } = await boxApi.burpReady())
      }
    }

    start()
      .then(() => {
        if (gone) return
        const rfb = new RFB(element, screenUrl(app), { shared: true })
        // the screen on the server takes the window's size, as a real window's would
        rfb.resizeSession = true
        rfb.scaleViewport = false
        rfb.clipViewport = false
        rfb.background = '#1f232b'
        rfb.qualityLevel = 7
        rfb.compressionLevel = 2
        rfb.addEventListener('connect', () => {
          setShown('shown')
          rfb.focus()
          share()
        })
        rfb.addEventListener('disconnect', () => {
          if (!gone) setShown('closed')
        })
        // copied in the program: to the student's own clipboard
        rfb.addEventListener('clipboard', (event) => {
          const { text } = (event as CustomEvent<{ text: string }>).detail
          shared = text
          navigator.clipboard?.writeText(text).catch(() => {})
        })
        screen.current = rfb
      })
      .catch((failure) => {
        if (gone) return
        setProblem(failure instanceof Error ? failure.message : String(failure))
        setShown('failed')
      })

    // F11 fills the screen, as in the terminal; every other key goes to the program
    const keys = (event: KeyboardEvent) => {
      if (!screen.current || event.key !== 'F11' || event.ctrlKey || event.altKey || event.shiftKey) return
      event.preventDefault()
      event.stopPropagation()
      latest.current.onFullscreen()
    }
    // back from another program or tab, straight into this one
    const back = () => {
      if (element.contains(document.activeElement)) share()
    }
    element.addEventListener('keydown', keys, true)
    element.addEventListener('focusin', share)
    window.addEventListener('focus', back)

    return () => {
      gone = true
      element.removeEventListener('keydown', keys, true)
      element.removeEventListener('focusin', share)
      window.removeEventListener('focus', back)
      screen.current?.disconnect()
      screen.current = null
    }
  }, [app, running, enabled, session])

  useEffect(() => {
    if (active) screen.current?.focus()
  }, [active])

  const again = () => {
    setProblem(null)
    setShown('starting')
    setSession((n) => n + 1)
  }

  const { words, icon } = LOOKS[app]
  const notice = !running
    ? { text: t(`range.box.${words}.off`) }
    : !enabled
      ? { text: t(`range.box.${words}.disabled`) }
      : shown === 'starting'
        ? { text: t(`range.box.${words}.starting`) }
        : shown === 'closed'
          ? { title: t(`range.box.${words}.closed`), text: t(`range.box.${words}.closed_hint`), retry: true }
          : shown === 'failed'
            ? { title: t(`range.box.${words}.failed`), text: problem ?? '', retry: true }
            : null

  return (
    <div className={classes.remote} data-app={app} data-state={running && enabled ? shown : 'off'}>
      <div ref={holder} className={classes.remoteScreen} />
      {notice && (
        <div className={classes.notice}>
          <img src={icon} alt="" />
          {notice.title && <h3>{notice.title}</h3>}
          <p>{notice.text}</p>
          {notice.retry && (
            <button type="button" className={classes.button} data-tone="primary" data-size="lg" onClick={again}>
              {t(`range.box.${words}.again`)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
