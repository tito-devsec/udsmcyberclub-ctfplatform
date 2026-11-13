import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { MainIcon } from '@Components/icon/MainIcon'
import { BoxFiles } from '@Components/range/box/Files'
import { PictureSource, StegoViewer } from '@Components/range/box/Stego'
import { BoxTerminal } from '@Components/range/box/Terminal'
import { AppName, Window, WindowState } from '@Components/range/box/Window'
import { boxApi, BoxView, useBox } from '@Utils/AttackBox'
import { formatMinutes } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { useConfig } from '@Hooks/useConfig'
import { usePageTitle } from '@Hooks/usePageTitle'
import { useUser } from '@Hooks/useUser'
import classes from '@Styles/AttackBox.module.css'
import cyberchefIcon from '../../assets/attackbox/cyberchef.png'
import helpIcon from '../../assets/attackbox/help.svg'
import homeIcon from '../../assets/attackbox/home.svg'
import viewerIcon from '../../assets/attackbox/image-viewer.svg'
import labIcon from '../../assets/attackbox/science.svg'
import terminalIcon from '../../assets/attackbox/terminal.svg'

// The desktop's apps: their icon (Kali's own, from its Flat Remix theme, and CyberChef's), the
// size they open at, and whether more than one may be open.
const APPS: Record<AppName, { image: string; w: number; h: number; many?: boolean }> = {
  terminal: { image: terminalIcon, w: 920, h: 620, many: true },
  files: { image: homeIcon, w: 780, h: 500 },
  cyberchef: { image: cyberchefIcon, w: 1180, h: 680 },
  stego: { image: viewerIcon, w: 960, h: 640 },
  help: { image: helpIcon, w: 640, h: 560 },
}
const ORDER: AppName[] = ['terminal', 'files', 'cyberchef', 'stego', 'help']

// The club's own logo, as set on the platform.
const ClubLogo: FC = () => {
  const { config } = useConfig()
  return config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />
}

// "1h 52m", from now until then
const left = (until: string, now: number) => formatMinutes(Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000)))

// The attack box: a desktop in the browser, branded with the club's logo, with a terminal in
// the student's own Kali box, its files, CyberChef, a picture viewer and help.
const AttackBoxPage: FC = () => {
  const { t, i18n } = useTranslation()
  const { error: signInError } = useUser()
  const { data: view, mutate } = useBox()
  const [windows, setWindows] = useState<WindowState[]>([])
  const [picture, setPicture] = useState<PictureSource | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
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

  const bounds = useCallback(
    () => ({ width: area.current?.clientWidth ?? 1200, height: area.current?.clientHeight ?? 700 }),
    []
  )

  const open = useCallback(
    (app: AppName, fresh = false) =>
      setWindows((list) => {
        const found = [...list].reverse().find((w) => w.app === app)
        if (found && (!APPS[app].many || !fresh)) {
          top.current += 1
          return list.map((w) => (w.id === found.id ? { ...w, min: false, z: top.current } : w))
        }
        const { width, height } = bounds()
        const w = Math.min(APPS[app].w, width - 140)
        const h = Math.min(APPS[app].h, height - 110)
        const step = list.length * 26
        top.current += 1
        return [
          ...list,
          {
            id: `${app}-${Date.now()}`,
            app,
            title: '',
            x: Math.max(116, Math.min((width - w) / 2 + step - 40, width - w - 10)),
            y: Math.max(8, Math.min((height - h) / 2 - 40 + step, height - h - 70)),
            w,
            h,
            z: top.current,
            min: false,
            max: false,
          },
        ]
      }),
    [bounds]
  )

  // a terminal is open when the desktop shows a running box
  useEffect(() => {
    if (view?.box && !opened.current) {
      opened.current = true
      open('terminal')
    }
  }, [view, open])

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
  const start = async () => {
    if (await act(boxApi.start)) open('terminal')
  }
  const stop = () => {
    if (window.confirm(t('range.box.stop_confirm'))) void act(boxApi.stop)
  }

  const showPicture = (source: PictureSource) => {
    setPicture(source)
    open('stego')
  }

  const titleOf = (win: WindowState) => {
    if (win.app !== 'terminal') return t(`range.box.app.${win.app}`)
    const terminals = windows.filter((w) => w.app === 'terminal')
    const number = terminals.length > 1 ? ` (${terminals.indexOf(win) + 1})` : ''
    return `udsmcyberrange@${view?.player ?? 'player'}: ~${number}`
  }

  // what a window holds
  const content = (win: WindowState) => {
    if (win.app === 'terminal') {
      return (
        <>
          <BoxTerminal running={running} />
          {!running && (
            <div className={classes.notice}>
              <ClubLogo />
              <h3>{signedOut ? t('range.box.signed_out') : t('range.box.off')}</h3>
              <p>{signedOut ? t('range.box.signed_out_hint') : t('range.box.off_hint')}</p>
              {signedOut ? (
                <a
                  className={classes.button}
                  data-tone="primary"
                  data-size="lg"
                  href={`/account/login?from=/attackbox`}
                >
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
          onOpenPicture={(path) => showPicture({ kind: 'box', path })}
        />
      )
    }
    if (win.app === 'stego') return <StegoViewer running={running} source={picture} onSource={setPicture} />
    if (win.app === 'cyberchef') {
      return view?.cyberchef ? (
        <iframe className={classes.frame} src={view.cyberchef} title="CyberChef" />
      ) : (
        <div className={classes.notice}>
          <img src={cyberchefIcon} alt="" />
          <p>{t('range.box.cyberchef_missing')}</p>
        </div>
      )
    }
    return (
      <div className={classes.help}>
        {(['target', 'files', 'tools', 'install', 'copy', 'time'] as const).map((part) => (
          <div key={part}>
            <h3>{t(`range.box.help.${part}.title`)}</h3>
            <div>{t(`range.box.help.${part}.text`)}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={classes.desktop}>
      <div className={classes.panel}>
        <a className={classes.brand} href="/" target="_blank" rel="noreferrer">
          <ClubLogo />
          <div>
            UDSM Cyber<span>Range</span>
          </div>
        </a>
        {ORDER.map((app) => (
          <button key={app} type="button" className={classes.panelItem} onClick={() => open(app, app === 'terminal')}>
            {t(`range.box.app.${app}`)}
          </button>
        ))}
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
          {ORDER.map((app) => (
            <button key={app} type="button" className={classes.icon} onClick={() => open(app, app === 'terminal')}>
              <img src={APPS[app].image} alt="" />
              {t(`range.box.app.${app}`)}
            </button>
          ))}
          {view?.target?.lab && (
            <a className={classes.icon} href={`/labs/${view.target.lab}`} target="_blank" rel="noreferrer">
              <img src={labIcon} alt="" />
              {t('range.box.app.lab')}
            </a>
          )}
        </div>

        {windows.map((win) => (
          <Window
            key={win.id}
            win={{ ...win, title: titleOf(win) }}
            icon={APPS[win.app].image}
            bounds={bounds}
            onChange={(patch) => change(win.id, patch)}
            onFocus={() => focus(win.id)}
            onClose={() => close(win.id)}
          >
            {content(win)}
          </Window>
        ))}

        <nav className={classes.dock} aria-label={t('range.box.dock')}>
          {ORDER.map((app) => (
            <button
              key={app}
              type="button"
              className={classes.dockItem}
              data-open={windows.some((w) => w.app === app) || undefined}
              onClick={() => open(app)}
              title={t(`range.box.app.${app}`)}
              aria-label={t(`range.box.app.${app}`)}
            >
              <img src={APPS[app].image} alt="" />
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default AttackBoxPage
