import { NumberInput, SegmentedControl, Select, Switch, TagsInput, Textarea, TextInput, Tooltip } from '@mantine/core'
import { FC, PropsWithChildren, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { SafeMarkdown } from '@Components/range/SafeMarkdown'
import { FlagKind } from '@Utils/Range'
import { FLAG_FIELD, flagKindOf, MachineDraft, QuestionDraft } from '@Utils/Studio'
import { UiconName } from '@Utils/Uicons'
import range from '@Styles/Range.module.css'
import classes from '@Styles/Studio.module.css'

// ---- lists, changed without touching the old one ----

export function moved<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  next[index] = list[to]
  next[to] = list[index]
  return next
}

export const replaced = <T,>(list: T[], index: number, item: T): T[] =>
  list.map((old, at) => (at === index ? item : old))

export const without = <T,>(list: T[], index: number): T[] => list.filter((_, at) => at !== index)

const mono = { input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: '0.9rem' } }

// Where a draft, a document or a proposal stands.
export const StatusChip: FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation()
  return (
    <span className={classes.status} data-status={status}>
      {t(`range.studio.status.${status}`)}
    </span>
  )
}

interface IconButtonProps {
  icon: UiconName
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

export const IconButton: FC<IconButtonProps> = ({ icon, label, onClick, disabled, danger }) => (
  <Tooltip label={label} withArrow openDelay={300}>
    <button
      type="button"
      className={classes.iconButton}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-danger={danger || undefined}
    >
      <Uicon name={icon} />
    </button>
  </Tooltip>
)

interface ItemControlsProps {
  index: number
  count: number
  onMove: (by: -1 | 1) => void
  onRemove: () => void
  disabled?: boolean
}

// Up, down and remove, for one item of a list.
export const ItemControls: FC<ItemControlsProps> = ({ index, count, onMove, onRemove, disabled }) => {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <IconButton
        icon="arrow-small-up"
        label={t('range.studio.move_up')}
        onClick={() => onMove(-1)}
        disabled={disabled || index === 0}
      />
      <IconButton
        icon="arrow-small-down"
        label={t('range.studio.move_down')}
        onClick={() => onMove(1)}
        disabled={disabled || index === count - 1}
      />
      <IconButton icon="trash" label={t('range.studio.remove')} onClick={onRemove} disabled={disabled} danger />
    </div>
  )
}

// A label over something that has none of its own.
export const Labelled: FC<PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <div>
    <div style={{ marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>{label}</div>
    {children}
  </div>
)

interface MarkdownFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  minRows?: number
  disabled?: boolean
}

// Markdown, with a look at how it will read.
export const MarkdownField: FC<MarkdownFieldProps> = ({ label, value, onChange, minRows = 8, disabled }) => {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(false)

  return (
    <div>
      <div className={range.between} style={{ marginBottom: 6 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
        <SegmentedControl
          size="xs"
          value={preview ? 'preview' : 'write'}
          onChange={(mode) => setPreview(mode === 'preview')}
          data={[
            { value: 'write', label: t('range.studio.write') },
            { value: 'preview', label: t('range.studio.preview') },
          ]}
        />
      </div>
      {preview ? (
        <div className={classes.preview}>
          {value.trim() ? (
            <SafeMarkdown source={value} className={range.prose} />
          ) : (
            <span className={range.dim}>{t('range.studio.nothing_yet')}</span>
          )}
        </div>
      ) : (
        <Textarea
          aria-label={label}
          description={t('range.studio.markdown_hint')}
          autosize
          minRows={minRows}
          maxRows={32}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          disabled={disabled}
          styles={mono}
        />
      )}
    </div>
  )
}

// A new machine, with flags to change: a boot-to-root machine's user and root flags, or the one
// flag of any other.
export const newMachine = (images: string[], b2r = false): MachineDraft =>
  b2r
    ? {
        image: images[0] ?? '',
        port: 80,
        memory: 256,
        userFlag: 'udsm{user_change_these_words_[USER_HASH]}',
        rootFlag: 'udsm{root_change_these_words_[USER_HASH]}',
      }
    : { image: images[0] ?? '', port: 80, flag: 'udsm{change_these_words_[USER_HASH]}' }

interface MachineFieldsProps {
  value: MachineDraft | undefined
  onChange: (value: MachineDraft | undefined) => void
  // the images on the server that may be used
  images: string[]
  // a boot-to-root lab's machine, which has a user flag and a root flag
  b2r?: boolean
  disabled?: boolean
}

// The machine a student starts for a section or a lab: its image, its port, its memory and its
// flag, or a boot-to-root machine's two.
export const MachineFields: FC<MachineFieldsProps> = ({ value, onChange, images, b2r, disabled }) => {
  const { t } = useTranslation()

  const flagInput = (kind: FlagKind, label: string, hint: string) => {
    const field = FLAG_FIELD[kind]
    return (
      value && (
        <TextInput
          label={t(label)}
          description={t(hint)}
          value={value[field] ?? ''}
          onChange={(event) => onChange({ ...value, [field]: event.currentTarget.value.trim() || undefined })}
          disabled={disabled}
          styles={mono}
        />
      )
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* a boot-to-root lab is its machine: it always has one */}
      {!b2r && (
        <Switch
          label={t('range.studio.machine.use')}
          description={t('range.studio.machine.use_hint')}
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked ? newMachine(images) : undefined)}
        />
      )}
      {value && (
        <div className={classes.row}>
          <Select
            label={t('range.studio.machine.image')}
            description={t('range.studio.machine.image_hint')}
            data={!value.image || images.includes(value.image) ? images : [value.image, ...images]}
            value={value.image || null}
            onChange={(image) => onChange({ ...value, image: image ?? '' })}
            searchable
            allowDeselect={false}
            disabled={disabled}
          />
          <NumberInput
            label={t('range.studio.machine.port')}
            description={t('range.studio.machine.port_hint')}
            min={1}
            max={65535}
            value={value.port}
            onChange={(port) => onChange({ ...value, port: Number(port) || 80 })}
            disabled={disabled}
          />
          <NumberInput
            label={t('range.studio.machine.memory')}
            description={t('range.studio.machine.memory_hint')}
            min={16}
            max={1024}
            step={16}
            value={value.memory ?? 64}
            onChange={(memory) => onChange({ ...value, memory: Number(memory) || 64 })}
            disabled={disabled}
          />
          {b2r ? (
            <>
              {flagInput('user', 'range.studio.machine.user_flag', 'range.studio.machine.user_flag_hint')}
              {flagInput('root', 'range.studio.machine.root_flag', 'range.studio.machine.root_flag_hint')}
            </>
          ) : (
            flagInput('flag', 'range.studio.machine.flag', 'range.studio.machine.flag_hint')
          )}
        </div>
      )}
    </div>
  )
}

interface QuestionsEditorProps {
  value: QuestionDraft[]
  onChange: (value: QuestionDraft[]) => void
  // the machine whose flags may be asked for
  machine: MachineDraft | undefined
  // a boot-to-root lab, whose tasks may ask for the user flag and the root flag
  b2r?: boolean
  // what they are called: a section has questions, a lab has tasks
  noun: 'question' | 'task'
  disabled?: boolean
}

// how a question is answered, as the SegmentedControl below names it
type AnsweredWith = 'answer' | FlagKind

// The questions of a section, or the tasks of a lab.
export const QuestionsEditor: FC<QuestionsEditorProps> = ({ value, onChange, machine, b2r, noun, disabled }) => {
  const { t } = useTranslation()
  const set = (index: number, changes: Partial<QuestionDraft>) =>
    onChange(replaced(value, index, { ...value[index], ...changes }))

  const flags: { kind: FlagKind; label: string }[] = b2r
    ? [
        { kind: 'user', label: t('range.studio.question.the_user_flag') },
        { kind: 'root', label: t('range.studio.question.the_root_flag') },
      ]
    : [{ kind: 'flag', label: t('range.studio.question.the_flag') }]

  const answerWith = (question: QuestionDraft, kind: AnsweredWith): Partial<QuestionDraft> =>
    kind === 'answer'
      ? { flag: undefined, answer: question.answer ?? [], xp: question.xp === 40 ? 10 : question.xp }
      : {
          flag: kind === 'flag' ? true : kind,
          answer: undefined,
          caseSensitive: undefined,
          xp: question.xp === 10 ? 40 : question.xp,
        }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {value.map((question, index) => (
        <div key={index} className={classes.item}>
          <div className={classes.itemHead}>
            <span>{t(`range.studio.${noun}.numbered`, { n: index + 1 })}</span>
            <ItemControls
              index={index}
              count={value.length}
              onMove={(by) => onChange(moved(value, index, by))}
              onRemove={() => onChange(without(value, index))}
              disabled={disabled}
            />
          </div>
          <Textarea
            label={t(`range.studio.${noun}.text`)}
            autosize
            minRows={1}
            maxRows={6}
            value={question.question}
            onChange={(event) => set(index, { question: event.currentTarget.value })}
            disabled={disabled}
          />
          <div className={classes.row}>
            <Labelled label={t('range.studio.question.answered_with')}>
              <SegmentedControl
                fullWidth
                value={flagKindOf(question) ?? 'answer'}
                onChange={(kind) => set(index, answerWith(question, kind as AnsweredWith))}
                disabled={disabled}
                data={[
                  { value: 'answer', label: t('range.studio.question.an_answer') },
                  ...flags.map(({ kind, label }) => ({
                    value: kind,
                    label,
                    disabled: !machine?.[FLAG_FIELD[kind]],
                  })),
                ]}
              />
            </Labelled>
            <NumberInput
              label={t('range.studio.question.xp')}
              min={0}
              max={1000}
              value={question.xp}
              onChange={(xp) => set(index, { xp: Number(xp) || 0 })}
              disabled={disabled}
            />
          </div>
          {!flagKindOf(question) && (
            <>
              <TagsInput
                label={t('range.studio.question.answers')}
                description={t('range.studio.question.answers_hint')}
                value={question.answer ?? []}
                onChange={(answer) => set(index, { answer })}
                splitChars={[]}
                disabled={disabled}
              />
              <div className={classes.row}>
                <TextInput
                  label={t('range.studio.question.format')}
                  description={t('range.studio.question.format_hint')}
                  placeholder="****"
                  value={question.format ?? ''}
                  onChange={(event) => set(index, { format: event.currentTarget.value || undefined })}
                  disabled={disabled}
                  styles={mono}
                />
                <Switch
                  mt={28}
                  label={t('range.studio.question.case')}
                  checked={Boolean(question.caseSensitive)}
                  onChange={(event) => set(index, { caseSensitive: event.currentTarget.checked || undefined })}
                  disabled={disabled}
                />
              </div>
            </>
          )}
          <TextInput
            label={t('range.studio.question.hint')}
            value={question.hint ?? ''}
            onChange={(event) => set(index, { hint: event.currentTarget.value || undefined })}
            disabled={disabled}
          />
        </div>
      ))}
      <button
        type="button"
        className={range.button}
        data-variant="subtle"
        style={{ justifySelf: 'start' }}
        onClick={() => onChange([...value, { question: '', answer: [], xp: 10 }])}
        disabled={disabled || value.length >= 30}
      >
        <Uicon name="plus" />
        {t(`range.studio.${noun}.add`)}
      </button>
    </div>
  )
}
