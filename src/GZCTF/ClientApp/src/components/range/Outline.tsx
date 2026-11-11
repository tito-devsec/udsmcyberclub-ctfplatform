import { Collapse, Tooltip } from '@mantine/core'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Xp } from '@Components/range/Parts'
import { ModuleDetail, SectionSummary, sectionUrl } from '@Utils/Range'
import { UiconName } from '@Utils/Uicons'
import classes from '@Styles/Range.module.css'

const markOf = (section: SectionSummary): UiconName =>
  section.status === 'completed'
    ? 'check'
    : section.status === 'locked'
      ? 'lock'
      : section.machine
        ? 'cursor-finger'
        : 'document'

interface SectionRowProps {
  module: string
  section: SectionSummary
  // the section being read, in the reader's outline
  current?: boolean
  onNavigate?: () => void
}

// One section in a chapter: done, open or locked, what kind it is and what it is worth.
export const SectionRow: FC<SectionRowProps> = ({ module, section, current, onNavigate }) => {
  const { t } = useTranslation()

  const content = (
    <>
      <span className={classes.sectionMark} data-status={section.status}>
        <Uicon name={markOf(section)} />
      </span>
      <span className={classes.sectionKind}>{section.machine ? t('range.kind.hands_on') : t('range.kind.lesson')}</span>
      <span style={{ minWidth: 0 }}>{section.title}</span>
      <Xp value={section.xp} />
    </>
  )

  if (section.status === 'locked') {
    return (
      <Tooltip label={t('range.section.locked_hint')} withArrow position="top-start">
        <div className={classes.sectionRow} data-locked>
          {content}
        </div>
      </Tooltip>
    )
  }

  return (
    <Link
      to={sectionUrl(module, section.slug)}
      className={classes.sectionRow}
      data-current={current || undefined}
      onClick={onNavigate}
    >
      {content}
    </Link>
  )
}

interface ChapterBlockProps {
  module: string
  number: number
  chapter: ModuleDetail['chapters'][number]
  open: boolean
  onToggle: () => void
  current?: string
  onNavigate?: () => void
}

// A numbered chapter that opens to show its sections.
export const ChapterBlock: FC<ChapterBlockProps> = ({
  module,
  number,
  chapter,
  open,
  onToggle,
  current,
  onNavigate,
}) => {
  const { t } = useTranslation()
  const total = chapter.sections.length
  const done = chapter.sections.filter((section) => section.status === 'completed').length

  return (
    <div className={classes.chapter}>
      <button type="button" className={classes.chapterHead} aria-expanded={open} onClick={onToggle}>
        <span
          className={classes.chapterNumber}
          data-started={done > 0 || undefined}
          data-done={done === total || undefined}
        >
          {number}
        </span>
        <span className={classes.chapterTitle}>{chapter.title}</span>
        <span className={classes.chapterCount}>
          {done > 0
            ? t('range.count.sections_done', { done, count: total })
            : t('range.count.sections', { count: total })}
        </span>
        <Uicon name="angle-small-down" size={20} className={classes.chevron} data-open={open || undefined} />
      </button>
      <Collapse expanded={open}>
        <div className={classes.chapterBody}>
          {chapter.sections.map((section) => (
            <SectionRow
              key={section.slug}
              module={module}
              section={section}
              current={section.slug === current}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </Collapse>
    </div>
  )
}
