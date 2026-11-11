import { Button, Collapse } from '@mantine/core'
import { FC, FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { Label, Xp } from '@Components/range/Parts'
import { AnswerResult, Question, rangeApi } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import classes from '@Styles/Range.module.css'

interface QuestionItemProps {
  module: string
  section: string
  number: number
  question: Question
  onAnswered: (result: AnswerResult) => void
}

// One question of a section: what it asks, what it is worth, and a box for the answer.
export const QuestionItem: FC<QuestionItemProps> = ({ module, section, number, question, onAnswered }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(!question.solved)
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim() || sending) return
    setSending(true)
    try {
      const result = await rangeApi.answer(module, section, question.id, answer)
      setWrong(!result.correct)
      if (result.correct) setAnswer('')
      onAnswered(result)
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={classes.question} data-solved={question.solved || undefined}>
      <button type="button" className={classes.questionHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {question.solved && <Uicon name="check-circle-solid" style={{ color: 'var(--r-done)' }} />}
          {t('range.question.number', { n: number })}
          {question.flag && <Label icon="flag-alt">{t('range.question.flag')}</Label>}
        </span>
        <Xp value={question.xp} plus pill />
        <Uicon name="angle-small-down" size={20} className={classes.chevron} data-open={open || undefined} />
      </button>

      <Collapse expanded={open}>
        <div className={classes.questionBody}>
          <p className={classes.questionText}>{question.question}</p>

          {question.solved ? (
            <span className={classes.done}>
              <Uicon name="check" />
              {t('range.question.correct')}
            </span>
          ) : (
            <form onSubmit={submit}>
              <div className={classes.answerRow}>
                <input
                  className={classes.answerInput}
                  value={answer}
                  maxLength={200}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={question.flag ? 'udsm{...}' : (question.format ?? t('range.question.placeholder'))}
                  aria-label={question.question}
                  data-wrong={wrong || undefined}
                  onChange={(event) => {
                    setAnswer(event.currentTarget.value)
                    setWrong(false)
                  }}
                />
                <Button type="submit" size="md" radius="sm" loading={sending} disabled={!answer.trim()}>
                  {t('range.question.submit')}
                </Button>
              </div>
            </form>
          )}

          {wrong && <span className={classes.wrong}>{t('range.question.wrong')}</span>}

          {question.hint &&
            !question.solved &&
            (showHint ? (
              <div className={classes.hint}>
                <Uicon name="bulb" />
                <span>{question.hint}</span>
              </div>
            ) : (
              <div>
                <button type="button" className={classes.link} onClick={() => setShowHint(true)}>
                  {t('range.question.show_hint')}
                </button>
              </div>
            ))}
        </div>
      </Collapse>
    </div>
  )
}
