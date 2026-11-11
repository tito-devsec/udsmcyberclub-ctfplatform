import { Anchor, Button, Group, Stack, Text, TextInput, ThemeIcon } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { mdiCheck, mdiClose, mdiFlagOutline, mdiLightbulbOnOutline } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnswerResult, LabQuestion, labsApi } from '@Utils/Labs'

interface QuestionRowProps {
  path: string
  lab: string
  question: LabQuestion
  onAnswered: (result: AnswerResult) => void
}

export const QuestionRow: FC<QuestionRowProps> = ({ path, lab, question, onAnswered }) => {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim() || sending) return
    setSending(true)
    try {
      const result = await labsApi.answer(path, lab, question.id, answer)
      setWrong(!result.correct)
      if (result.correct) setAnswer('')
      onAnswered(result)
    } catch (error) {
      showNotification({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
        icon: <Icon path={mdiClose} size={1} />,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {question.flag && (
          <ThemeIcon size="sm" variant="light" mt={2}>
            <Icon path={mdiFlagOutline} size={0.6} />
          </ThemeIcon>
        )}
        <Text fw={600}>{question.question}</Text>
      </Group>
      {question.solved ? (
        <Group gap="xs" c="teal">
          <Icon path={mdiCheck} size={0.8} />
          <Text size="sm" fw={600}>
            {t('labs.question.correct')}
          </Text>
        </Group>
      ) : (
        <form onSubmit={submit}>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <TextInput
              flex={1}
              value={answer}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              placeholder={question.flag ? 'udsm{...}' : (question.format ?? t('labs.question.placeholder'))}
              aria-label={question.question}
              error={wrong ? t('labs.question.wrong') : undefined}
              onChange={(event) => {
                setAnswer(event.currentTarget.value)
                setWrong(false)
              }}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
            />
            <Button type="submit" loading={sending} disabled={!answer.trim()}>
              {t('labs.question.submit')}
            </Button>
          </Group>
        </form>
      )}
      {question.hint && !question.solved && (
        <div>
          {showHint ? (
            <Group gap={6} wrap="nowrap" align="flex-start" c="dimmed">
              <Icon path={mdiLightbulbOnOutline} size={0.7} style={{ flexShrink: 0, marginTop: 2 }} />
              <Text size="sm">{question.hint}</Text>
            </Group>
          ) : (
            <Anchor component="button" type="button" size="sm" onClick={() => setShowHint(true)}>
              {t('labs.question.show_hint')}
            </Anchor>
          )}
        </div>
      )}
    </Stack>
  )
}
