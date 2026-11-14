import { Button, Tooltip } from '@mantine/core'
import cx from 'clsx'
import { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { useCelebrate } from '@Components/range/Celebrate'
import { PlayerAvatar, PlayerLink } from '@Components/range/Community'
import { MachineBlock } from '@Components/range/MachineBlock'
import { Note, PoweredBy, ProgressBar, Xp } from '@Components/range/Parts'
import { QuestionItem } from '@Components/range/QuestionItem'
import { RangePage } from '@Components/range/RangePage'
import { SafeMarkdown } from '@Components/range/SafeMarkdown'
import {
  Blood,
  bloodTime,
  Lab,
  LabKindIcon,
  labsApi,
  labUrl,
  profileUrl,
  releaseDate,
  shortDate,
  SystemIcon,
  useLab,
} from '@Utils/Community'
import {
  AnswerResult,
  CategoryIcon,
  coverIcon,
  DifficultyIcon,
  formatMinutes,
  MachineInfo,
  percentOf,
  useMachine,
  useMe,
  useRangeRefresh,
  categoryStyle,
} from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

const kilobytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`)

// someone's picture and name, in a chip that opens their profile when they have one
const PersonChip: FC<{ name: string; avatar: string | null; link?: boolean }> = ({ name, avatar, link = true }) => {
  const inside = (
    <>
      <PlayerAvatar name={name} avatar={avatar} className={classes.chipAvatar} />
      {name}
    </>
  )
  return link ? (
    <Link to={profileUrl(name)} className={classes.chip}>
      {inside}
    </Link>
  ) : (
    <span className={classes.chip}>{inside}</span>
  )
}

// Who took one of a boot-to-root machine's flags first, and how long after it went online.
const BloodCell: FC<{ blood: Blood | null; label: string; open: string }> = ({ blood, label, open }) => {
  const { t } = useTranslation()
  return (
    <div className={classes.blood}>
      <Uicon name="blood-solid" className={classes.bloodDrop} />
      {blood ? (
        <>
          <span>{label}</span>
          <PersonChip name={blood.name} avatar={blood.avatar} />
          <Tooltip label={t('range.lab.blood_hint')} withArrow>
            <span className={classes.chip} data-plain>
              <Uicon name="clock" />
              {bloodTime(blood.after)}
            </span>
          </Tooltip>
        </>
      ) : (
        <span>{open}</span>
      )}
    </div>
  )
}

// Under the hero, as on a machine's page: a boot-to-root machine's bloods, then when the lab
// went online, who made it, and respect for them.
const LabStrip: FC<{ lab: Lab; signedIn: boolean; onRespect: () => void }> = ({ lab, signedIn, onRespect }) => {
  const { t, i18n } = useTranslation()
  const [busy, setBusy] = useState(false)
  const creator = lab.creator

  const respect = async () => {
    if (!creator || busy) return
    setBusy(true)
    try {
      await labsApi.respect(creator.name, !creator.respected)
      onRespect()
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={classes.strip}>
      {lab.bloods && (
        <div className={classes.bloods}>
          <BloodCell blood={lab.bloods.user} label={t('range.lab.user_blood')} open={t('range.lab.user_blood_open')} />
          <BloodCell
            blood={lab.bloods.root}
            label={t('range.lab.system_blood')}
            open={t('range.lab.system_blood_open')}
          />
        </div>
      )}
      <div className={classes.stripFoot}>
        <span className={classes.inline}>
          {lab.released && (
            <>
              <Uicon name="calendar" />
              {t('range.lab.released_on', { date: releaseDate(lab.released, i18n.language) })}
            </>
          )}
        </span>
        <span className={classes.inline} style={{ justifySelf: 'center' }}>
          {t('range.lab.created_by')}
          {creator ? (
            <PersonChip name={creator.name} avatar={creator.avatar} link={creator.member} />
          ) : (
            <span className={classes.chip} data-plain>
              {t('range.lab.club')}
            </span>
          )}
        </span>
        <span className={classes.inline} style={{ justifySelf: 'end' }}>
          {creator?.member && (
            <>
              <span>{t('range.lab.respects', { count: creator.respects })}</span>
              {signedIn && !creator.self && (
                <Tooltip label={t('range.lab.respect_take_back')} disabled={!creator.respected} withArrow>
                  <Button
                    size="xs"
                    radius="sm"
                    variant={creator.respected ? 'light' : 'filled'}
                    loading={busy}
                    onClick={respect}
                    leftSection={<Uicon name={creator.respected ? 'hand-heart-solid' : 'hand-heart'} />}
                  >
                    {t(creator.respected ? 'range.lab.respected' : 'range.lab.respect')}
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </span>
      </div>
    </section>
  )
}

// A lab: its story, the machine or files to work on, and tasks that end with the flag.
const LabPage: FC = () => {
  const { lab: slug = '' } = useParams()
  const { t, i18n } = useTranslation()
  const { signedIn } = useMe()
  const refresh = useRangeRefresh()
  const celebrate = useCelebrate('lab')
  const { data, error, mutate } = useLab(slug)
  const { data: machine, mutate: setMachine } = useMachine(signedIn)

  // what is on screen may still be the lab that was open before this one
  const lab = data?.slug === slug ? data : undefined

  usePageTitle(lab?.title ?? t('range.nav.labs'))

  const onAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!result.correct) return
      celebrate(result)
      await refresh()
    },
    [celebrate, refresh]
  )

  const onMachine = useCallback((next: MachineInfo | null) => setMachine(next, { revalidate: false }), [setMachine])

  const solved = lab?.tasks.filter((task) => task.solved).length ?? 0
  // the XP of the tasks answered, and the bonus once they all are
  const earned = lab
    ? lab.tasks.reduce((sum, task) => sum + (task.solved ? task.xp : 0), 0) +
      (lab.status === 'completed' ? lab.bonus : 0)
    : 0

  return (
    <RangePage isLoading={!lab && !error}>
      {error ? (
        <div className={cx(range.container, range.page)}>
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.lab.not_found') : error.message}
          </Note>
        </div>
      ) : (
        lab && (
          <>
            <div className={classes.labHero} style={categoryStyle(lab.category)}>
              <div className={range.container}>
                <Link to="/labs" className={classes.backButton}>
                  <Uicon name="arrow-left" />
                  {t('range.lab.back')}
                </Link>
                <div className={classes.labHeroRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                    <span className={classes.emblem} data-size="lg">
                      <Uicon name={coverIcon(lab.icon, lab.category)} />
                    </span>
                    <div>
                      <h1 className={classes.labTitle}>{lab.title}</h1>
                      <div className={classes.labSub}>
                        {t(`range.difficulty.${lab.difficulty}`)} ·{' '}
                        {lab.os ? t(`range.lab.os.${lab.os}`) : t(`range.category.${lab.category}`)} ·{' '}
                        {t(`range.lab.kind.${lab.kind}`)}
                      </div>
                    </div>
                  </div>
                  <div className={classes.heroStats}>
                    <div className={classes.heroStat}>
                      <span className={classes.heroStatValue}>
                        <span className={range.xpTag}>XP</span>
                        {lab.xp}
                      </span>
                      <span className={classes.heroStatLabel}>{t('range.lab.reward')}</span>
                    </div>
                    <div className={classes.heroStat}>
                      <span className={classes.heroStatValue}>
                        <Uicon name={DifficultyIcon[lab.difficulty]} />
                        {t(`range.difficulty.${lab.difficulty}`)}
                      </span>
                      <span className={classes.heroStatLabel}>{t('range.filter.difficulty')}</span>
                    </div>
                    <div className={classes.heroStat}>
                      <span className={classes.heroStatValue}>
                        <Uicon name="clock" />
                        {formatMinutes(lab.minutes)}
                      </span>
                      <span className={classes.heroStatLabel}>{t('range.module.time')}</span>
                    </div>
                    <div className={classes.heroStat}>
                      <span className={classes.heroStatValue}>
                        <Uicon name="users-alt" />
                        {lab.solvers}
                      </span>
                      <span className={classes.heroStatLabel}>{t('range.lab.solved_by')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={range.container} style={{ paddingBottom: 40 }}>
              <LabStrip lab={lab} signedIn={signedIn} onRespect={() => mutate()} />

              <div className={classes.labColumns}>
                <div className={classes.labBody}>
                  {lab.status === 'completed' && (
                    <Note tone="done" icon="trophy">
                      {t('range.lab.solved_note', { xp: lab.xp })}
                    </Note>
                  )}

                  <section className={classes.panel}>
                    <h2 className={classes.panelTitle}>{t('range.lab.scenario')}</h2>
                    <SafeMarkdown source={lab.scenario} className={range.prose} />
                  </section>

                  {lab.files.length > 0 && (
                    <section className={classes.panel}>
                      <h2 className={classes.panelTitle}>{t('range.lab.files')}</h2>
                      <div className={range.filters}>
                        {lab.files.map((file) => (
                          <a key={file.name} href={file.url} className={classes.file} download={file.name}>
                            <Uicon name="download" />
                            {file.name}
                            <span className={range.dim}>{kilobytes(file.size)}</span>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {lab.machine &&
                    (signedIn ? (
                      <MachineBlock
                        module={lab.machineKey.module}
                        section={lab.machineKey.section}
                        machine={machine}
                        start={() => labsApi.startMachine(lab.slug)}
                        onChange={onMachine}
                        description={t('range.lab.machine_note')}
                      />
                    ) : null)}

                  <section>
                    <h2 className={range.blockTitle} style={{ margin: '0 0 16px' }}>
                      {t('range.lab.tasks')}
                    </h2>

                    {signedIn ? (
                      lab.tasks.map((task, index) => (
                        <QuestionItem
                          key={`${lab.slug}:${task.id}`}
                          number={index + 1}
                          label={t('range.lab.task', { n: index + 1 })}
                          question={task}
                          submit={(answer) => labsApi.answer(lab.slug, task.id, answer)}
                          onAnswered={onAnswered}
                        />
                      ))
                    ) : (
                      <div
                        className={cx(range.card, range.empty)}
                        style={{ display: 'grid', gap: 16, justifyItems: 'center' }}
                      >
                        <span>{t('range.lab.sign_in', { count: lab.tasks.length })}</span>
                        <Button component={Link} to={`/account/login?from=${labUrl(lab.slug)}`} size="md" radius="sm">
                          {t('range.action.sign_in_to_start')}
                        </Button>
                      </div>
                    )}
                  </section>

                  {lab.bonus > 0 && (
                    <div className={range.dim} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Xp value={lab.bonus} plus pill />
                      {t('range.lab.bonus')}
                    </div>
                  )}
                </div>

                <aside className={classes.labSide}>
                  {signedIn && (
                    <section className={classes.panel}>
                      <h2 className={classes.cardTitle}>{t('range.lab.progress')}</h2>
                      <div className={range.between} style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                          {percentOf(solved, lab.tasks.length)}%
                        </span>
                        <span className={cx(range.small, range.dim)}>
                          {t('range.lab.solved_of', { solved, total: lab.tasks.length })}
                        </span>
                      </div>
                      <ProgressBar value={percentOf(solved, lab.tasks.length)} size="sm" />
                      <div className={range.between} style={{ marginTop: 16 }}>
                        <span className={range.dim}>{t('range.lab.earned')}</span>
                        <span className={classes.inline} style={{ fontWeight: 600 }}>
                          <Xp value={earned} />
                          <span className={range.dim}>/ {lab.xp}</span>
                        </span>
                      </div>
                    </section>
                  )}

                  <section className={classes.panel}>
                    <h2 className={classes.cardTitle}>{t('range.lab.details')}</h2>
                    <dl className={classes.details}>
                      {lab.os ? (
                        <div>
                          <dt>{t('range.lab.system')}</dt>
                          <dd>
                            <Uicon name={SystemIcon[lab.os]} />
                            {t(`range.lab.os.${lab.os}`)}
                          </dd>
                        </div>
                      ) : (
                        <div>
                          <dt>{t('range.lab.category')}</dt>
                          <dd>
                            <Uicon name={CategoryIcon[lab.category]} />
                            {t(`range.category.${lab.category}`)}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>{t('range.lab.type')}</dt>
                        <dd>
                          <Uicon name={LabKindIcon[lab.kind]} />
                          {t(`range.lab.kind.${lab.kind}`)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('range.lab.tasks')}</dt>
                        <dd>{lab.tasks.length}</dd>
                      </div>
                      <div>
                        <dt>{t('range.lab.solved_by')}</dt>
                        <dd>{t('range.lab.students', { count: lab.solvers })}</dd>
                      </div>
                      {lab.updated && (
                        <div>
                          <dt>{t('range.lab.updated')}</dt>
                          <dd>{shortDate(lab.updated, i18n.language)}</dd>
                        </div>
                      )}
                    </dl>
                    <p className={cx(range.small, range.dim)} style={{ margin: '14px 0 0' }}>
                      {lab.firstSolve ? (
                        <>
                          {t('range.lab.first_solve')} <PlayerLink name={lab.firstSolve.name} className={range.link} />
                        </>
                      ) : (
                        t('range.lab.not_solved')
                      )}
                    </p>
                  </section>
                </aside>
              </div>

              <PoweredBy />
            </div>
          </>
        )
      )}
    </RangePage>
  )
}

export default LabPage
