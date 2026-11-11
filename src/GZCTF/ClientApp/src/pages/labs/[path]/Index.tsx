import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Container,
  Group,
  NavLink,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core'
import {
  mdiAlertCircleOutline,
  mdiArrowLeft,
  mdiArrowRight,
  mdiClockOutline,
  mdiFlaskOutline,
  mdiServerNetwork,
  mdiWeb,
} from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Markdown } from '@Components/MarkdownRenderer'
import { WithNavBar } from '@Components/WithNavbar'
import { LabStatusIcon } from '@Components/labs/LabStatusIcon'
import { DifficultyColor, labUrl, LabSummary, usePath } from '@Utils/Labs'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Banner.module.css'

const LabRow: FC<{ path: string; lab: LabSummary }> = ({ path, lab }) => {
  const { t } = useTranslation()
  const locked = lab.status === 'locked'

  const row = (
    <NavLink
      component={Link}
      to={labUrl(path, lab.slug)}
      disabled={locked}
      py="sm"
      leftSection={<LabStatusIcon status={lab.status} />}
      label={
        <Group gap={6}>
          <Text fw={600}>{lab.title}</Text>
          {lab.machine && (
            <Tooltip label={t('labs.lab.has_machine')} withArrow>
              <Icon path={mdiServerNetwork} size={0.6} />
            </Tooltip>
          )}
        </Group>
      }
      description={lab.summary}
      rightSection={
        <Group gap="xs" wrap="nowrap" visibleFrom="xs">
          {lab.status === 'available' && lab.solved > 0 && (
            <Text size="xs" c="dimmed">
              {lab.solved}/{lab.total}
            </Text>
          )}
          <Badge variant="light" color={DifficultyColor[lab.difficulty]}>
            {t(`labs.difficulty.${lab.difficulty}`)}
          </Badge>
          <Text size="xs" c="dimmed" w={48} ta="right">
            {t('labs.count.minutes', { count: lab.minutes })}
          </Text>
        </Group>
      }
    />
  )

  return locked ? (
    <Tooltip label={t('labs.lab.locked_hint', { title: lab.requires?.title ?? '' })} withArrow position="top-start">
      <div>{row}</div>
    </Tooltip>
  ) : (
    row
  )
}

// A learning path: its modules and labs, and where the student is in it.
const LabPath: FC = () => {
  const { path: slug } = useParams()
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const { data: path, error } = usePath(slug)

  usePageTitle(path?.title ?? t('labs.roadmap.title'))

  const percent = path?.labs ? (path.completedLabs / path.labs) * 100 : 0
  const finished = Boolean(path && path.completedLabs === path.labs)

  const action = !path ? null : !path.signedIn ? (
    <Button component={Link} to={`/account/login?from=/labs/${path.slug}`}>
      {t('labs.path.sign_in')}
    </Button>
  ) : (
    path.next && (
      <Button
        component={Link}
        to={labUrl(path.slug, path.next.slug)}
        rightSection={<Icon path={mdiArrowRight} size={0.8} />}
      >
        {path.completedLabs === 0 ? t('labs.path.start') : t('labs.path.resume')}
      </Button>
    )
  )

  return (
    <WithNavBar width="100%" isLoading={!path && !error} minWidth={0} withFooter>
      {error ? (
        <Container py="xl">
          <Alert color="red" icon={<Icon path={mdiAlertCircleOutline} />}>
            {error.status === 404 ? t('labs.path.not_found') : error.message}
          </Alert>
        </Container>
      ) : (
        path && (
          <>
            <div className={classes.root}>
              <Group
                wrap="nowrap"
                justify="space-between"
                w="100%"
                p={`0 ${theme.spacing.md}`}
                className={classes.container}
              >
                <Stack gap={10} className={classes.flexGrowAtSm}>
                  <Anchor component={Link} to="/labs" size="sm">
                    <Group gap={4}>
                      <Icon path={mdiArrowLeft} size={0.6} />
                      {t('labs.path.back')}
                    </Group>
                  </Anchor>
                  <Group gap="xs">
                    <Badge variant="outline">{t(`labs.level.${path.level}`, { defaultValue: path.level })}</Badge>
                    <Badge variant="outline" color="gray" leftSection={<Icon path={mdiFlaskOutline} size={0.55} />}>
                      {t('labs.count.labs', { count: path.labs })}
                    </Badge>
                    <Badge variant="outline" color="gray" leftSection={<Icon path={mdiClockOutline} size={0.55} />}>
                      {t('labs.count.hours', { count: Math.max(1, Math.round(path.minutes / 60)) })}
                    </Badge>
                  </Group>
                  <Title className={classes.title}>{path.title}</Title>
                  <Text c="dimmed" maw={560}>
                    {path.summary}
                  </Text>
                  {path.signedIn && (
                    <Stack gap={4} maw={420}>
                      <Progress value={percent} radius="xl" color={finished ? 'teal' : undefined} />
                      <Text size="sm" c="dimmed">
                        {t('labs.path.progress', { done: path.completedLabs, total: path.labs })}
                      </Text>
                    </Stack>
                  )}
                  <Group>{action}</Group>
                </Stack>
                <Center visibleFrom="sm" w={220}>
                  <ThemeIcon size={150} radius={150} variant="light">
                    <Icon path={mdiWeb} size={4} />
                  </ThemeIcon>
                </Center>
              </Group>
            </div>

            <Container className={classes.content}>
              <Stack gap="lg" pb={100}>
                {path.description && <Markdown source={path.description} />}
                <Accordion
                  multiple
                  defaultValue={path.modules.map((_, i) => String(i))}
                  variant="separated"
                  radius="md"
                >
                  {path.modules.map((module, i) => {
                    const done = module.labs.filter((lab) => lab.status === 'completed').length
                    return (
                      <Accordion.Item key={module.title} value={String(i)}>
                        <Accordion.Control>
                          <Group justify="space-between" wrap="nowrap" pr="sm">
                            <Stack gap={0}>
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                {t('labs.path.module', { n: i + 1 })}
                              </Text>
                              <Text fw={700} size="lg">
                                {module.title}
                              </Text>
                              {module.summary && (
                                <Text size="sm" c="dimmed">
                                  {module.summary}
                                </Text>
                              )}
                            </Stack>
                            <Badge variant="light" color={done === module.labs.length ? 'teal' : 'gray'}>
                              {done}/{module.labs.length}
                            </Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap={0}>
                            {module.labs.map((lab) => (
                              <LabRow key={lab.slug} path={path.slug} lab={lab} />
                            ))}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    )
                  })}
                </Accordion>
              </Stack>
            </Container>
          </>
        )
      )}
    </WithNavBar>
  )
}

export default LabPath
