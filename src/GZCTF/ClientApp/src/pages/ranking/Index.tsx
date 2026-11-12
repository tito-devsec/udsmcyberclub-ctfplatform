import { Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { PlaceMedal, PlayerAvatar, VerifiedTick } from '@Components/range/Community'
import { Note, PoweredBy, Xp } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { RankEmblem, RankTitle } from '@Components/range/RankCard'
import { ago, countryName, profileUrl, RankingEntry, RankingScope, shortDate, useRanking } from '@Utils/Community'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

const SCOPES: RankingScope[] = ['hall', 'week', 'all']
const SIZES = ['10', '25', '50', '100']

const inputStyles = {
  input: {
    height: 44,
    border: 0,
    fontWeight: 600,
    color: 'var(--r-text)',
    background: 'var(--r-raised)',
  },
}

// One of the top three, on the podium.
const PodiumPlace: FC<{ entry: RankingEntry }> = ({ entry }) => {
  const { t, i18n } = useTranslation()
  return (
    <Link
      to={profileUrl(entry.name)}
      className={classes.podiumCol}
      data-place={entry.position}
      data-me={entry.me || undefined}
    >
      <PlaceMedal place={entry.position} size={entry.position === 1 ? 56 : 46} />
      <PlayerAvatar
        name={entry.name}
        avatar={entry.avatar}
        className={classes.podiumAvatar}
        style={{ fontSize: '2rem' }}
      />
      <span className={classes.podiumName}>
        {entry.name}
        {entry.verified && <VerifiedTick size={18} />}
      </span>
      <RankTitle rank={entry.rankIndex} name={entry.rank} />
      <span className={classes.podiumScore}>{entry.xp.toLocaleString(i18n.language)} XP</span>
      <span className={range.dim}>{t('range.ranking.tasks_done', { count: entry.tasks })}</span>
    </Link>
  )
}

// A row of the list under the podium.
const Row: FC<{ entry: RankingEntry }> = ({ entry }) => {
  const { i18n } = useTranslation()
  return (
    <tr data-me={entry.me || undefined}>
      <td>
        <span className={classes.place} data-place={entry.position}>
          {entry.position}
        </span>
      </td>
      <td>
        <Link to={profileUrl(entry.name)} className={classes.player}>
          <PlayerAvatar name={entry.name} avatar={entry.avatar} className={classes.playerAvatar} />
          <span className={classes.playerName}>
            {entry.name}
            {entry.verified && <VerifiedTick size={15} />}
          </span>
          <RankTitle rank={entry.rankIndex} name={entry.rank} className={classes.playerRank} />
        </Link>
      </td>
      <td>
        <span className={classes.score}>
          <Xp value={entry.xp} />
        </span>
      </td>
      <td>
        <Tooltip label={new Date(entry.lastActive).toLocaleString(i18n.language)} withArrow openDelay={300}>
          <span>{ago(entry.lastActive, i18n.language)}</span>
        </Tooltip>
      </td>
      <td>{entry.tasks}</td>
      <td>
        <RankEmblem rank={entry.rankIndex} size={34} title={entry.rank} />
      </td>
      <td>{entry.country ? countryName(entry.country, i18n.language) : '-'}</td>
    </tr>
  )
}

// The ranking: last week's Hall of Fame, this week so far, and everyone by all their points.
// Each has its top three on a podium and everyone after them in a list.
const RankingPage: FC = () => {
  const { t, i18n } = useTranslation()
  const [scope, setScope] = useState<RankingScope>('hall')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search.trim(), 300)

  const { data, error } = useRanking(scope, page, size, query)
  // what is on screen may still be the list that was open before this one
  const ranking = data?.scope === scope ? data : undefined

  usePageTitle(t('range.ranking.title'))

  // on the podium the winner stands in the middle
  const steps = ranking
    ? [ranking.podium[1], ranking.podium[0], ranking.podium[2]].filter((entry): entry is RankingEntry => Boolean(entry))
    : []
  const pages = ranking ? Math.max(1, Math.ceil(ranking.matched / ranking.size)) : 1

  return (
    <RangePage isLoading={!ranking && !error}>
      <div className={cx(range.container, range.page)}>
        <div className={range.sectionHead} style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className={range.headingIcon}>
              <Uicon name="leaderboard-trophy" />
            </span>
            <div>
              <h1 className={range.pageTitle} style={{ fontSize: '2.4rem' }}>
                {t(`range.ranking.heading.${scope}`)}
              </h1>
              <p className={range.lead} style={{ marginTop: 4 }}>
                {ranking?.period
                  ? t(`range.ranking.period.${scope}`, {
                      start: shortDate(ranking.period.start, i18n.language),
                      end: shortDate(ranking.period.end, i18n.language),
                    })
                  : t('range.ranking.period.all')}
              </p>
            </div>
          </div>
          {ranking && scope !== 'all' && (
            <div className={range.tile} style={{ textAlign: 'right' }}>
              <div className={range.tileLabel}>{t('range.ranking.next')}</div>
              <div className={range.tileValue}>{ago(ranking.nextUpdate, i18n.language)}</div>
            </div>
          )}
        </div>

        <div className={range.pills} style={{ marginBottom: 28 }}>
          {SCOPES.map((item) => (
            <button
              key={item}
              type="button"
              className={range.pill}
              data-active={scope === item || undefined}
              onClick={() => {
                setScope(item)
                setPage(1)
                setSearch('')
              }}
            >
              {t(`range.ranking.tab.${item}`)}
            </button>
          ))}
        </div>

        {error && (
          <Note tone="warn" icon="triangle-warning">
            {error.message}
          </Note>
        )}

        {ranking && steps.length === 0 && (
          <div className={cx(range.card, range.empty)}>{t(`range.ranking.empty.${scope}`)}</div>
        )}

        {ranking && steps.length > 0 && (
          <div style={{ display: 'grid', gap: 28 }}>
            <div className={classes.podium}>
              {steps.map((entry) => (
                <PodiumPlace key={entry.name} entry={entry} />
              ))}
            </div>

            {/* with no more than three people, everyone is on the podium */}
            {ranking.total > 3 && (
              <div className={classes.tools}>
                <Select
                  w={190}
                  aria-label={t('range.ranking.size')}
                  data={SIZES.map((value) => ({
                    value,
                    label: t('range.ranking.per_page', { count: Number(value) }),
                  }))}
                  value={String(size)}
                  onChange={(value) => {
                    if (!value) return
                    setSize(Number(value))
                    setPage(1)
                  }}
                  allowDeselect={false}
                  styles={inputStyles}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {ranking.me && (
                    <span className={range.chip} style={{ cursor: 'default' }}>
                      {t('range.ranking.you', { position: ranking.me.position })}
                    </span>
                  )}
                  <TextInput
                    w={300}
                    placeholder={t('range.ranking.search')}
                    aria-label={t('range.ranking.search')}
                    leftSection={<Uicon name="search" />}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.currentTarget.value)
                      setPage(1)
                    }}
                    styles={inputStyles}
                  />
                </div>
              </div>
            )}

            {ranking.entries.length > 0 && (
              <div className={classes.tableWrap}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th>{t('range.ranking.column.rank')}</th>
                      <th>{t('range.ranking.column.player')}</th>
                      <th>{t('range.ranking.column.score')}</th>
                      <th>{t('range.ranking.column.active')}</th>
                      <th>{t('range.ranking.column.tasks')}</th>
                      <th>{t('range.ranking.column.badge')}</th>
                      <th>{t('range.ranking.column.country')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.entries.map((entry) => (
                      <Row key={entry.name} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ranking.entries.length === 0 && query && (
              <div className={cx(range.card, range.empty)}>{t('range.ranking.empty.search')}</div>
            )}

            {pages > 1 && (
              <div className={classes.pager}>
                <span>{t('range.ranking.page', { page: ranking.page, pages })}</span>
                <div className={range.footActions}>
                  <button
                    type="button"
                    className={range.button}
                    data-variant="subtle"
                    disabled={ranking.page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <Uicon name="arrow-left" />
                    {t('range.section.previous')}
                  </button>
                  <button
                    type="button"
                    className={range.button}
                    data-variant="subtle"
                    disabled={ranking.page >= pages}
                    onClick={() => setPage(page + 1)}
                  >
                    {t('range.section.next')}
                    <Uicon name="arrow-right" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default RankingPage
