import { Badge, Button, Card, Group, Progress, Stack, Text, Title } from '@mantine/core'
import { mdiArrowRight, mdiClockOutline, mdiFlaskOutline } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PathSummary, pathUrl } from '@Utils/Labs'

export const PathCard: FC<{ path: PathSummary }> = ({ path }) => {
  const { t } = useTranslation()
  const percent = path.labs ? (path.completedLabs / path.labs) * 100 : 0
  const action = path.completedLabs === 0 ? 'start' : path.completedLabs === path.labs ? 'review' : 'continue'

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group gap="xs">
          <Badge variant="light">{t(`labs.level.${path.level}`, { defaultValue: path.level })}</Badge>
          <Badge variant="outline" color="gray" leftSection={<Icon path={mdiFlaskOutline} size={0.55} />}>
            {t('labs.count.labs', { count: path.labs })}
          </Badge>
          <Badge variant="outline" color="gray" leftSection={<Icon path={mdiClockOutline} size={0.55} />}>
            {t('labs.count.hours', { count: Math.max(1, Math.round(path.minutes / 60)) })}
          </Badge>
        </Group>
        <Title order={3}>{path.title}</Title>
        <Text c="dimmed">{path.summary}</Text>
        <Stack gap={4}>
          <Progress value={percent} size="sm" radius="xl" color={percent === 100 ? 'teal' : undefined} />
          <Text size="xs" c="dimmed">
            {t('labs.path.progress', { done: path.completedLabs, total: path.labs })}
          </Text>
        </Stack>
        <Group justify="flex-end">
          <Button component={Link} to={pathUrl(path.slug)} rightSection={<Icon path={mdiArrowRight} size={0.8} />}>
            {t(`labs.roadmap.${action}`)}
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
