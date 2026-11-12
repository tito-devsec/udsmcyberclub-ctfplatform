import { Button } from '@mantine/core'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ModuleRow } from '@Components/range/Cards'
import { Cover, Facts, Note, PathLabel, PoweredBy, StripedProgress } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { SafeMarkdown } from '@Components/range/SafeMarkdown'
import { coverIcon, pathUrl, percentOf, rangeApi, sectionUrl, usePath, useRangeRefresh } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Range.module.css'

// A skill path: what it teaches, its modules in order, and where the student is in it.
const SkillPath: FC = () => {
  const { path: slug } = useParams()
  const { t } = useTranslation()
  const { data, error } = usePath(slug)
  const refresh = useRangeRefresh()
  const [busy, setBusy] = useState(false)

  // what is on screen may still be the path that was open before this one
  const path = data?.slug === slug ? data : undefined

  usePageTitle(path?.title ?? t('range.nav.paths'))

  const enrol = async (enrolledPath: string | null) => {
    setBusy(true)
    try {
      await rangeApi.updateMe({ enrolledPath })
      await refresh()
    } catch (err) {
      showErrorMsg(err, t)
    } finally {
      setBusy(false)
    }
  }

  const percent = path ? percentOf(path.done, path.sections) : 0

  return (
    <RangePage isLoading={!path && !error}>
      <div className={cx(classes.container, classes.page)}>
        {error ? (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.path.not_found') : error.message}
          </Note>
        ) : (
          path && (
            <div className={classes.sections}>
              <section className={classes.hero}>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div className={classes.labels}>
                    <PathLabel />
                    {path.enrolled && (
                      <span className={classes.badge} data-inline>
                        {t('range.path.enrolled')}
                      </span>
                    )}
                  </div>
                  <h1 className={classes.pageTitle}>{path.title}</h1>
                  <p className={classes.lead}>{path.summary}</p>
                  <Facts difficulty={path.difficulty} minutes={path.minutes} xp={path.xp} modules={path.moduleCount} />

                  {path.signedIn && (
                    <div style={{ maxWidth: 580 }}>
                      <div className={classes.between} style={{ marginBottom: 10 }}>
                        <strong>{t('range.path.progress')}</strong>
                        <strong style={{ color: 'var(--r-accent)' }}>
                          {t('range.progress.completed', { percent })}
                        </strong>
                      </div>
                      <StripedProgress value={percent} size="lg" />
                    </div>
                  )}

                  <div className={classes.footActions} style={{ marginTop: 6 }}>
                    {!path.signedIn ? (
                      <Button component={Link} to={`/account/login?from=${pathUrl(path.slug)}`} size="lg" radius="sm">
                        {t('range.action.sign_in_to_start')}
                      </Button>
                    ) : (
                      <>
                        {path.next && (
                          <Button
                            component={Link}
                            to={sectionUrl(path.next.module, path.next.section)}
                            size="lg"
                            radius="sm"
                          >
                            {path.done > 0 ? t('range.action.continue') : t('range.action.start')}
                          </Button>
                        )}
                        {path.enrolled ? (
                          <button
                            type="button"
                            className={classes.button}
                            data-variant="plain"
                            data-size="lg"
                            disabled={busy}
                            onClick={() => enrol(null)}
                          >
                            {t('range.path.leave')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={classes.button}
                            data-variant="outline"
                            data-size="lg"
                            disabled={busy}
                            onClick={() => enrol(path.slug)}
                          >
                            {t('range.path.enrol')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <Cover icon={coverIcon(path.icon)} seed={path.slug} className={classes.heroCover} />
              </section>

              <section>
                <div className={classes.sectionHead}>
                  <div>
                    <h2 className={classes.sectionTitle}>{t('range.nav.modules')}</h2>
                    <div className={classes.dim} style={{ marginTop: 4, fontSize: '1.05rem' }}>
                      {t('range.path.modules_done', { done: path.completedModules, total: path.moduleCount })}
                    </div>
                  </div>
                </div>
                <div className={cx(classes.card, classes.rows)} style={{ padding: 8 }}>
                  {path.modules.map((module) => (
                    <ModuleRow key={module.slug} module={module} />
                  ))}
                </div>
              </section>

              {path.description && (
                <section>
                  <h2 className={classes.sectionTitle} style={{ marginBottom: 16 }}>
                    {t('range.path.about')}
                  </h2>
                  <SafeMarkdown source={path.description} className={classes.prose} />
                </section>
              )}
            </div>
          )
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default SkillPath
