import { Button, Drawer, Tooltip } from '@mantine/core'
import cx from 'clsx'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Markdown } from '@Components/MarkdownRenderer'
import { Uicon } from '@Components/Uicon'
import { WithRole } from '@Components/WithRole'
import { useCelebrate } from '@Components/range/Celebrate'
import { MachineBlock } from '@Components/range/MachineBlock'
import { ChapterBlock } from '@Components/range/Outline'
import { Cover, Note, PoweredBy, StripedProgress, Xp } from '@Components/range/Parts'
import { QuestionItem } from '@Components/range/QuestionItem'
import { RangePage } from '@Components/range/RangePage'
import {
  AnswerResult,
  coverIcon,
  MachineInfo,
  moduleUrl,
  percentOf,
  rangeApi,
  sectionUrl,
  useMachine,
  useModule,
  useRangeRefresh,
  useSection,
} from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import { Role } from '@Api'
import classes from '@Styles/Range.module.css'

// One section of a module: the text, the student's machine if it has one, and its questions.
const SectionReader: FC = () => {
  const { module: moduleSlug = '', section: sectionSlug = '' } = useParams()
  const { t } = useTranslation()
  const refresh = useRangeRefresh()
  const { data, error } = useSection(moduleSlug, sectionSlug)
  const { data: module } = useModule(moduleSlug)
  const { data: machine, mutate: setMachine } = useMachine(true)
  const [outline, setOutline] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const questions = useRef<HTMLDivElement>(null)

  // what is on screen may still be the section that was open before this one
  const section = data?.slug === sectionSlug && data.module.slug === moduleSlug ? data : undefined

  usePageTitle(section?.title ?? t('range.nav.modules'))

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [moduleSlug, sectionSlug])

  const celebrate = useCelebrate('section')

  const onAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!result.correct) return
      celebrate(result)
      await refresh()
    },
    [celebrate, refresh]
  )

  const finish = async () => {
    setFinishing(true)
    try {
      celebrate(await rangeApi.complete(moduleSlug, sectionSlug))
      await refresh()
    } catch (err) {
      showErrorMsg(err, t)
    } finally {
      setFinishing(false)
    }
  }

  const onMachine = useCallback((next: MachineInfo | null) => setMachine(next, { revalidate: false }), [setMachine])

  const percent = section ? percentOf(section.module.done, section.module.sections) : 0
  const completed = section?.status === 'completed'
  const answered = section?.questions.filter((question) => question.solved).length ?? 0
  const position = section ? t('range.section.position', { n: section.number, total: section.of }) : ''
  // the next section opens once this one is finished
  const nextLocked =
    module?.chapters.flatMap((chapter) => chapter.sections).find((s) => s.slug === section?.next?.slug)?.status ===
    'locked'

  return (
    <WithRole requiredRole={Role.User}>
      <RangePage bare isLoading={!section && !error}>
        <div className={classes.readerBar}>
          <Tooltip label={t('range.section.back')} withArrow>
            <Link to={moduleUrl(moduleSlug)} className={classes.iconButton} aria-label={t('range.section.back')}>
              <Uicon name="arrow-left" />
            </Link>
          </Tooltip>
          {section && (
            <Link to={moduleUrl(section.module.slug)} className={classes.readerModule}>
              <Cover icon={coverIcon(section.module.icon, section.module.category)} seed={section.module.slug} square />
              <div style={{ minWidth: 0 }}>
                <div className={classes.between} style={{ marginBottom: 7 }}>
                  <span className={classes.readerModuleTitle}>{section.module.title}</span>
                  <span className={cx(classes.small, classes.dim)}>{percent}%</span>
                </div>
                <StripedProgress value={percent} size="sm" />
              </div>
            </Link>
          )}
          <div style={{ flex: 1 }} />
          <Link to="/paths" className={classes.wordmark}>
            UDSM Cyber<span>Range</span>
          </Link>
          <Tooltip label={t('range.section.outline')} withArrow>
            <button
              type="button"
              className={classes.iconButton}
              aria-label={t('range.section.outline')}
              onClick={() => setOutline(true)}
            >
              <Uicon name="list" />
            </button>
          </Tooltip>
        </div>

        <div className={classes.reader}>
          {error ? (
            <Note tone="warn" icon="triangle-warning">
              {error.status === 404 ? t('range.section.not_found') : error.message}
            </Note>
          ) : (
            section &&
            (section.status === 'locked' ? (
              <div
                className={cx(classes.card, classes.empty)}
                style={{ display: 'grid', gap: 16, justifyItems: 'center' }}
              >
                <span className={classes.machineIcon}>
                  <Uicon name="lock" />
                </span>
                <h1 className={classes.blockTitle} style={{ margin: 0 }}>
                  {t('range.section.locked_title')}
                </h1>
                <p className={classes.lead}>
                  {t('range.section.locked_content', { title: section.requires?.title ?? '' })}
                </p>
                {section.requires && (
                  <Button component={Link} to={sectionUrl(moduleSlug, section.requires.slug)} size="md" radius="sm">
                    {t('range.section.locked_go', { title: section.requires.title })}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className={classes.between}>
                  <span className={cx(classes.mono, classes.dim)}>{position}</span>
                  {section.questions.length > 0 && (
                    <button
                      type="button"
                      className={classes.link}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                      onClick={() => questions.current?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      {t('range.section.go_to_questions')}
                      <Uicon name="arrow-small-down" />
                    </button>
                  )}
                </div>
                <h1 className={classes.readerTitle}>{section.title}</h1>

                <Markdown source={section.content ?? ''} className={classes.prose} />

                {section.machine && (
                  <div className={classes.block}>
                    <MachineBlock
                      module={moduleSlug}
                      section={sectionSlug}
                      machine={machine}
                      start={() => rangeApi.startMachine(moduleSlug, sectionSlug)}
                      onChange={onMachine}
                    />
                  </div>
                )}

                {section.questions.length > 0 && (
                  <div className={classes.block} ref={questions} style={{ scrollMarginTop: 90 }}>
                    <h2 className={classes.blockTitle}>{t('range.section.questions')}</h2>
                    <div style={{ marginBottom: 16 }}>
                      <Note>{t('range.section.questions_note')}</Note>
                    </div>
                    {section.questions.map((question, index) => (
                      <QuestionItem
                        key={`${section.slug}:${question.id}`}
                        number={index + 1}
                        question={question}
                        submit={(answer) => rangeApi.answer(moduleSlug, sectionSlug, question.id, answer)}
                        onAnswered={onAnswered}
                      />
                    ))}
                  </div>
                )}

                <div className={classes.readerFoot}>
                  <span className={cx(classes.mono, classes.dim)}>{position}</span>
                  <div className={classes.footActions}>
                    <Tooltip label={t('range.section.bonus')} withArrow>
                      <span>
                        <Xp value={section.xp} plus pill />
                      </span>
                    </Tooltip>
                    {section.previous && (
                      <Link
                        to={sectionUrl(moduleSlug, section.previous.slug)}
                        className={classes.button}
                        data-variant="plain"
                      >
                        {t('range.section.previous')}
                      </Link>
                    )}
                    {!section.next ? (
                      <Link to={moduleUrl(moduleSlug)} className={classes.button} data-variant="outline">
                        {t('range.section.back')}
                      </Link>
                    ) : nextLocked ? (
                      <Tooltip label={t('range.section.next_hint')} withArrow>
                        <span className={classes.button} data-variant="outline" data-disabled>
                          {t('range.section.next')}
                        </span>
                      </Tooltip>
                    ) : (
                      <Link
                        to={sectionUrl(moduleSlug, section.next.slug)}
                        className={classes.button}
                        data-variant={completed ? undefined : 'outline'}
                      >
                        {t('range.section.next')}
                        <Uicon name="arrow-right" />
                      </Link>
                    )}
                    {completed ? (
                      <span className={classes.completed} data-done>
                        {t('range.status.completed')}
                        <Uicon name="check-circle-solid" />
                      </span>
                    ) : section.questions.length === 0 ? (
                      <Button size="md" radius="sm" loading={finishing} onClick={finish}>
                        {t('range.section.mark_complete')}
                      </Button>
                    ) : (
                      <span className={classes.completed}>
                        {t('range.section.answered', { solved: answered, total: section.questions.length })}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ))
          )}

          <PoweredBy />
        </div>

        <Drawer
          opened={outline}
          onClose={() => setOutline(false)}
          position="right"
          size="lg"
          title={module?.title}
          classNames={{ content: cx(classes.theme, classes.drawer), header: classes.drawerHeader }}
        >
          {module?.chapters.map((chapter, index) => (
            <ChapterBlock
              key={chapter.title}
              module={moduleSlug}
              number={index + 1}
              chapter={chapter}
              open
              onToggle={() => {}}
              current={sectionSlug}
              onNavigate={() => setOutline(false)}
            />
          ))}
        </Drawer>
      </RangePage>
    </WithRole>
  )
}

export default SectionReader
