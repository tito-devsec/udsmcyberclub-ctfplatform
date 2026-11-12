import { Button, SegmentedControl, Select, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import cx from 'clsx'
import { FC, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { CertificateKind, CertificateSheet } from '@Components/range/CertificateSheet'
import { Note, PoweredBy } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { SignatoriesCard } from '@Components/range/Signatories'
import { StatusChip } from '@Components/range/Studio'
import {
  certificateIcon,
  CertificateGame,
  gameCertificatesApi,
  gameFacts,
  shortDate,
  useCertificateGames,
  useSignatories,
} from '@Utils/Community'
import { formatMinutes, useMe, useModules, usePaths } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { studioUrl } from '@Utils/Studio'
import { usePageTitle } from '@Hooks/usePageTitle'
import community from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

// Certificates, for the superadmin: what each kind looks like before anyone receives one,
// the certificates of participation of every game, and who signs them all.
const CertificatesPage: FC = () => {
  const { t, i18n } = useTranslation()
  const { data: me, error: meError, known, signedIn } = useMe()
  const allowed = me?.role === 'superadmin'
  const { data: modules = [] } = useModules()
  const { data: paths = [] } = usePaths()
  const { data: games, mutate: mutateGames } = useCertificateGames(allowed)
  const { data: signatories = [] } = useSignatories(allowed)
  const [kind, setKind] = useState<CertificateKind>('module')
  const [subject, setSubject] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  // the date on a preview: today, as the page was opened
  const [today] = useState(() => new Date().toISOString())
  const preview = useRef<HTMLDivElement>(null)

  usePageTitle(t('range.certificates.title'))

  // printing from this page prints the preview alone
  useEffect(() => {
    document.documentElement.dataset.print = 'certificate'
    return () => {
      delete document.documentElement.dataset.print
    }
  }, [])

  const refused = known && (!signedIn || Boolean(meError) || (me && !allowed))
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  // the subjects to choose from, and the one chosen (the first, until one is)
  const options =
    kind === 'module'
      ? modules.map((m) => ({ value: m.slug, label: m.title }))
      : kind === 'path'
        ? paths.map((p) => ({ value: p.slug, label: p.title }))
        : (games ?? []).map((g) => ({ value: String(g.id), label: g.title }))
  const chosen = options.find((option) => option.value === subject)?.value ?? options[0]?.value ?? null
  const module = kind === 'module' ? modules.find((m) => m.slug === chosen) : undefined
  const path = kind === 'path' ? paths.find((p) => p.slug === chosen) : undefined
  const game = kind === 'game' ? games?.find((g) => String(g.id) === chosen) : undefined

  const sheet = module
    ? {
        title: module.title,
        summary: module.summary,
        facts: [
          t(`range.difficulty.${module.difficulty}`),
          t(`range.category.${module.category}`),
          formatMinutes(module.minutes),
        ].join(' · '),
        issuedAt: today,
        icon: certificateIcon({ kind: 'module', icon: module.icon, category: module.category }),
      }
    : path
      ? {
          title: path.title,
          summary: path.summary,
          facts: [
            t(`range.difficulty.${path.difficulty}`),
            t('range.count.modules', { count: path.moduleCount }),
            formatMinutes(path.minutes),
          ].join(' · '),
          issuedAt: today,
          icon: certificateIcon({ kind: 'path', icon: path.icon }),
        }
      : game
        ? {
            title: game.title,
            summary: game.summary || null,
            facts: gameFacts(
              { start: game.start, end: game.end, team: game.individual ? null : t('range.certificates.sample_team') },
              t,
              i18n.language
            ),
            issuedAt: game.end,
            icon: certificateIcon({ kind: 'game', icon: null }),
          }
        : null

  const show = (target: CertificateGame) => {
    setKind('game')
    setSubject(String(target.id))
    preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const issue = async (target: CertificateGame) => {
    if (!window.confirm(t('range.certificates.issue_confirm', { title: target.title }))) return
    setBusy(target.id)
    try {
      const result = await gameCertificatesApi.issue(target.id)
      showNotification({
        color: 'teal',
        message: t('range.certificates.issued_note', { count: result.added, total: result.issued }),
      })
      await mutateGames()
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(null)
    }
  }

  return (
    <RangePage isLoading={!refused && !games}>
      <div className={cx(range.container, range.page)}>
        <Link
          to={studioUrl.home}
          className={cx(range.link, community.noPrint)}
          style={{ display: 'inline-block', marginBottom: 20 }}
        >
          {t('range.studio.back')}
        </Link>
        <div className={cx(range.sectionHead, community.noPrint)} style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className={range.headingIcon}>
              <Uicon name="diploma" />
            </span>
            <div>
              <h1 className={range.pageTitle} style={{ fontSize: '2.4rem' }}>
                {t('range.certificates.title')}
              </h1>
              <p className={range.lead} style={{ marginTop: 4, maxWidth: 820 }}>
                {t('range.certificates.lead')}
              </p>
            </div>
          </div>
        </div>

        {refused && (
          <Note tone="warn" icon="triangle-warning">
            {t('range.members.refused')}
          </Note>
        )}

        {allowed && games && (
          <div className={classes.form}>
            <section ref={preview} className={classes.panel} style={{ scrollMarginTop: 80 }}>
              <div className={cx(classes.panelHead, community.noPrint)}>
                <h2>{t('range.certificates.preview')}</h2>
                <Button
                  variant="default"
                  leftSection={<Uicon name="print" />}
                  disabled={!sheet}
                  onClick={() => window.print()}
                >
                  {t('range.certificate.print')}
                </Button>
              </div>
              <div className={cx(classes.row, community.noPrint)}>
                <SegmentedControl
                  value={kind}
                  onChange={(value) => {
                    setKind(value as CertificateKind)
                    setSubject(null)
                  }}
                  data={[
                    { value: 'module', label: t('range.certificates.kind.module') },
                    { value: 'path', label: t('range.certificates.kind.path') },
                    { value: 'game', label: t('range.certificates.kind.game') },
                  ]}
                />
                <Select
                  aria-label={t('range.certificates.subject')}
                  placeholder={t('range.certificates.subject')}
                  data={options}
                  value={chosen}
                  onChange={setSubject}
                  searchable
                  allowDeselect={false}
                  nothingFoundMessage={t('range.certificates.none')}
                />
                <TextInput
                  aria-label={t('range.certificates.name')}
                  placeholder={t('range.certificates.name')}
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </div>
              {sheet ? (
                <CertificateSheet
                  kind={kind}
                  name={name.trim() || t('range.certificates.sample_name')}
                  title={sheet.title}
                  summary={sheet.summary}
                  facts={sheet.facts}
                  issuedAt={sheet.issuedAt}
                  number={t('range.certificates.sample_number')}
                  address={`${origin}/certificates/…`}
                  signatories={signatories}
                  icon={sheet.icon}
                />
              ) : (
                <div className={cx(range.card, range.empty)}>{t('range.certificates.none')}</div>
              )}
            </section>

            <section className={cx(classes.panel, community.noPrint)}>
              <div className={classes.panelHead}>
                <h2>{t('range.certificates.games')}</h2>
              </div>
              <p className={range.dim} style={{ margin: 0, maxWidth: 820 }}>
                {t('range.certificates.games_lead')}
              </p>
              {games.length > 0 ? (
                <div className={community.tableWrap}>
                  <table className={community.table}>
                    <thead>
                      <tr>
                        <th>{t('range.studio.column.game')}</th>
                        <th>{t('range.certificates.column.dates')}</th>
                        <th>{t('range.studio.column.status')}</th>
                        <th>{t('range.certificates.column.issued')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {games.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className={community.playerName}>
                              <Uicon name="flag-alt" />
                              {item.title}
                            </span>
                          </td>
                          <td>
                            {shortDate(item.start, i18n.language)} – {shortDate(item.end, i18n.language)}
                          </td>
                          <td>
                            <StatusChip status={item.stage} />
                          </td>
                          <td>{item.issued}</td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <Button size="xs" variant="default" onClick={() => show(item)}>
                                {t('range.studio.preview')}
                              </Button>
                              <Button
                                size="xs"
                                loading={busy === item.id}
                                disabled={item.stage !== 'ended'}
                                title={item.stage !== 'ended' ? t('range.certificates.not_over') : undefined}
                                onClick={() => issue(item)}
                              >
                                {t(item.issued > 0 ? 'range.certificates.issue_again' : 'range.certificates.issue')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={cx(range.card, range.empty)}>{t('range.certificates.no_games')}</div>
              )}
            </section>

            <div className={community.noPrint}>
              <SignatoriesCard />
            </div>
          </div>
        )}

        <div className={community.noPrint}>
          <PoweredBy />
        </div>
      </div>
    </RangePage>
  )
}

export default CertificatesPage
