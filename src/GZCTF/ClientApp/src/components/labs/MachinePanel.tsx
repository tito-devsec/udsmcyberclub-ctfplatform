import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import {
  mdiCheck,
  mdiClockOutline,
  mdiClose,
  mdiContentCopy,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiPlay,
  mdiServerNetwork,
  mdiStop,
  mdiTimerPlusOutline,
} from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { labsApi, MachineInfo } from '@Utils/Labs'

interface MachinePanelProps {
  path: string
  lab: string
  machine: MachineInfo | null | undefined
  onChange: (machine: MachineInfo | null) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeLeft(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(seconds % 60)}` : `${pad(m)}:${pad(seconds % 60)}`
}

export const MachinePanel: FC<MachinePanelProps> = ({ path, lab, machine, onChange }) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'start' | 'extend' | 'stop' | null>(null)
  // the countdown's clock, moved on every second while a machine runs
  const [now, setNow] = useState(() => Date.now())

  const mine = machine && machine.path === path && machine.lab === lab ? machine : null
  const other = machine && !mine ? machine : null

  useEffect(() => {
    if (!mine) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [mine])

  useEffect(() => {
    // the machine has expired: the service removes it, so stop showing it
    if (mine && new Date(mine.expiresAt).getTime() <= now) onChange(null)
  }, [mine, now, onChange])

  const run = async (action: 'start' | 'extend' | 'stop') => {
    setBusy(action)
    try {
      if (action === 'start') onChange(await labsApi.startMachine(path, lab))
      else if (action === 'extend') onChange(await labsApi.extendMachine())
      else {
        await labsApi.stopMachine()
        onChange(null)
      }
    } catch (error) {
      showNotification({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
        icon: <Icon path={mdiClose} size={1} />,
      })
    } finally {
      setBusy(null)
    }
  }

  const url = mine ? `http://${mine.entry}` : ''

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group gap="xs">
          <Icon path={mdiServerNetwork} size={0.9} />
          <Title order={4}>{t('labs.machine.title')}</Title>
        </Group>

        {!mine && (
          <>
            <Text size="sm" c="dimmed">
              {t('labs.machine.description')}
            </Text>
            {other && (
              <Alert variant="light" color="yellow" icon={<Icon path={mdiInformationOutline} />} p="xs">
                <Text size="sm">{t('labs.machine.other_lab', { title: other.title })}</Text>
              </Alert>
            )}
            <Button
              leftSection={<Icon path={mdiPlay} size={0.8} />}
              loading={busy === 'start'}
              onClick={() => run('start')}
            >
              {t('labs.machine.start')}
            </Button>
          </>
        )}

        {mine && (
          <>
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {t('labs.machine.address')}
              </Text>
              <Group gap={6} wrap="nowrap">
                <Code fz="sm" style={{ flex: 1, overflowWrap: 'anywhere' }}>
                  {url}
                </Code>
                <CopyButton value={url}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? t('labs.machine.copied') : t('labs.machine.copy')} withArrow>
                      <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                        <Icon path={copied ? mdiCheck : mdiContentCopy} size={0.8} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
                <Tooltip label={t('labs.machine.open')} withArrow>
                  <ActionIcon variant="subtle" color="gray" component="a" href={url} target="_blank" rel="noreferrer">
                    <Icon path={mdiOpenInNew} size={0.8} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Stack>

            <Group gap={6}>
              <Icon path={mdiClockOutline} size={0.8} />
              <Text size="sm">
                {t('labs.machine.time_left')}{' '}
                <Text span fw={700} ff="monospace">
                  {timeLeft(mine.expiresAt, now)}
                </Text>
              </Text>
            </Group>

            <Group grow gap="xs">
              <Tooltip label={t('labs.machine.extend_hint')} disabled={mine.canExtend} withArrow multiline w={220}>
                <Button
                  variant="light"
                  leftSection={<Icon path={mdiTimerPlusOutline} size={0.8} />}
                  disabled={!mine.canExtend}
                  loading={busy === 'extend'}
                  onClick={() => run('extend')}
                >
                  {t('labs.machine.extend')}
                </Button>
              </Tooltip>
              <Button
                variant="light"
                color="red"
                leftSection={<Icon path={mdiStop} size={0.8} />}
                loading={busy === 'stop'}
                onClick={() => run('stop')}
              >
                {t('labs.machine.stop')}
              </Button>
            </Group>

            <Text size="xs" c="dimmed">
              {t('labs.machine.reload_hint')}{' '}
              <Anchor href={url} target="_blank" rel="noreferrer" size="xs">
                {t('labs.machine.open')}
              </Anchor>
            </Text>
          </>
        )}
      </Stack>
    </Card>
  )
}
