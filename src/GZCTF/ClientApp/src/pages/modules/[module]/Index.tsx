import { Button } from '@mantine/core'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { ChapterBlock } from '@Components/range/Outline'
import { CategoryLabel, Cover, Label, Note, PoweredBy, ProgressBar, Xp } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { SafeMarkdown } from '@Components/range/SafeMarkdown'
import {
  coverIcon,
  DifficultyIcon,
  formatMinutes,
  moduleUrl,
  pathUrl,
  percentOf,
  sectionUrl,
  useModule,
} from '@Utils/Range'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Range.module.css'

// A module: its progress, and its chapters with the sections in each.
const ModulePage: FC = () => {
  const { module: slug } = useParams()
  const { t, i18n } = useTranslation()
  const { data, error } = useModule(slug)
  const [tab, setTab] = useState<'progress' | 'details'>('progress')
  // the chapters the student opened or closed; until they touch one, the chapter they are in is open
  const [opened, setOpened] = useState<Set<number> | null>(null)

  // what is on screen may still be the module that was open before this one
  const module = data?.slug === slug ? data : undefined

  usePageTitle(module?.title ?? t('range.nav.modules'))

  const sections = module?.chapters.flatMap((chapter) => chapter.sections) ?? []
  const percent = module ? percentOf(module.done, module.sections) : 0

  const currentChapter = Math.max(
    0,
    module?.chapters.findIndex((chapter) => chapter.sections.some((s) => s.slug === module.next?.slug)) ?? 0
  )
  const isOpen = (index: number) => (opened ? opened.has(index) : index === currentChapter)
  const allOpen = Boolean(module?.chapters.every((_, index) => isOpen(index)))

  const toggle = (index: number) =>
    setOpened((before) => {
      const next = new Set(before ?? [currentChapter])
      if (!next.delete(index)) next.add(index)
      return next
    })

  const action = !module ? null : !module.signedIn ? (
    <Button component={Link} to={`/account/login?from=${moduleUrl(module.slug)}`} size="lg" radius="sm">
      {t('range.action.sign_in_to_start')}
    </Button>
  ) : (
    sections[0] && (
      <Button component={Link} to={sectionUrl(module.slug, (module.next ?? sections[0]).slug)} size="lg" radius="sm">
        {module.status === 'completed'
          ? t('range.module.review')
          : module.status === 'started'
            ? t('range.module.continue')
            : t('range.module.start')}
      </Button>
    )
  )

  return (
    <RangePage isLoading={!module && !error}>
      <div className={cx(classes.container, classes.page)} style={{ maxWidth: 1100 }}>
        {error ? (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.module.not_found') : error.message}
          </Note>
        ) : (
          module && (
            <>
              <section className={classes.hero}>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div className={classes.labels}>
                    <CategoryLabel category={module.category} />
                    <Label icon={DifficultyIcon[module.difficulty]}>{t(`range.difficulty.${module.difficulty}`)}</Label>
                  </div>
                  <h1 className={classes.pageTitle}>{module.title}</h1>
                  <p className={classes.lead}>{module.summary}</p>
                  {module.updated && (
                    <div className={classes.done} style={{ color: 'var(--r-accent)' }}>
                      <Uicon name="time-past" />
                      {t('range.module.updated', {
                        date: new Date(`${module.updated}T00:00:00`).toLocaleDateString(i18n.language, {
                          dateStyle: 'long',
                        }),
                      })}
                    </div>
                  )}

                  <div style={{ maxWidth: 580 }}>
                    <div className={classes.between} style={{ marginBottom: 10 }}>
                      <strong>{t('range.module.progress')}</strong>
                      <strong style={{ color: 'var(--r-accent)' }}>{t('range.progress.completed', { percent })}</strong>
                    </div>
                    <ProgressBar value={percent} size="lg" />
                  </div>

                  <div style={{ marginTop: 6 }}>{action}</div>
                </div>
                <Cover
                  icon={coverIcon(module.icon, module.category)}
                  seed={module.slug}
                  category={module.category}
                  className={classes.heroCover}
                />
              </section>

              <div className={classes.pills} style={{ margin: '56px 0 36px' }}>
                <button
                  type="button"
                  className={classes.pill}
                  data-active={tab === 'progress' || undefined}
                  onClick={() => setTab('progress')}
                >
                  {t('range.module.tab_progress')}
                </button>
                <button
                  type="button"
                  className={classes.pill}
                  data-active={tab === 'details' || undefined}
                  onClick={() => setTab('details')}
                >
                  {t('range.module.tab_details')}
                </button>
              </div>

              {tab === 'progress' ? (
                <section>
                  <div className={classes.sectionHead}>
                    <div>
                      <h2 className={classes.sectionTitle}>{t('range.module.sections')}</h2>
                      <div className={classes.dim} style={{ marginTop: 4, fontSize: '1.05rem' }}>
                        {t('range.count.sections', { count: module.sections })}
                        {' · '}
                        {t('range.count.hands_on', { count: module.machines })}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classes.link}
                      onClick={() => setOpened(allOpen ? new Set() : new Set(module.chapters.map((_, index) => index)))}
                    >
                      {allOpen ? t('range.module.collapse_all') : t('range.module.expand_all')}
                    </button>
                  </div>

                  {module.chapters.map((chapter, index) => (
                    <ChapterBlock
                      key={chapter.title}
                      module={module.slug}
                      number={index + 1}
                      chapter={chapter}
                      open={isOpen(index)}
                      onToggle={() => toggle(index)}
                    />
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>{action}</div>
                </section>
              ) : (
                <section style={{ display: 'grid', gap: 28 }}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}
                  >
                    <div className={classes.tile}>
                      <div className={classes.tileValue}>{t(`range.category.${module.category}`)}</div>
                      <div className={classes.tileLabel}>{t('range.filter.category')}</div>
                    </div>
                    <div className={classes.tile}>
                      <div className={classes.tileValue}>{t(`range.difficulty.${module.difficulty}`)}</div>
                      <div className={classes.tileLabel}>{t('range.filter.difficulty')}</div>
                    </div>
                    <div className={classes.tile}>
                      <div className={classes.tileValue}>{formatMinutes(module.minutes)}</div>
                      <div className={classes.tileLabel}>{t('range.module.time')}</div>
                    </div>
                    <div className={classes.tile}>
                      <div className={classes.tileValue}>
                        <Xp value={module.xp} />
                      </div>
                      <div className={classes.tileLabel}>{t('range.module.reward')}</div>
                    </div>
                  </div>

                  {module.description && <SafeMarkdown source={module.description} className={classes.prose} />}

                  {module.paths.length > 0 && (
                    <div>
                      <strong>{t('range.module.part_of')}</strong>
                      <div className={classes.filters} style={{ marginTop: 10 }}>
                        {module.paths.map((path) => (
                          <Link
                            key={path.slug}
                            to={pathUrl(path.slug)}
                            className={classes.chip}
                            style={{ textDecoration: 'none' }}
                          >
                            <Uicon name="route" />
                            {path.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default ModulePage
