import { Button, Modal, Stack, Text } from '@mantine/core'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import {
  forgetPendingSkillLevel,
  pendingSkillLevel,
  rangeApi,
  SKILL_LEVELS,
  SkillLevel,
  SkillLevelIcon,
  useMe,
} from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import classes from '@Styles/Range.module.css'

interface SkillLevelPickerProps {
  value: SkillLevel | null
  onChange: (level: SkillLevel) => void
  disabled?: boolean
}

// Beginner, intermediate or expert, each with a line saying who it is for.
export const SkillLevelPicker: FC<SkillLevelPickerProps> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation()

  return (
    <Stack gap="xs" role="radiogroup" aria-label={t('range.level.label')}>
      {SKILL_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          className={classes.choice}
          data-active={value === level || undefined}
          disabled={disabled}
          onClick={() => onChange(level)}
        >
          <span className={classes.choiceIcon}>
            <Uicon name={SkillLevelIcon[level]} />
          </span>
          <span>
            <Text fw={700}>{t(`range.level.${level}`)}</Text>
            <Text size="sm" c="dimmed">
              {t(`range.level.${level}_hint`)}
            </Text>
          </span>
        </button>
      ))}
    </Stack>
  )
}

// Asks a signed-in student for their skill level when they have none yet. People who
// registered on this device already chose one: theirs is saved without asking again.
export const SkillLevelPrompt: FC = () => {
  const { t } = useTranslation()
  const { data: me, mutate } = useMe()
  const [choice, setChoice] = useState<SkillLevel | null>(null)
  const [saving, setSaving] = useState(false)

  const missing = Boolean(me && !me.skillLevel)
  const chosenAtRegistration = me && missing ? pendingSkillLevel(me.name) : null

  useEffect(() => {
    if (!chosenAtRegistration) return
    rangeApi
      .updateMe({ skillLevel: chosenAtRegistration })
      .then((next) => {
        forgetPendingSkillLevel()
        mutate(next, { revalidate: false })
      })
      .catch(() => {
        // tried again on the next page
      })
  }, [chosenAtRegistration, mutate])

  const save = async () => {
    if (!choice) return
    setSaving(true)
    try {
      mutate(await rangeApi.updateMe({ skillLevel: choice }), { revalidate: false })
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={missing && !chosenAtRegistration}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={t('range.level.ask_title')}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t('range.level.ask_content')}
        </Text>
        <SkillLevelPicker value={choice} onChange={setChoice} disabled={saving} />
        <Button fullWidth disabled={!choice} loading={saving} onClick={save}>
          {t('range.level.continue')}
        </Button>
      </Stack>
    </Modal>
  )
}
