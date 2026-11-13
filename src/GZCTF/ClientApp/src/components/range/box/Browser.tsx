import { FC, FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { MainIcon } from '@Components/icon/MainIcon'
import { useConfig } from '@Hooks/useConfig'
import classes from '@Styles/AttackBox.module.css'
import { Icons, Sym } from './icons'

// Places worth having at hand. Some sites refuse to be shown inside another page: those open in a
// tab of the student's own browser instead (checked when this list was made).
const SHORTCUTS = [
  { title: 'GTFOBins', url: 'https://gtfobins.org/' },
  { title: 'OWASP Cheat Sheets', url: 'https://cheatsheetseries.owasp.org/' },
  { title: 'LOLBAS', url: 'https://lolbas-project.github.io/' },
  { title: 'explainshell', url: 'https://explainshell.com/' },
  { title: 'Reverse Shell Generator', url: 'https://www.revshells.com/' },
  { title: 'Wikipedia', url: 'https://en.wikipedia.org/' },
  { title: 'Kali Tools', url: 'https://www.kali.org/tools/' },
  { title: 'HackTricks', url: 'https://hacktricks.wiki/' },
  { title: 'Exploit-DB', url: 'https://www.exploit-db.com/' },
  { title: 'CrackStation', url: 'https://crackstation.net/' },
]

// sites that refuse to be shown inside another page
const OWN_TAB = [
  'kali.org',
  'hacktricks.wiki',
  'exploit-db.com',
  'crackstation.net',
  'duckduckgo.com',
  'google.com',
  'bing.com',
  'github.com',
  'portswigger.net',
  'youtube.com',
]

const ownTab = (url: string) => {
  try {
    const host = new URL(url).hostname
    return OWN_TAB.some((site) => host === site || host.endsWith(`.${site}`))
  } catch {
    return true
  }
}

const openOutside = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
const search = (words: string) => openOutside(`https://duckduckgo.com/?q=${encodeURIComponent(words)}`)

// What was typed in the address bar: an address to show, or words to search the web for.
function addressOf(typed: string): string | null {
  const text = typed.trim()
  if (/^https?:\/\//i.test(text)) return text
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/\S*)?$/i.test(text)) return `http://${text}`
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(text)) return `https://${text}`
  return null
}

interface Tab {
  id: string
  // the pages seen in this tab, null being the start page
  pages: (string | null)[]
  at: number
  // bumped to load the page again
  nonce: number
}

let counter = 0
const newTab = (url: string | null = null): Tab => ({
  id: `web-${Date.now()}-${++counter}`,
  pages: [url],
  at: 0,
  nonce: 0,
})

interface BoxBrowserProps {
  // the student's lab machine, as their own browser reaches it
  target: { title: string; entry: string } | null
  cyberchef: string | null
  onTitle: (title: string) => void
}

// A web browser window: tabs, back, forward, reload, home and an address bar. Pages show inside the
// window when their site allows it, and in a tab of the student's own browser when it does not.
// It is not a browser inside the box: the box itself has no internet.
export const BoxBrowser: FC<BoxBrowserProps> = ({ target, cyberchef, onTitle }) => {
  const { t } = useTranslation()
  const { config } = useConfig()
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [current, setCurrent] = useState(0)
  const [typed, setTyped] = useState<{ tab: string; text: string } | null>(null)

  const tab = tabs[Math.min(current, tabs.length - 1)]!
  const page = tab.pages[tab.at] ?? null
  const titleOf = (url: string | null) => {
    if (!url) return t('range.box.browser.start')
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }

  const title = `${titleOf(page)} - ${t('range.box.app.browser')}`
  useEffect(() => onTitle(title), [title, onTitle])

  const change = (patch: (tab: Tab) => Tab) =>
    setTabs((list) => list.map((each) => (each.id === tab.id ? patch(each) : each)))
  const visit = (url: string | null) => {
    setTyped(null)
    if (url && ownTab(url)) return openOutside(url)
    change((each) => ({ ...each, pages: [...each.pages.slice(0, each.at + 1), url], at: each.at + 1 }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = typed?.tab === tab.id ? typed.text : ''
    if (!text.trim()) return
    const url = addressOf(text)
    if (url) visit(url)
    else search(text)
  }

  const shortcuts = [
    ...(target ? [{ title: t('range.box.browser.lab', { title: target.title }), url: `http://${target.entry}/` }] : []),
    ...(cyberchef ? [{ title: 'CyberChef', url: cyberchef }] : []),
    ...SHORTCUTS,
  ]

  return (
    <div className={classes.browser}>
      <div className={classes.browserTabs} role="tablist">
        {tabs.map((each, index) => (
          <div
            key={each.id}
            role="tab"
            aria-selected={index === current}
            className={classes.browserTab}
            data-active={index === current || undefined}
            onPointerDown={() => setCurrent(index)}
          >
            <img src={Icons.browser} alt="" />
            <span>{titleOf(each.pages[each.at] ?? null)}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                className={classes.tabClose}
                aria-label={t('range.box.term.close_tab')}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setTabs((list) => list.filter((other) => other.id !== each.id))
                  setCurrent((at) => (at >= index ? Math.max(0, at - 1) : at))
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={classes.iconButton}
          aria-label={t('range.box.browser.new_tab')}
          onClick={() => {
            setTabs((list) => [...list, newTab()])
            setCurrent(tabs.length)
          }}
        >
          <Sym src={Icons.add} />
        </button>
      </div>

      <form className={classes.browserBar} onSubmit={submit}>
        <button
          type="button"
          className={classes.iconButton}
          disabled={tab.at === 0}
          onClick={() => change((each) => ({ ...each, at: each.at - 1 }))}
          aria-label={t('range.box.files.back')}
        >
          <Sym src={Icons.back} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          disabled={tab.at >= tab.pages.length - 1}
          onClick={() => change((each) => ({ ...each, at: each.at + 1 }))}
          aria-label={t('range.box.files.forward')}
        >
          <Sym src={Icons.forward} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          onClick={() => change((each) => ({ ...each, nonce: each.nonce + 1 }))}
          aria-label={t('range.box.files.reload')}
        >
          <Sym src={Icons.reload} size={18} />
        </button>
        <button
          type="button"
          className={classes.iconButton}
          onClick={() => visit(null)}
          aria-label={t('range.box.files.home')}
        >
          <Sym src={Icons.homeSymbolic} size={18} />
        </button>
        <input
          className={classes.address}
          value={typed?.tab === tab.id ? typed.text : (page ?? '')}
          placeholder={t('range.box.browser.address')}
          spellCheck={false}
          onChange={(event) => setTyped({ tab: tab.id, text: event.currentTarget.value })}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className={classes.iconButton}
          disabled={!page}
          onClick={() => page && openOutside(page)}
          title={t('range.box.browser.outside')}
          aria-label={t('range.box.browser.outside')}
        >
          <Uicon name="arrow-up-right-from-square" />
        </button>
      </form>

      {tabs.map((each, index) => {
        const url = each.pages[each.at] ?? null
        const shown = index === Math.min(current, tabs.length - 1)
        return url ? (
          <iframe
            key={`${each.id}-${each.at}-${each.nonce}`}
            className={classes.frame}
            style={{ display: shown ? 'block' : 'none' }}
            src={url}
            title={titleOf(url)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div key={`${each.id}-start`} className={classes.startPage} style={{ display: shown ? 'grid' : 'none' }}>
            <div className={classes.startBrand}>
              {config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />}
              <div>
                UDSM Cyber<span>Range</span>
              </div>
            </div>
            <form
              className={classes.startSearch}
              onSubmit={(event) => {
                event.preventDefault()
                const words = new FormData(event.currentTarget).get('q')
                if (typeof words === 'string' && words.trim()) search(words)
              }}
            >
              <Sym src={Icons.find} size={18} />
              <input name="q" className={classes.startInput} placeholder={t('range.box.browser.search')} />
            </form>
            <div className={classes.startTiles}>
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.url}
                  type="button"
                  className={classes.startTile}
                  onClick={() => visit(shortcut.url)}
                >
                  <span className={classes.startLetter}>{shortcut.title.slice(0, 1)}</span>
                  <span>{shortcut.title}</span>
                  {ownTab(shortcut.url) && <small>↗</small>}
                </button>
              ))}
            </div>
            <p className={classes.startNote}>{t('range.box.browser.note')}</p>
          </div>
        )
      })}
    </div>
  )
}
