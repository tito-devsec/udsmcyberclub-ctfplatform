import { Select, TextInput } from '@mantine/core'
import cx from 'clsx'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { ModuleCard } from '@Components/range/Cards'
import { Note, PoweredBy } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { CATEGORIES, DIFFICULTIES, ModuleStatus, useMe, useModules } from '@Utils/Range'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Range.module.css'

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

// The catalogue: every module, narrowed down by category, difficulty, progress or a search.
const Modules: FC = () => {
  const { t } = useTranslation()
  const { signedIn } = useMe()
  const { data: modules, error } = useModules()
  const [category, setCategory] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  usePageTitle(t('range.nav.modules'))

  // only the categories that have a module, in their usual order
  const categories = useMemo(
    () => CATEGORIES.filter((c) => modules?.some((module) => module.category === c)),
    [modules]
  )

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase()
    return (modules ?? []).filter(
      (module) =>
        (!category || module.category === category) &&
        (!difficulty || module.difficulty === difficulty) &&
        (!status || module.status === status) &&
        (!words || module.title.toLowerCase().includes(words) || module.summary.toLowerCase().includes(words))
    )
  }, [modules, category, difficulty, status, search])

  const active = [
    category && { label: t(`range.category.${category}`), clear: () => setCategory(null) },
    difficulty && { label: t(`range.difficulty.${difficulty}`), clear: () => setDifficulty(null) },
    status && { label: t(`range.status.${status}`), clear: () => setStatus(null) },
    search.trim() && { label: `"${search.trim()}"`, clear: () => setSearch('') },
  ].filter((item): item is { label: string; clear: () => void } => Boolean(item))

  const clearAll = () => active.forEach((item) => item.clear())

  return (
    <RangePage isLoading={!modules && !error}>
      <div className={cx(classes.container, classes.page)}>
        <h1 className={classes.pageTitle}>{t('range.nav.modules')}</h1>
        <p className={classes.lead} style={{ marginTop: 12 }}>
          {t('range.catalogue.lead')}
        </p>

        <div className={classes.filters} style={{ marginTop: 32 }}>
          <Select
            w={210}
            placeholder={t('range.filter.category')}
            aria-label={t('range.filter.category')}
            data={categories.map((c) => ({ value: c, label: t(`range.category.${c}`) }))}
            value={category}
            onChange={setCategory}
            styles={inputStyles}
          />
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
              data={STATUSES.map((s) => ({ value: s, label: t(`range.status.${s}`) }))}
              value={status}
              onChange={setStatus}
              styles={inputStyles}
            />
          )}
          <TextInput
            w={240}
            placeholder={t('range.filter.search')}
            aria-label={t('range.filter.search')}
            leftSection={<Uicon name="search" />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            styles={inputStyles}
          />
        </div>

        {active.length > 0 && (
          <div className={classes.filters} style={{ alignItems: 'center', marginTop: 16 }}>
            {active.map((item) => (
              <button key={item.label} type="button" className={classes.chip} onClick={item.clear}>
                {item.label}
                <Uicon name="cross-small" />
              </button>
            ))}
            <button type="button" className={classes.chip} style={{ background: 'transparent' }} onClick={clearAll}>
              <Uicon name="trash" />
              <strong>{t('range.filter.clear')}</strong>
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 28 }}>
            <Note tone="warn" icon="triangle-warning">
              {error.message}
            </Note>
          </div>
        )}

        {modules && (
          <>
            <h2 className={classes.sectionTitle} style={{ margin: '40px 0 22px', fontSize: '1.5rem' }}>
              {t('range.count.results', { count: shown.length })}
            </h2>
            {shown.length > 0 ? (
              <div className={classes.grid}>
                {shown.map((module) => (
                  <ModuleCard key={module.slug} module={module} />
                ))}
              </div>
            ) : (
              <div className={cx(classes.card, classes.empty)}>{t('range.catalogue.empty')}</div>
            )}
          </>
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default Modules
