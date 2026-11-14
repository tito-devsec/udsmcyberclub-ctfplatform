import { Select, TextInput } from '@mantine/core'
import cx from 'clsx'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { LabCard } from '@Components/range/Community'
import { Note, PoweredBy, ProgressBar } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { RankEmblem } from '@Components/range/RankCard'
import { LAB_CATEGORIES, profileUrl, useLabs } from '@Utils/Community'
import { Category, CategoryIcon, categoryStyle, DIFFICULTIES, ModuleStatus, useMe } from '@Utils/Range'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

const STATUSES: ModuleStatus[] = ['new', 'started', 'completed']

const inputStyles = {
  input: {
    height: 44,
    border: 0,
    fontWeight: 600,
    color: 'var(--r-text)',
    background: 'var(--r-raised)',
  },
}

// Labs: machines and challenges to solve on your own, by category.
const Labs: FC = () => {
  const { t } = useTranslation()
  const { data: me, signedIn } = useMe()
  const { data: labs, error } = useLabs()
  const [params, setParams] = useSearchParams()
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  usePageTitle(t('range.nav.labs'))

  // the category, or boot to root, is in the address, so that it can be linked to
  const category = LAB_CATEGORIES.find((c) => c === params.get('category')) ?? null
  const b2r = !category && params.get('type') === 'b2r'
  const pick = (next: Category | null) => setParams(next ? { category: next } : {}, { replace: true })
  const pickB2r = () => setParams({ type: 'b2r' }, { replace: true })

  const counts = useMemo(() => {
    const map = new Map<Category, number>()
    for (const lab of labs ?? []) map.set(lab.category, (map.get(lab.category) ?? 0) + 1)
    return map
  }, [labs])
  const machines = labs?.filter((lab) => lab.kind === 'b2r').length ?? 0

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase()
    return (labs ?? []).filter(
      (lab) =>
        (!category || lab.category === category) &&
        (!b2r || lab.kind === 'b2r') &&
        (!difficulty || lab.difficulty === difficulty) &&
        (!status || lab.status === status) &&
        (!words || lab.title.toLowerCase().includes(words) || lab.summary.toLowerCase().includes(words))
    )
  }, [labs, category, b2r, difficulty, status, search])

  const solved = labs?.filter((lab) => lab.status === 'completed').length ?? 0

  return (
    <RangePage isLoading={!labs && !error}>
      <div className={cx(range.container, range.page)}>
        <div className={classes.labsLayout}>
          <aside className={classes.side}>
            {me && (
              <Link to={profileUrl(me.name)} className={classes.sideRank}>
                <RankEmblem rank={me.rankIndex} size={52} title={me.rank} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{me.rank}</div>
                  <div className={cx(range.small, range.dim, range.mono)} style={{ marginBottom: 6 }}>
                    {t('range.rank.level_short')} {me.level}
                  </div>
                  <ProgressBar
                    value={Math.round(((me.xp - me.levelStart) / (me.nextLevel - me.levelStart)) * 100)}
                    size="sm"
                  />
                </div>
              </Link>
            )}

            <div className={range.card}>
              <div className={classes.sideTitle}>{t('range.lab.categories')}</div>
              <div className={classes.categoryList}>
                <button
                  type="button"
                  className={classes.categoryItem}
                  data-active={(!category && !b2r) || undefined}
                  onClick={() => pick(null)}
                >
                  <Uicon name="flask" />
                  {t('range.lab.all')}
                  <span className={classes.categoryCount}>{labs?.length ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={classes.categoryItem}
                  data-active={b2r || undefined}
                  data-empty={!machines || undefined}
                  onClick={pickB2r}
                >
                  <Uicon name="skull" />
                  {t('range.lab.kind.b2r')}
                  <span className={classes.categoryCount}>{machines}</span>
                </button>
                {LAB_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={classes.categoryItem}
                    data-active={category === c || undefined}
                    data-empty={!counts.get(c) || undefined}
                    data-cat={c}
                    style={categoryStyle(c)}
                    onClick={() => pick(c)}
                  >
                    <Uicon name={CategoryIcon[c]} />
                    {t(`range.category.${c}`)}
                    <span className={classes.categoryCount}>{counts.get(c) ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main style={{ minWidth: 0 }}>
            <h1 className={range.pageTitle}>
              {category ? t(`range.category.${category}`) : b2r ? t('range.lab.kind.b2r') : t('range.nav.labs')}
            </h1>
            <p className={range.lead} style={{ marginTop: 12 }}>
              {b2r ? t('range.lab.b2r_lead') : t('range.lab.lead')}
            </p>

            <div className={range.filters} style={{ marginTop: 28 }}>
              <Select
                w={170}
                placeholder={t('range.filter.difficulty')}
                aria-label={t('range.filter.difficulty')}
                data={DIFFICULTIES.map((d) => ({ value: d, label: t(`range.difficulty.${d}`) }))}
                value={difficulty}
                onChange={setDifficulty}
                styles={inputStyles}
              />
              {signedIn && (
                <Select
                  w={170}
                  placeholder={t('range.filter.status')}
                  aria-label={t('range.filter.status')}
                  data={STATUSES.map((s) => ({ value: s, label: t(`range.lab.status.${s}`) }))}
                  value={status}
                  onChange={setStatus}
                  styles={inputStyles}
                />
              )}
              <TextInput
                w={260}
                placeholder={t('range.lab.search')}
                aria-label={t('range.lab.search')}
                leftSection={<Uicon name="search" />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                styles={inputStyles}
              />
            </div>

            {error && (
              <div style={{ marginTop: 28 }}>
                <Note tone="warn" icon="triangle-warning">
                  {error.message}
                </Note>
              </div>
            )}

            {labs && (
              <>
                <div className={range.between} style={{ margin: '36px 0 20px' }}>
                  <h2 className={range.sectionTitle} style={{ fontSize: '1.4rem' }}>
                    {t('range.lab.count', { count: shown.length })}
                  </h2>
                  {signedIn && (
                    <span className={range.dim}>{t('range.lab.solved_of', { solved, total: labs.length })}</span>
                  )}
                </div>
                {shown.length > 0 ? (
                  <div className={classes.labGrid}>
                    {shown.map((lab) => (
                      <LabCard key={lab.slug} lab={lab} />
                    ))}
                  </div>
                ) : (
                  <div className={cx(range.card, range.empty)}>
                    {(category && !counts.get(category)) || (b2r && !machines)
                      ? t('range.lab.coming')
                      : t('range.lab.empty')}
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default Labs
