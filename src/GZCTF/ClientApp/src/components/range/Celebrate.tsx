import { showNotification } from '@mantine/notifications'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { Outcome } from '@Utils/Range'

// Says what a right answer earned: the XP, then a finished section, module or lab, and a
// new level or rank when there is one.
export function useCelebrate(what: 'section' | 'lab') {
  const { t } = useTranslation()

  return useCallback(
    (outcome: Outcome) => {
      const lab = what === 'lab'
      if (outcome.xp > 0) {
        showNotification({
          color: 'teal',
          title: !lab && outcome.sectionCompleted ? t('range.section.completed') : t('range.question.correct'),
          message: t('range.xp.gained', { xp: outcome.xp }),
          icon: <Uicon name="check" />,
        })
      }
      if (outcome.moduleCompleted) {
        showNotification({
          color: 'teal',
          title: lab ? t('range.lab.solved_title') : t('range.module.completed_title'),
          message: lab ? t('range.lab.solved_content') : t('range.module.completed_content'),
          icon: <Uicon name="trophy" />,
          autoClose: 8000,
        })
      }
      if (outcome.rankUp && outcome.standing) {
        showNotification({
          color: 'violet',
          title: t('range.rank.up_title'),
          message: t('range.rank.up_content', { rank: outcome.standing.rank }),
          icon: <Uicon name="crown" />,
          autoClose: 10000,
        })
      } else if (outcome.levelUp && outcome.standing) {
        showNotification({
          title: t('range.rank.level_up_title'),
          message: t('range.rank.level_up_content', { level: outcome.standing.level }),
          icon: <Uicon name="sparkles" />,
          autoClose: 8000,
        })
      }
    },
    [t, what]
  )
}
