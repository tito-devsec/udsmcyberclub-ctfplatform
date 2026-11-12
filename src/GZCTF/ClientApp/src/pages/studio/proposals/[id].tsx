import {
  Button,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { showNotification } from '@mantine/notifications'
import cx from 'clsx'
import dayjs from 'dayjs'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Note, PoweredBy } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { ItemControls, Labelled, MarkdownField, moved, replaced, StatusChip, without } from '@Components/range/Studio'
import { ago } from '@Utils/Community'
import { useRangeRefresh } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import {
  GAME_CATEGORIES,
  newChallenge,
  Proposal,
  ProposalData,
  proposalsApi,
  ProposedChallenge,
  studioUrl,
  useMachineImages,
  useProposal,
} from '@Utils/Studio'
import { usePageTitle } from '@Hooks/usePageTitle'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

const mono = { input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.9rem' } }

interface ChallengeProps {
  index: number
  count: number
  challenge: ProposedChallenge
  images: string[]
  disabled: boolean
  onChange: (challenge: ProposedChallenge) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}

// One challenge of a proposed game.
const ChallengeFields: FC<ChallengeProps> = ({
  index,
  count,
  challenge,
  images,
  disabled,
  onChange,
  onMove,
  onRemove,
}) => {
  const { t } = useTranslation()
  const set = (changes: Partial<ProposedChallenge>) => onChange({ ...challenge, ...changes })

  return (
    <div className={classes.item}>
      <div className={classes.itemHead}>
        <span>
          {t('range.studio.proposal.challenge', { n: index + 1 })}
          {challenge.title && `: ${challenge.title}`}
        </span>
        {!disabled && <ItemControls index={index} count={count} onMove={onMove} onRemove={onRemove} />}
      </div>
      <div className={classes.row}>
        <TextInput
          label={t('range.studio.column.title')}
          maxLength={60}
          value={challenge.title}
          onChange={(event) => set({ title: event.currentTarget.value })}
          disabled={disabled}
        />
        <Select
          label={t('range.studio.proposal.category')}
          data={GAME_CATEGORIES}
          value={challenge.category}
          onChange={(category) => set({ category: category ?? 'Misc' })}
          allowDeselect={false}
          disabled={disabled}
        />
        <NumberInput
          label={t('range.studio.proposal.points')}
          min={10}
          max={5000}
          value={challenge.points}
          onChange={(points) => set({ points: Number(points) || 100 })}
          disabled={disabled}
        />
        <NumberInput
          label={t('range.studio.proposal.attempts')}
          description={t('range.studio.proposal.attempts_hint')}
          min={0}
          max={50}
          value={challenge.attempts}
          onChange={(attempts) => set({ attempts: Number(attempts) || 0 })}
          disabled={disabled}
        />
      </div>
      <Textarea
        label={t('range.studio.proposal.task')}
        description={t('range.studio.markdown_hint')}
        autosize
        minRows={3}
        maxRows={16}
        value={challenge.description}
        onChange={(event) => set({ description: event.currentTarget.value })}
        disabled={disabled}
      />
      <TagsInput
        label={t('range.studio.proposal.hints')}
        description={t('range.studio.proposal.hints_hint')}
        value={challenge.hints}
        onChange={(hints) => set({ hints })}
        splitChars={[]}
        maxTags={5}
        disabled={disabled}
      />
      <Labelled label={t('range.studio.proposal.kind')}>
        <SegmentedControl
          value={challenge.kind}
          onChange={(kind) => set({ kind: kind === 'container' ? 'container' : 'static' })}
          disabled={disabled}
          data={[
            { value: 'static', label: t('range.studio.proposal.kind_static') },
            { value: 'container', label: t('range.studio.proposal.kind_container') },
          ]}
        />
      </Labelled>
      {challenge.kind === 'static' ? (
        <TagsInput
          label={t('range.studio.proposal.flags')}
          description={t('range.studio.proposal.flags_hint')}
          placeholder="udsm{...}"
          value={challenge.flags}
          onChange={(flags) => set({ flags })}
          splitChars={[' ']}
          maxTags={5}
          disabled={disabled}
          styles={mono}
        />
      ) : (
        <div className={classes.row}>
          <Select
            label={t('range.studio.machine.image')}
            description={t('range.studio.machine.image_hint')}
            data={!challenge.image || images.includes(challenge.image) ? images : [challenge.image, ...images]}
            value={challenge.image || null}
            onChange={(image) => set({ image: image ?? '' })}
            searchable
            disabled={disabled}
          />
          <NumberInput
            label={t('range.studio.machine.port')}
            min={1}
            max={65535}
            value={challenge.port}
            onChange={(port) => set({ port: Number(port) || 80 })}
            disabled={disabled}
          />
          <TextInput
            label={t('range.studio.machine.flag')}
            description={t('range.studio.proposal.template_hint')}
            value={challenge.flagTemplate}
            onChange={(event) => set({ flagTemplate: event.currentTarget.value.trim() })}
            disabled={disabled}
            styles={mono}
          />
        </div>
      )}
    </div>
  )
}

// A proposed game: its author fills it in and submits it; the superadmin approves it, which
// creates the game on the platform, or sends it back with a note.
const ProposalPage: FC = () => {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const refresh = useRangeRefresh()
  const { data, error, mutate } = useProposal(id)
  const proposal = data?.id === id ? data : undefined
  const { data: images = [] } = useMachineImages(Boolean(proposal))
  // what was changed here and not saved yet
  const [edited, setEdited] = useState<ProposalData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const value = edited ?? proposal?.data
  usePageTitle(value?.title || t('range.studio.proposal.untitled'))

  const disabled = !proposal?.canEdit
  const set = (changes: Partial<ProposalData>) => value && setEdited({ ...value, ...changes })
  const setChallenges = (challenges: ProposedChallenge[]) => set({ challenges })

  // Runs one action; whatever it returns becomes the proposal on screen.
  const run = async (what: string, work: () => Promise<Proposal | void>) => {
    setBusy(what)
    try {
      const next = await work()
      if (next) {
        await mutate(next, { revalidate: false })
        setEdited(null)
      }
      refresh()
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(null)
    }
  }

  const save = () => run('save', () => proposalsApi.save(id, value!))
  const submit = () =>
    run('submit', async () => {
      if (edited) await mutate(await proposalsApi.save(id, edited), { revalidate: false })
      setEdited(null)
      return proposalsApi.submit(id)
    })
  const approve = () => {
    if (!window.confirm(t('range.studio.proposal.approve_confirm'))) return
    run('approve', async () => {
      const next = await proposalsApi.approve(id)
      showNotification({ color: 'teal', message: t('range.studio.proposal.approved_note') })
      return next
    })
  }
  const reject = () =>
    run('reject', async () => {
      const next = await proposalsApi.reject(id, note)
      setRejecting(false)
      return next
    })
  const remove = () => {
    if (!window.confirm(t('range.studio.delete_confirm'))) return
    run('remove', async () => {
      await proposalsApi.remove(id)
      navigate(studioUrl.home)
    })
  }

  return (
    <RangePage isLoading={!proposal && !error}>
      <div className={cx(range.container, range.page)}>
        <Link to={studioUrl.home} className={range.link} style={{ display: 'inline-block', marginBottom: 20 }}>
          {t('range.studio.back')}
        </Link>

        {error && (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.studio.proposal.not_found') : error.message}
          </Note>
        )}

        {proposal && value && (
          <div className={classes.form}>
            <div className={classes.bar}>
              <div className={classes.barTitle}>
                <h1>{value.title || t('range.studio.proposal.untitled')}</h1>
                <div className={range.labels}>
                  <StatusChip status={proposal.status} />
                  <span className={range.dim}>
                    {t('range.studio.by', { name: proposal.mine ? t('range.studio.you') : proposal.author })} ·{' '}
                    {ago(proposal.updatedAt, i18n.language)}
                  </span>
                </div>
              </div>
              <div className={classes.actions}>
                {proposal.canEdit && (
                  <>
                    <Button variant="default" loading={busy === 'save'} disabled={!edited} onClick={save}>
                      {t('range.studio.save')}
                    </Button>
                    <Button loading={busy === 'submit'} onClick={submit} leftSection={<Uicon name="paper-plane" />}>
                      {t('range.studio.proposal.submit')}
                    </Button>
                  </>
                )}
                {proposal.mine && proposal.status === 'submitted' && (
                  <Button
                    variant="default"
                    loading={busy === 'withdraw'}
                    onClick={() => run('withdraw', () => proposalsApi.withdraw(id))}
                    leftSection={<Uicon name="undo" />}
                  >
                    {t('range.studio.proposal.withdraw')}
                  </Button>
                )}
                {proposal.canReview && (
                  <>
                    <Button variant="default" color="red" onClick={() => setRejecting(true)}>
                      {t('range.studio.proposal.reject')}
                    </Button>
                    <Button
                      color="teal"
                      loading={busy === 'approve'}
                      onClick={approve}
                      leftSection={<Uicon name="check" />}
                    >
                      {t('range.studio.proposal.approve')}
                    </Button>
                  </>
                )}
                {proposal.canEdit && (
                  <Button variant="subtle" color="red" loading={busy === 'remove'} onClick={remove}>
                    {t('range.studio.delete')}
                  </Button>
                )}
              </div>
            </div>

            {proposal.status === 'approved' && proposal.gameId && (
              <Note tone="done" icon="check">
                {t('range.studio.proposal.live', { name: proposal.reviewer ?? '' })}{' '}
                <Link to={`/games/${proposal.gameId}`} className={range.link}>
                  {t('range.studio.proposal.open_game')}
                </Link>
              </Note>
            )}
            {proposal.status === 'submitted' && !proposal.canReview && (
              <Note icon="clock">{t('range.studio.proposal.waiting')}</Note>
            )}
            {proposal.status === 'rejected' && proposal.note && (
              <Note tone="warn" icon="triangle-warning">
                <strong>{t('range.studio.proposal.sent_back', { name: proposal.reviewer ?? '' })}</strong>{' '}
                {proposal.note}
              </Note>
            )}
            {proposal.status !== 'approved' && proposal.problems.length > 0 && (
              <Note icon="info">
                {t('range.studio.proposal.before')}
                <ul className={classes.problems}>
                  {proposal.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </Note>
            )}

            <section className={classes.panel}>
              <div className={classes.panelHead}>
                <h2>{t('range.studio.proposal.game')}</h2>
              </div>
              <div className={classes.row}>
                <TextInput
                  label={t('range.studio.column.title')}
                  maxLength={80}
                  value={value.title}
                  onChange={(event) => set({ title: event.currentTarget.value })}
                  disabled={disabled}
                />
                <TextInput
                  label={t('range.studio.summary')}
                  description={t('range.studio.summary_hint')}
                  maxLength={300}
                  value={value.summary}
                  onChange={(event) => set({ summary: event.currentTarget.value })}
                  disabled={disabled}
                />
              </div>
              <MarkdownField
                label={t('range.studio.proposal.about')}
                value={value.description}
                onChange={(description) => set({ description })}
                minRows={5}
                disabled={disabled}
              />
              <div className={classes.row}>
                <DateTimePicker
                  label={t('range.studio.proposal.start')}
                  valueFormat="L LT"
                  value={value.start ? new Date(value.start) : null}
                  onChange={(start) => set({ start: start ? dayjs(start).toISOString() : null })}
                  disabled={disabled}
                />
                <DateTimePicker
                  label={t('range.studio.proposal.end')}
                  valueFormat="L LT"
                  minDate={value.start ? new Date(value.start) : undefined}
                  value={value.end ? new Date(value.end) : null}
                  onChange={(end) => set({ end: end ? dayjs(end).toISOString() : null })}
                  disabled={disabled}
                />
                <Labelled label={t('range.studio.proposal.played')}>
                  <SegmentedControl
                    fullWidth
                    value={value.type}
                    onChange={(type) => set({ type: type === 'team' ? 'team' : 'individual' })}
                    disabled={disabled}
                    data={[
                      { value: 'individual', label: t('range.studio.proposal.individual') },
                      { value: 'team', label: t('range.studio.proposal.team') },
                    ]}
                  />
                </Labelled>
                {value.type === 'team' && (
                  <NumberInput
                    label={t('range.studio.proposal.team_size')}
                    min={2}
                    max={20}
                    value={value.teamSize}
                    onChange={(teamSize) => set({ teamSize: Number(teamSize) || 2 })}
                    disabled={disabled}
                  />
                )}
              </div>
            </section>

            <section className={classes.panel}>
              <div className={classes.panelHead}>
                <h2>{t('range.studio.proposal.challenges', { count: value.challenges.length })}</h2>
              </div>
              {value.challenges.map((challenge, index) => (
                <ChallengeFields
                  key={index}
                  index={index}
                  count={value.challenges.length}
                  challenge={challenge}
                  images={images}
                  disabled={disabled}
                  onChange={(next) => setChallenges(replaced(value.challenges, index, next))}
                  onMove={(by) => setChallenges(moved(value.challenges, index, by))}
                  onRemove={() => setChallenges(without(value.challenges, index))}
                />
              ))}
              {!disabled && (
                <button
                  type="button"
                  className={range.button}
                  data-variant="subtle"
                  style={{ justifySelf: 'start' }}
                  disabled={value.challenges.length >= 50}
                  onClick={() => setChallenges([...value.challenges, newChallenge()])}
                >
                  <Uicon name="plus" />
                  {t('range.studio.proposal.add_challenge')}
                </button>
              )}
            </section>
          </div>
        )}

        <Modal opened={rejecting} onClose={() => setRejecting(false)} title={t('range.studio.proposal.reject')}>
          <Stack>
            <Textarea
              data-autofocus
              label={t('range.studio.proposal.reject_note')}
              autosize
              minRows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <Button color="red" loading={busy === 'reject'} disabled={!note.trim()} onClick={reject}>
              {t('range.studio.proposal.reject')}
            </Button>
          </Stack>
        </Modal>

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default ProposalPage
