import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { MainIcon } from '@Components/icon/MainIcon'
import { BoxCommands } from '@Components/range/box/Commands'
import { BoxFiles } from '@Components/range/box/Files'
import { ContextMenu, MenuItem } from '@Components/range/box/MenuBar'
import { BoxRemoteApp } from '@Components/range/box/RemoteApp'
import { PictureSource, StegoViewer } from '@Components/range/box/Stego'
import { TerminalApp } from '@Components/range/box/TerminalApp'
import { AppName, Window, WindowState } from '@Components/range/box/Window'
import { Icons } from '@Components/range/box/icons'
import { BOX_HOME, boxApi, BoxView, useBox } from '@Utils/AttackBox'
import { formatMinutes } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { useConfig } from '@Hooks/useConfig'
import { usePageTitle } from '@Hooks/usePageTitle'
import { useUser } from '@Hooks/useUser'
import classes from '@Styles/AttackBox.module.css'

// The desktop's programs: their icon (Kali's own, and CyberChef's), the size they open at, and
// whether more than one may be open.
const APPS: Record<AppName, { image: string; w: number; h: number; many?: boolean }> = {
  terminal: { image: Icons.terminal, w: 940, h: 620, many: true },
  files: { image: Icons.home, w: 960, h: 600, many: true },
  // Firefox has tabs and windows of its own, and Burp Suite runs once, next to it
  browser: { image: Icons.firefox, w: 1180, h: 740 },
  burp: { image: Icons.burp, w: 1240, h: 760 },
  cyberchef: { image: Icons.cyberchef, w: 1180, h: 680 },
  stego: { image: Icons.imageViewer, w: 960, h: 640 },
  help: { image: Icons.help, w: 860, h: 640 },
}
const LAUNCHERS: AppName[] = ['terminal', 'files', 'browser', 'burp', 'cyberchef', 'stego']
// the desktop's size until it is measured
const DEFAULT_AREA = { width: 1200, height: 700 }

// The club's own logo, as set on the platform.
const ClubLogo: FC = () => {
  const { config } = useConfig()
  return config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />
}

// An icon on the desktop: a click selects it, and a double click or Enter opens it, as on Kali's.
const DesktopIcon: FC<{ image: string; label: string; onOpen: () => void }> = ({ image, label, onOpen }) => (
  <button
    type="button"
    className={classes.icon}
    onClick={(event) => event.currentTarget.focus()}
    onDoubleClick={onOpen}
    onKeyDown={(event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      onOpen()
    }}
  >
    <img src={image} alt="" />
    {label}
  </button>
)

// "1h 52m", from now until then
const left = (until: string, now: number) => formatMinutes(Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000)))

// The attack box: a desktop in the browser made like Kali's (Xfce): a panel along the top, icons
// on a wallpaper drawn for the club, and windows for a terminal in the student's own Kali box,
// its files, Firefox and Burp Suite (running on the server next to the box), CyberChef, a picture
// viewer for hidden data, and help.
const AttackBoxPage: FC = () => {
  const { t, i18n } = useTranslation()
  const { error: signInError } = useUser()
  const { data: view, mutate } = useBox()
  const [windows, setWindows] = useState<WindowState[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [picture, setPicture] = useState<PictureSource | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [appsAt, setAppsAt] = useState<{ x: number; y: number } | null>(null)
  const desktop = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const top = useRef(10)
  const opened = useRef(false)

  usePageTitle(t('range.box.title'))

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(tick)
  }, [])

  const running = Boolean(view?.box)
  const signedOut = Boolean(signInError)
  // the lab whose machine the box reaches as "target"
  const lab = view?.target?.lab

  // the size of the desktop under the panel, which windows stay inside; unknown until it is drawn
  const [areaSize, setAreaSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const element = area.current
    if (!element) return
    const observer = new ResizeObserver(() => setAreaSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const bounds = areaSize ?? DEFAULT_AREA

  const open = useCallback(
    (app: AppName, options: { fresh?: boolean; path?: string } = {}) =>
      setWindows((list) => {
        const found = [...list].reverse().find((w) => w.app === app)
        if (found && (!APPS[app].many || !options.fresh)) {
          top.current += 1
          return list.map((w) =>
            w.id === found.id ? { ...w, min: false, z: top.current, path: options.path ?? w.path } : w
          )
        }
        const { width, height } = bounds
        const w = Math.min(APPS[app].w, width - 140)
        const h = Math.min(APPS[app].h, height - 60)
        const step = (list.length % 6) * 28
        top.current += 1
        return [
          ...list,
          {
            id: `${app}-${Date.now()}`,
            app,
            title: '',
            x: Math.max(120, Math.min((width - w) / 2 + step - 40, width - w - 10)),
            y: Math.max(8, Math.min((height - h) / 2 - 30 + step, height - h - 10)),
            w,
            h,
            z: top.current,
            min: false,
            max: false,
            path: options.path,
          },
        ]
      }),
    [bounds]
  )

  // A terminal is open whenever the desktop shows a running box: on coming to the page, and each
  // time the box starts. One already open, even hidden, is brought to the front instead.
  useEffect(() => {
    if (!view?.box) {
      opened.current = false
      return
    }
    if (areaSize && !opened.current) {
      opened.current = true
      open('terminal')
    }
  }, [view, areaSize, open])

  // Leaving the page ends its terminals. Ctrl+W and Ctrl+Shift+W, keys of Kali's programs, close the
  // browser's tab or window outside full screen, so the browser asks first.
  useEffect(() => {
    if (!running) return
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // older browsers ask only when this is set
      event.returnValue = true
    }
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [running])

  const change = (id: string, patch: Partial<WindowState>) =>
    setWindows((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  const focus = (id: string) =>
    setWindows((list) => {
      const win = list.find((w) => w.id === id)
      if (!win || win.z === top.current) return list
      top.current += 1
      return list.map((w) => (w.id === id ? { ...w, z: top.current } : w))
    })
  const close = (id: string) => setWindows((list) => list.filter((w) => w.id !== id))
  // what each window calls to change its title; the same function for as long as the window is open
  const windowIds = windows.map((w) => w.id).join(' ')
  const titleSetters = useMemo(
    () =>
      Object.fromEntries(
        windowIds
          .split(' ')
          .map((id) => [id, (title: string) => setTitles((all) => (all[id] === title ? all : { ...all, [id]: title }))])
      ) as Record<string, (title: string) => void>,
    [windowIds]
  )

  // F11 in a terminal: the window fills the screen, and the browser shows nothing but the desktop.
  // There, the keys browsers keep for themselves (Ctrl+Shift+T, Ctrl+Shift+W...) reach the box.
  // F11 again puts both back.
  const fullscreen = (id: string) => {
    if (document.fullscreenElement) {
      change(id, { max: false, min: false })
      void document.exitFullscreen?.()
      return
    }
    change(id, { max: true, min: false })
    desktop.current
      ?.requestFullscreen?.()
      .then(() => (navigator as Navigator & { keyboard?: { lock?: () => Promise<void> } }).keyboard?.lock?.())
      .catch(() => {})
  }

  const act = async (call: () => Promise<BoxView>) => {
    setBusy(true)
    try {
      await mutate(await call(), { revalidate: false })
      return true
    } catch (failure) {
      showErrorMsg(failure, t)
      return false
    } finally {
      setBusy(false)
    }
  }
  // the terminal opens by itself once the box runs (above)
  const start = async () => {
    await act(boxApi.start)
  }
  const stop = () => {
    if (window.confirm(t('range.box.stop_confirm'))) void act(boxApi.stop)
  }

  const showPicture = (source: PictureSource) => {
    setPicture(source)
    open('stego')
  }

  const frontmost = windows
    .filter((w) => !w.min)
    .reduce<WindowState | null>((best, w) => (!best || w.z > best.z ? w : best), null)

  const titleOf = (win: WindowState) => {
    if (win.app === 'terminal') return `udsmcyberrange@${view?.player ?? 'player'}: ~`
    return titles[win.id] || t(`range.box.app.${win.app}`)
  }

  // what a window holds
  const content = (win: WindowState) => {
    if (win.app === 'terminal') {
      return (
        <>
          <TerminalApp
            running={running}
            onClose={() => close(win.id)}
            onNewWindow={() => open('terminal', { fresh: true })}
            onFullscreen={() => fullscreen(win.id)}
          />
          {!running && (
            <div className={classes.notice}>
              <ClubLogo />
              <h3>{signedOut ? t('range.box.signed_out') : t('range.box.off')}</h3>
              <p>{signedOut ? t('range.box.signed_out_hint') : t('range.box.off_hint')}</p>
              {signedOut ? (
                <a className={classes.button} data-tone="primary" data-size="lg" href="/account/login?from=/attackbox">
                  {t('range.box.sign_in')}
                </a>
              ) : (
                <button
                  type="button"
                  className={classes.button}
                  data-tone="gold"
                  data-size="lg"
                  onClick={() => void start()}
                  disabled={busy || !view}
                >
                  <Uicon name="power" />
                  {busy ? t('range.box.starting') : t('range.box.start')}
                </button>
              )}
            </div>
          )}
        </>
      )
    }
    if (win.app === 'files') {
      return (
        <BoxFiles
          running={running}
          limit={view?.fileLimit ?? 25}
          start={win.path ?? BOX_HOME}
          onOpenPicture={(path) => showPicture({ kind: 'box', path })}
          onTitle={titleSetters[win.id]!}
          onClose={() => close(win.id)}
        />
      )
    }
    if (win.app === 'browser' || win.app === 'burp') {
      return (
        <BoxRemoteApp
          app={win.app}
          running={running}
          enabled={view?.browser ?? false}
          active={frontmost?.id === win.id}
          onFullscreen={() => fullscreen(win.id)}
        />
      )
    }
    if (win.app === 'stego') return <StegoViewer running={running} source={picture} onSource={setPicture} />
    if (win.app === 'cyberchef') {
      return view?.cyberchef ? (
        <iframe className={classes.frame} src={view.cyberchef} title="CyberChef" />
      ) : (
        <div className={classes.notice}>
          <img src={Icons.cyberchef} alt="" />
          <p>{t('range.box.cyberchef_missing')}</p>
        </div>
      )
    }
    return (
      <div className={classes.help}>
        {(['target', 'tools', 'terminal', 'files', 'browser', 'burp', 'install', 'time'] as const).map((part) => (
          <div key={part}>
            <h3>{t(`range.box.help.${part}.title`)}</h3>
            <div>{t(`range.box.help.${part}.text`)}</div>
            {part === 'tools' && <BoxCommands />}
          </div>
        ))}
      </div>
    )
  }

  const appsMenu: MenuItem[] = [
    ...LAUNCHERS.map((app) => ({
      label: t(`range.box.app.${app}`),
      onSelect: () => open(app, { fresh: true }),
    })),
    { label: t('range.box.app.help'), onSelect: () => open('help') },
    'separator',
    running
      ? { label: t('range.box.stop'), onSelect: stop }
      : { label: t('range.box.start'), disabled: busy || !view || signedOut, onSelect: () => void start() },
  ]

  return (
    <div ref={desktop} className={classes.desktop}>
      <div className={classes.panel}>
        <button
          type="button"
          className={classes.panelLogo}
          title={t('range.box.applications')}
          aria-label={t('range.box.applications')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect()
            setAppsAt(appsAt ? null : { x: box.left, y: box.bottom + 2 })
          }}
        >
          <ClubLogo />
        </button>
        {LAUNCHERS.map((app) => (
          <button
            key={app}
            type="button"
            className={classes.launcher}
            title={t(`range.box.app.${app}`)}
            aria-label={t(`range.box.app.${app}`)}
            onClick={() => open(app, { fresh: true })}
          >
            <img src={APPS[app].image} alt="" />
          </button>
        ))}
        <div className={classes.panelSep} />
        <div className={classes.tasks}>
          {windows.map((win) => (
            <button
              key={win.id}
              type="button"
              className={classes.task}
              data-active={(frontmost?.id === win.id && !win.min) || undefined}
              title={titleOf(win)}
              onClick={() => {
                if (frontmost?.id === win.id && !win.min) change(win.id, { min: true })
                else {
                  change(win.id, { min: false })
                  focus(win.id)
                }
              }}
            >
              <img src={APPS[win.app].image} alt="" />
              <span>{titleOf(win)}</span>
            </button>
          ))}
        </div>
        <div className={classes.panelRight}>
          <span
            className={classes.panelItem}
            data-strong={view?.target ? true : undefined}
            title={t('range.box.target_hint')}
          >
            <Uicon name="target" />
            {view?.target ? t('range.box.target', { title: view.target.title }) : t('range.box.no_target')}
          </span>
          <span className={classes.panelItem} data-strong>
            <span className={classes.dot} data-on={running || undefined} />
            {view?.box ? t('range.box.left', { time: left(view.box.expiresAt, now) }) : t('range.box.state_off')}
          </span>
          {view?.box?.canExtend && (
            <button type="button" className={classes.button} onClick={() => void act(boxApi.extend)} disabled={busy}>
              <Uicon name="time-add" />
              {t('range.box.extend')}
            </button>
          )}
          {running ? (
            <button type="button" className={classes.button} data-tone="danger" onClick={stop} disabled={busy}>
              <Uicon name="power" />
              {t('range.box.stop')}
            </button>
          ) : (
            <button
              type="button"
              className={classes.button}
              data-tone="gold"
              onClick={() => void start()}
              disabled={busy || !view || signedOut}
            >
              <Uicon name="power" />
              {t('range.box.start')}
            </button>
          )}
          <span className={`${classes.panelItem} ${classes.mono}`} data-strong>
            {new Date(now).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div ref={area} className={classes.area}>
        <div className={classes.wallpaper}>
          <div className={classes.mark}>
            <ClubLogo />
            <div className={classes.wordbox}>UDSM CyberRange</div>
          </div>
          {!running && (view || signedOut) && (
            <div className={classes.power}>
              <p>{signedOut ? t('range.box.signed_out_hint') : t('range.box.off_hint')}</p>
              {signedOut ? (
                <a className={classes.button} data-tone="primary" data-size="lg" href="/account/login?from=/attackbox">
                  {t('range.box.sign_in')}
                </a>
              ) : (
                <button
                  type="button"
                  className={classes.button}
                  data-tone="gold"
                  data-size="lg"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  <Uicon name="power" />
                  {busy ? t('range.box.starting') : t('range.box.start')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={classes.icons}>
          <DesktopIcon
            image={Icons.home}
            label={t('range.box.desktop.home')}
            onOpen={() => open('files', { fresh: true, path: BOX_HOME })}
          />
          <DesktopIcon
            image={Icons.drive}
            label={t('range.box.files.file_system')}
            onOpen={() => open('files', { fresh: true, path: '/' })}
          />
          {(['terminal', 'browser', 'burp', 'cyberchef', 'stego', 'help'] as const).map((app) => (
            <DesktopIcon
              key={app}
              image={APPS[app].image}
              label={t(`range.box.app.${app}`)}
              onOpen={() => open(app, { fresh: true })}
            />
          ))}
          {lab && (
            <DesktopIcon
              image={Icons.science}
              label={t('range.box.app.lab')}
              onOpen={() => window.open(`/labs/${lab}`, '_blank', 'noopener')}
            />
          )}
        </div>

        {windows.map((win) => (
          <Window
            key={win.id}
            win={{ ...win, title: titleOf(win) }}
            bounds={bounds}
            active={frontmost?.id === win.id}
            icon={APPS[win.app].image}
            onChange={(patch) => change(win.id, patch)}
            onFocus={() => focus(win.id)}
            onClose={() => close(win.id)}
          >
            {content(win)}
          </Window>
        ))}
      </div>

      <ContextMenu at={appsAt} items={appsMenu} onClose={() => setAppsAt(null)} />
    </div>
  )
}

export default AttackBoxPage
