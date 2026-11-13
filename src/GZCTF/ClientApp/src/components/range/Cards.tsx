import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { CategoryLabel, Cover, Facts, PathLabel, ProgressRow } from '@Components/range/Parts'
import { coverIcon, ModuleSummary, moduleUrl, PathSummary, pathUrl, percentOf } from '@Utils/Range'
import classes from '@Styles/Range.module.css'

// A module in the catalogue: its cover, what it is about and how far the student is.
export const ModuleCard: FC<{ module: ModuleSummary }> = ({ module }) => {
  const { t } = useTranslation()

  return (
    <Link to={moduleUrl(module.slug)} className={classes.moduleCard}>
      <div className={classes.moduleCardCover}>
        <Cover icon={coverIcon(module.icon, module.category)} seed={module.slug} category={module.category}>
          {module.status === 'started' && <span className={classes.badge}>{t('range.status.started')}</span>}
        </Cover>
      </div>
      <div className={classes.moduleCardBody}>
        <CategoryLabel category={module.category} />
        <h3 className={classes.cardTitle}>{module.title}</h3>
        <div style={{ flex: 1 }} />
        <Facts difficulty={module.difficulty} minutes={module.minutes} xp={module.xp} />
      </div>
      <div className={classes.moduleCardFoot}>
        {module.status === 'completed' ? (
          <span className={classes.done}>
            <Uicon name="check-circle-solid" />
            {t('range.status.completed')}
          </span>
        ) : module.status === 'started' ? (
          <ProgressRow value={percentOf(module.done, module.sections)} />
        ) : (
          <span>{t('range.count.sections', { count: module.sections })}</span>
        )}
        <Uicon name="arrow-right" />
      </div>
    </Link>
  )
}

// A skill path in a list: cover on the left, what it teaches on the right.
export const PathCard: FC<{ path: PathSummary }> = ({ path }) => {
  const { t } = useTranslation()
  const started = path.done > 0

  return (
    <Link to={pathUrl(path.slug)} className={classes.pathCard}>
      <Cover icon={coverIcon(path.icon)} seed={path.slug} category={path.category} style={{ aspectRatio: '4 / 3' }}>
        {path.enrolled && <span className={classes.badge}>{t('range.path.enrolled')}</span>}
      </Cover>
      <div className={classes.pathCardBody}>
        <PathLabel />
        <h3 className={classes.pathCardTitle}>{path.title}</h3>
        <div className={classes.clamp}>{path.summary}</div>
        <div style={{ flex: 1 }} />
        {started && <ProgressRow value={percentOf(path.done, path.sections)} />}
        <div className={classes.between}>
          <Facts difficulty={path.difficulty} minutes={path.minutes} modules={path.moduleCount} />
          <Uicon name="angle-small-right" size={22} className={classes.dim} />
        </div>
      </div>
    </Link>
  )
}

// One module of a path, as a row with its progress.
export const ModuleRow: FC<{ module: ModuleSummary }> = ({ module }) => (
  <Link to={moduleUrl(module.slug)} className={classes.row}>
    <Cover icon={coverIcon(module.icon, module.category)} seed={module.slug} category={module.category} square />
    <div style={{ minWidth: 0 }}>
      <CategoryLabel category={module.category} />
      <div className={classes.rowTitle}>{module.title}</div>
    </div>
    <ProgressRow value={percentOf(module.done, module.sections)} />
    <Uicon name="angle-small-right" size={20} className={classes.dim} />
  </Link>
)
