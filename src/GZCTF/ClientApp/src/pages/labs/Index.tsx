import { Alert, Stack, Text, Timeline, Title } from '@mantine/core'
import { mdiAlertCircleOutline, mdiDotsHorizontal, mdiSchoolOutline } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { WithNavBar } from '@Components/WithNavbar'
import { PathCard } from '@Components/labs/PathCard'
import { usePaths } from '@Utils/Labs'
import { usePageTitle } from '@Hooks/usePageTitle'

// The roadmap: every learning path, in order, with the student's progress.
const LabsRoadmap: FC = () => {
  const { t } = useTranslation()
  const { data: paths, error } = usePaths()

  usePageTitle(t('labs.roadmap.title'))

  return (
    <WithNavBar withHeader withFooter stickyHeader minWidth={0} isLoading={!paths && !error}>
      <Stack gap="xl" py="xl" w="100%" maw={860} mx="auto">
        <Stack gap={6}>
          <Title order={1}>{t('labs.roadmap.title')}</Title>
          <Text c="dimmed" maw={680}>
            {t('labs.roadmap.description')}
          </Text>
        </Stack>

        {error && (
          <Alert color="red" icon={<Icon path={mdiAlertCircleOutline} />}>
            {error.message}
          </Alert>
        )}

        {paths && (
          <Timeline active={paths.length - 1} bulletSize={36} lineWidth={2}>
            {paths.map((path) => (
              <Timeline.Item key={path.slug} bullet={<Icon path={mdiSchoolOutline} size={0.85} />}>
                <PathCard path={path} />
              </Timeline.Item>
            ))}
            <Timeline.Item bullet={<Icon path={mdiDotsHorizontal} size={0.85} />} lineVariant="dashed">
              <Text c="dimmed" size="sm" pt={6}>
                {t('labs.roadmap.more_coming')}
              </Text>
            </Timeline.Item>
          </Timeline>
        )}
      </Stack>
    </WithNavBar>
  )
}

export default LabsRoadmap
