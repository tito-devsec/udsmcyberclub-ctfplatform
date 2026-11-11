import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import {
  mdiAlertCircleOutline,
  mdiArrowLeft,
  mdiArrowRight,
  mdiCheck,
  mdiClockOutline,
  mdiLockOutline,
  mdiPartyPopper,
} from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useSWRConfig } from 'swr'
import { Markdown } from '@Components/MarkdownRenderer'
import { WithNavBar } from '@Components/WithNavbar'
import { WithRole } from '@Components/WithRole'
import { MachinePanel } from '@Components/labs/MachinePanel'
import { QuestionRow } from '@Components/labs/QuestionRow'
import { AnswerResult, DifficultyColor, labUrl, MachineInfo, pathUrl, useLab, useMachine } from '@Utils/Labs'
import { usePageTitle } from '@Hooks/usePageTitle'
import { Role } from '@Api'
import classes from '@Styles/Banner.module.css'

// One lab: its lessons and questions, and the student's own machine.
const LabPage: FC = () => {
  const { path: pathSlug, lab: labSlug } = useParams()
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const { mutate: revalidate } = useSWRConfig()
  const { data: lab, error, mutate } = useLab(pathSlug, labSlug)
  const { data: machine, mutate: setMachine } = useMachine(true)

  usePageTitle(lab?.title ?? t('labs.roadmap.title'))

  const onAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!result.correct) return
      showNotification({
        color: 'teal',
        message: result.labCompleted ? t('labs.lab.completed_title') : t('labs.question.correct'),
        icon: <Icon path={mdiCheck} size={1} />,
      })
      await mutate()
      // the path page and the roadmap show progress too
      revalidate(`/api/labs/paths/${pathSlug}`)
      revalidate('/api/labs/paths')
    },
    [mutate, revalidate, pathSlug, t]
  )

  const onMachine = useCallback((next: MachineInfo | null) => setMachine(next, { revalidate: false }), [setMachine])

  const percent = lab?.total ? (lab.solved / lab.total) * 100 : 0

  return (
    <WithRole requiredRole={Role.User}>
      <WithNavBar width="100%" isLoading={!lab && !error} minWidth={0} withFooter>
        {error ? (
          <Container py="xl">
            <Alert color="red" icon={<Icon path={mdiAlertCircleOutline} />}>
              {error.status === 404 ? t('labs.lab.not_found') : error.message}
            </Alert>
          </Container>
        ) : (
          lab && (
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
                    <Anchor component={Link} to={pathUrl(lab.path.slug)} size="sm">
                      <Group gap={4}>
                        <Icon path={mdiArrowLeft} size={0.6} />
                        {lab.path.title} · {lab.module}
                      </Group>
                    </Anchor>
                    <Group gap="xs">
                      <Badge variant="light" color={DifficultyColor[lab.difficulty]}>
                        {t(`labs.difficulty.${lab.difficulty}`)}
                      </Badge>
                      <Badge variant="outline" color="gray" leftSection={<Icon path={mdiClockOutline} size={0.55} />}>
                        {t('labs.count.minutes', { count: lab.minutes })}
                      </Badge>
                    </Group>
                    <Title className={classes.title}>{lab.title}</Title>
                    <Text c="dimmed" maw={620}>
                      {lab.summary}
                    </Text>
                    {lab.status !== 'locked' && (
                      <Stack gap={4} maw={420}>
                        <Progress value={percent} radius="xl" color={lab.status === 'completed' ? 'teal' : undefined} />
                        <Text size="sm" c="dimmed">
                          {t('labs.lab.progress', { solved: lab.solved, total: lab.total })}
                        </Text>
                      </Stack>
                    )}
                  </Stack>
                </Group>
              </div>

              <Container className={classes.content} size="lg">
                {lab.status === 'locked' ? (
                  <Alert
                    color="gray"
                    variant="light"
                    icon={<Icon path={mdiLockOutline} />}
                    title={t('labs.lab.locked_title')}
                    mb={100}
                  >
                    <Stack gap="sm" align="flex-start">
                      <Text size="sm">{t('labs.lab.locked_content', { title: lab.requires?.title ?? '' })}</Text>
                      {lab.requires && (
                        <Button component={Link} to={labUrl(lab.path.slug, lab.requires.slug)} size="xs">
                          {t('labs.lab.locked_go', { title: lab.requires.title })}
                        </Button>
                      )}
                    </Stack>
                  </Alert>
                ) : (
                  <Grid gap="lg" pb={100}>
                    {lab.machine && (
                      <Grid.Col span={{ base: 12, md: 4 }} order={{ base: 1, md: 2 }}>
                        <div style={{ position: 'sticky', top: theme.spacing.md }}>
                          <MachinePanel path={lab.path.slug} lab={lab.slug} machine={machine} onChange={onMachine} />
                        </div>
                      </Grid.Col>
                    )}
                    <Grid.Col span={{ base: 12, md: lab.machine ? 8 : 12 }} order={{ base: 2, md: 1 }}>
                      <Stack gap="lg">
                        {lab.status === 'completed' && (
                          <Alert
                            color="teal"
                            variant="light"
                            icon={<Icon path={mdiPartyPopper} />}
                            title={t('labs.lab.completed_title')}
                          >
                            <Stack gap="sm" align="flex-start">
                              <Text size="sm">
                                {lab.next ? t('labs.lab.completed_content') : t('labs.lab.path_completed')}
                              </Text>
                              {lab.next ? (
                                <Button
                                  component={Link}
                                  to={labUrl(lab.path.slug, lab.next.slug)}
                                  size="xs"
                                  color="teal"
                                  rightSection={<Icon path={mdiArrowRight} size={0.7} />}
                                >
                                  {t('labs.lab.completed_next', { title: lab.next.title })}
                                </Button>
                              ) : (
                                <Button component={Link} to={pathUrl(lab.path.slug)} size="xs" color="teal">
                                  {t('labs.path.review')}
                                </Button>
                              )}
                            </Stack>
                          </Alert>
                        )}

                        {lab.tasks.map((task, i) => {
                          const taskDone = task.questions.length > 0 && task.questions.every((q) => q.solved)
                          return (
                            <Card key={task.title} withBorder radius="md" p="lg">
                              <Stack gap="md">
                                <Group gap="sm" wrap="nowrap">
                                  {taskDone ? (
                                    <ThemeIcon radius="xl" color="teal" size={28}>
                                      <Icon path={mdiCheck} size={0.65} />
                                    </ThemeIcon>
                                  ) : (
                                    <Badge size="lg" variant="light" circle>
                                      {i + 1}
                                    </Badge>
                                  )}
                                  <Stack gap={0}>
                                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                      {t('labs.lab.task', { n: i + 1 })}
                                    </Text>
                                    <Title order={3}>{task.title}</Title>
                                  </Stack>
                                </Group>
                                <Markdown source={task.content} />
                                {task.questions.length > 0 && (
                                  <>
                                    <Divider label={t('labs.lab.questions')} labelPosition="left" />
                                    <Stack gap="lg">
                                      {task.questions.map((question) => (
                                        <QuestionRow
                                          key={question.id}
                                          path={lab.path.slug}
                                          lab={lab.slug}
                                          question={question}
                                          onAnswered={onAnswered}
                                        />
                                      ))}
                                    </Stack>
                                  </>
                                )}
                              </Stack>
                            </Card>
                          )
                        })}

                        <Group justify="space-between">
                          {lab.previous ? (
                            <Button
                              component={Link}
                              to={labUrl(lab.path.slug, lab.previous.slug)}
                              variant="subtle"
                              leftSection={<Icon path={mdiArrowLeft} size={0.8} />}
                            >
                              {t('labs.lab.previous')}
                            </Button>
                          ) : (
                            <span />
                          )}
                          {lab.next && (
                            <Button
                              component={Link}
                              to={labUrl(lab.path.slug, lab.next.slug)}
                              variant="subtle"
                              rightSection={<Icon path={mdiArrowRight} size={0.8} />}
                            >
                              {t('labs.lab.next')}
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                )}
              </Container>
            </>
          )
        )}
      </WithNavBar>
    </WithRole>
  )
}

export default LabPage
