import { Button, Skeleton } from '@mantine/core'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { ModuleCard, ModuleRow, PathCard } from '@Components/range/Cards'
import { Cover, Facts, Note, PathLabel, PoweredBy, ProgressRow } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { RankCard } from '@Components/range/RankCard'
import {
  coverIcon,
  Difficulty,
  PathSummary,
  pathUrl,
  percentOf,
  rangeApi,
  sectionUrl,
  SkillLevel,
  useMe,
  useModules,
  usePath,
  usePaths,
  useRangeRefresh,
} from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import api from '@Api'
import classes from '@Styles/Range.module.css'

// The path a student is enrolled in: its modules, and a button to carry on.
const EnrolledPath: FC<{ slug: string }> = ({ slug }) => {
  const { t } = useTranslation()
  const { data: path } = usePath(slug)

  if (!path) return <Skeleton height={420} radius={10} />

  return (
    <div className={classes.card} style={{ padding: 20 }}>
      <Link to={pathUrl(path.slug)} className={cx(classes.row, classes.rowLarge)}>
        <Cover icon={coverIcon(path.icon)} seed={path.slug} category={path.category} square />
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div className={classes.labels}>
            <span className={classes.badge} data-inline>
              {t('range.path.enrolled')}
            </span>
            <PathLabel />
          </div>
          <div className={classes.pathCardTitle}>{path.title}</div>
          <Facts difficulty={path.difficulty} minutes={path.minutes} modules={path.moduleCount} />
        </div>
        <ProgressRow value={percentOf(path.done, path.sections)} />
        <Uicon name="angle-small-right" size={20} className={classes.dim} />
      </Link>

      <div className={classes.inset} style={{ marginTop: 16 }}>
        <div className={classes.between} style={{ padding: '18px 22px', borderBottom: '1px solid var(--r-border)' }}>
          <strong style={{ fontSize: '1.2rem' }}>{t('range.nav.modules')}</strong>
          <span className={classes.dim}>
            {t('range.path.modules_done', { done: path.completedModules, total: path.moduleCount })}
          </span>
        </div>
        <div className={classes.rows} style={{ padding: 8, maxHeight: 400, overflowY: 'auto' }}>
          {path.modules.map((module) => (
            <ModuleRow key={module.slug} module={module} />
          ))}
        </div>
      </div>

      <div className={classes.footActions} style={{ justifyContent: 'flex-end', gap: 22, marginTop: 20 }}>
        <Link to={pathUrl(path.slug)} className={classes.link}>
          {t('range.path.see_full')}
        </Link>
        {path.next ? (
          <Button component={Link} to={sectionUrl(path.next.module, path.next.section)} size="md" radius="sm">
            {path.done > 0 ? t('range.action.continue') : t('range.action.start')}
          </Button>
        ) : (
          <span className={classes.done}>
            <Uicon name="check-circle-solid" />
            {t('range.path.finished')}
          </span>
        )}
      </div>
    </div>
  )
}

const LEVEL_DIFFICULTY: Record<SkillLevel, Difficulty> = { beginner: 'easy', intermediate: 'medium', expert: 'hard' }

// For a student without a path: the one that suits their skill level, ready to enrol in.
const PickPath: FC<{ paths: PathSummary[]; level: SkillLevel | null }> = ({ paths, level }) => {
  const { t } = useTranslation()
  const refresh = useRangeRefresh()
  const [busy, setBusy] = useState(false)

  const match = level ? paths.find((path) => path.difficulty === LEVEL_DIFFICULTY[level]) : undefined
  const suggested = match ?? paths[0]
  if (!suggested) return <div className={cx(classes.card, classes.empty)}>{t('range.path.none')}</div>

  const enrol = async () => {
    setBusy(true)
    try {
      await rangeApi.updateMe({ enrolledPath: suggested.slug })
      await refresh()
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={classes.card} style={{ display: 'grid', gap: 18, padding: 24 }}>
      <div>
        <h2 className={classes.sectionTitle} style={{ fontSize: '1.35rem' }}>
          {t('range.path.pick_title')}
        </h2>
        <p className={classes.lead} style={{ marginTop: 6, fontSize: '1rem' }}>
          {t('range.path.pick_content')}
        </p>
      </div>
      <div className={cx(classes.inset, classes.pathCard)} style={{ background: 'var(--r-bg)' }}>
        <Cover
          icon={coverIcon(suggested.icon)}
          seed={suggested.slug}
          category={suggested.category}
          style={{ aspectRatio: '4 / 3' }}
        />
        <div className={classes.pathCardBody}>
          <div className={classes.labels}>
            <PathLabel />
            {match && (
              <span className={classes.badge} data-inline>
                {t('range.path.recommended')}
              </span>
            )}
          </div>
          <div className={classes.pathCardTitle}>{suggested.title}</div>
          <div className={classes.clamp}>{suggested.summary}</div>
          <Facts difficulty={suggested.difficulty} minutes={suggested.minutes} modules={suggested.moduleCount} />
        </div>
      </div>
      <div className={classes.footActions} style={{ justifyContent: 'flex-end', gap: 22 }}>
        <Link to={pathUrl(suggested.slug)} className={classes.link}>
          {t('range.path.see_full')}
        </Link>
        <Button size="md" radius="sm" loading={busy} onClick={enrol}>
          {t('range.path.enrol')}
        </Button>
      </div>
    </div>
  )
}

// Skill Paths: where a student sees their path, their level and rank, and everything there is to learn.
const SkillPaths: FC = () => {
  const { t, i18n } = useTranslation()
  const { data: me, signedIn, known } = useMe()
  const { data: paths, error } = usePaths()
  const { data: modules } = useModules()
  // what the club has posted lately
  const { data: posts } = api.info.useInfoGetLatestPosts({ refreshInterval: 5 * 60 * 1000 })
  const [tab, setTab] = useState<'path' | 'started'>('path')

  usePageTitle(t('range.nav.paths'))

  const enrolled = paths?.find((path) => path.enrolled)
  const started = modules?.filter((module) => module.status === 'started') ?? []

  return (
    <RangePage isLoading={(!paths && !error) || !known}>
      <div className={cx(classes.container, classes.page)}>
        <div className={classes.sections}>
          {error && (
            <Note tone="warn" icon="triangle-warning">
              {error.message}
            </Note>
          )}

          {signedIn ? (
            <section>
              <h1 className={classes.pageTitle}>{t('range.home.welcome', { name: me?.name ?? '' })}</h1>
              <div className={classes.dashboard} style={{ marginTop: 28 }}>
                <div style={{ minWidth: 0 }}>
                  <div className={classes.pills} style={{ marginBottom: 20 }}>
                    <button
                      type="button"
                      className={classes.pill}
                      data-active={tab === 'path' || undefined}
                      onClick={() => setTab('path')}
                    >
                      {t('range.home.my_path')}
                    </button>
                    <button
                      type="button"
                      className={classes.pill}
                      data-active={tab === 'started' || undefined}
                      onClick={() => setTab('started')}
                    >
                      {t('range.home.in_progress')}
                      {started.length > 0 && <span className={classes.count}>{started.length}</span>}
                    </button>
                  </div>

                  {tab === 'path' ? (
                    enrolled ? (
                      <EnrolledPath slug={enrolled.slug} />
                    ) : (
                      paths && <PickPath paths={paths} level={me?.skillLevel ?? null} />
                    )
                  ) : started.length > 0 ? (
                    <div className={classes.grid}>
                      {started.map((module) => (
                        <ModuleCard key={module.slug} module={module} />
                      ))}
                    </div>
                  ) : (
                    <div className={cx(classes.card, classes.empty)}>{t('range.home.nothing_started')}</div>
                  )}
                </div>
                <RankCard />
              </div>
            </section>
          ) : (
            <section className={classes.hero}>
              <div style={{ display: 'grid', gap: 20 }}>
                <h1 className={classes.pageTitle}>{t('range.home.title')}</h1>
                <p className={classes.lead}>{t('range.home.lead')}</p>
                <div className={classes.footActions}>
                  <Button component={Link} to="/account/login?from=/paths" size="md" radius="sm">
                    {t('range.action.sign_in')}
                  </Button>
                  <Link to="/account/register" className={classes.button} data-variant="outline">
                    {t('range.action.register')}
                  </Link>
                </div>
              </div>
              <Cover icon="graduation-cap" seed="skill-paths" className={classes.heroCover} />
            </section>
          )}

          {paths && paths.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
                <span className={classes.headingIcon}>
                  <Uicon name="route" />
                </span>
                <div>
                  <h2 className={classes.sectionTitle}>{t('range.nav.paths')}</h2>
                  <p className={classes.lead} style={{ marginTop: 4 }}>
                    {t('range.home.paths_lead')}
                  </p>
                </div>
              </div>
              <div className={classes.pathGrid}>
                {paths.map((path) => (
                  <PathCard key={path.slug} path={path} />
                ))}
              </div>
            </section>
          )}

          {modules && modules.length > 0 && (
            <section>
              <div className={classes.sectionHead}>
                <h2 className={classes.sectionTitle}>{t('range.nav.modules')}</h2>
                <Link to="/modules" className={classes.link}>
                  {t('range.home.all_modules')}
                </Link>
              </div>
              <div className={classes.grid}>
                {modules.slice(0, 8).map((module) => (
                  <ModuleCard key={module.slug} module={module} />
                ))}
              </div>
            </section>
          )}
          {posts && posts.length > 0 && (
            <section>
              <div className={classes.sectionHead}>
                <h2 className={classes.sectionTitle}>{t('range.home.news')}</h2>
                <Link to="/posts" className={classes.link}>
                  {t('range.home.all_news')}
                </Link>
              </div>
              <div className={classes.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                {posts.slice(0, 3).map((post) => (
                  <Link key={post.id} to={`/posts/${post.id}`} className={classes.moduleCard}>
                    <div className={classes.moduleCardBody}>
                      <span className={classes.dim} style={{ fontSize: '0.85rem' }}>
                        {new Date(post.time).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
                        {post.authorName ? ` · ${post.authorName}` : ''}
                      </span>
                      <h3 className={classes.cardTitle}>{post.title}</h3>
                      <div className={classes.clamp}>{post.summary}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default SkillPaths
