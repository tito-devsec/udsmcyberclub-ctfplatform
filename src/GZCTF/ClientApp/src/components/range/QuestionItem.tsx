import { Button, Collapse } from '@mantine/core'
import { FC, FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { Label, Xp } from '@Components/range/Parts'
import { AnswerResult, Question } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import classes from '@Styles/Range.module.css'

interface QuestionItemProps {
  number: number
  question: Question
  // sends an answer to this question and says whether it was right
  submit: (answer: string) => Promise<AnswerResult>
  onAnswered: (result: AnswerResult) => void
  // "Question" for a section, "Task" for a lab
  label?: string
}

// One question of a section: what it asks, what it is worth, and a box for the answer.
export const QuestionItem: FC<QuestionItemProps> = ({ number, question, submit, onAnswered, label }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(!question.solved)
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim() || sending) return
    setSending(true)
    try {
      const result = await submit(answer)
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
          {label ?? t('range.question.number', { n: number })}
          {question.flag && (
            <Label icon="flag-alt">
              {t(
                question.flagKind === 'user'
                  ? 'range.question.user_flag'
                  : question.flagKind === 'root'
                    ? 'range.question.root_flag'
                    : 'range.question.flag'
              )}
            </Label>
          )}
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
            <form onSubmit={send}>
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
