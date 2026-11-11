import { ThemeIcon } from '@mantine/core'
import { mdiCheck, mdiLockOutline, mdiPlay } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { LabStatus } from '@Utils/Labs'

const look: Record<LabStatus, { icon: string; color: string; variant: string }> = {
  completed: { icon: mdiCheck, color: 'teal', variant: 'filled' },
  available: { icon: mdiPlay, color: 'brand', variant: 'light' },
  locked: { icon: mdiLockOutline, color: 'gray', variant: 'light' },
}

export const LabStatusIcon: FC<{ status: LabStatus; size?: number }> = ({ status, size = 34 }) => {
  const { icon, color, variant } = look[status]
  return (
    <ThemeIcon radius="xl" size={size} color={color} variant={variant}>
      <Icon path={icon} size={0.75} />
    </ThemeIcon>
  )
}
