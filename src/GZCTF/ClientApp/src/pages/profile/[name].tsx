import { Button, FileButton, Modal, Select, Stack, Textarea, TextInput, Tooltip } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import cx from 'clsx'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { ModuleCard, PathCard } from '@Components/range/Cards'
import { BadgeMedal, PlayerAvatar, VerifiedTick } from '@Components/range/Community'
import { Label, Note, PoweredBy, ProgressBar, variantOf, Xp } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { RankEmblem, RankTitle } from '@Components/range/RankCard'
import {
  ago,
  Certificate,
  certificateNumber,
  certificateUrl,
  COUNTRY_CODES,
  countryName,
  labUrl,
  linkIcon,
  linkUrl,
  Profile,
  profileApi,
  ProfileLinks,
  shortDate,
  useProfile,
} from '@Utils/Community'
import { categoryStyle, coverIcon, percentOf, useRangeRefresh } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import { useUser } from '@Hooks/useUser'
import api from '@Api'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

type Tab = 'modules' | 'module-certificates' | 'paths' | 'path-certificates' | 'game-certificates' | 'labs' | 'badges'

const LINK_KEYS: (keyof ProfileLinks)[] = ['github', 'linkedin', 'x', 'website']
// what the platform accepts as a profile picture
const PICTURE_TYPES = 'image/png,image/jpeg,image/webp,image/gif'
const PICTURE_SIZE = 3 * 1024 * 1024

// A certificate in a list: what it is for, when it was earned and its number.
const CertificateCard: FC<{ certificate: Certificate }> = ({ certificate }) => {
  const { t, i18n } = useTranslation()
  return (
    <Link to={certificateUrl(certificate.id)} className={classes.certCard}>
      <Label icon="diploma">{t(`range.certificate.kind.${certificate.kind}`)}</Label>
      <div className={range.cardTitle}>{certificate.title}</div>
      <div className={range.dim}>
        {t('range.certificate.issued', { date: shortDate(certificate.issuedAt, i18n.language) })}
      </div>
      <div className={range.between}>
        <span className={classes.certNumber}>{certificateNumber(certificate.id)}</span>
        <Uicon name="arrow-right" className={range.dim} />
      </div>
    </Link>
  )
}

interface EditProps {
  profile: Profile
  opened: boolean
  onClose: () => void
  onSaved: (profile: Profile) => void
  // changing the picture
  onPicture: (file: File | null) => void
  uploading: boolean
}

// The owner's own details: a short bio, their country and their links.
const EditProfile: FC<EditProps> = ({ profile, opened, onClose, onSaved, onPicture, uploading }) => {
  const { t, i18n } = useTranslation()
  const [bio, setBio] = useState(profile.bio)
  const [country, setCountry] = useState<string | null>(profile.country)
  const [links, setLinks] = useState<ProfileLinks>(profile.links)
  const [saving, setSaving] = useState(false)

  const countries = useMemo(
    () =>
      COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code, i18n.language) })).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    [i18n.language]
  )

  const save = async () => {
    setSaving(true)
    try {
      onSaved(await profileApi.update({ bio, country, links }))
      onClose()
    } catch (error) {
      showErrorMsg(error, t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('range.profile.edit')} size="lg">
      <Stack>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PlayerAvatar
            name={profile.name}
            avatar={profile.avatar}
            style={{ width: 72, height: 72, borderRadius: '50%', fontSize: '1.8rem', flexShrink: 0 }}
          />
          <div>
            <FileButton onChange={onPicture} accept={PICTURE_TYPES}>
              {(props) => (
                <Button {...props} variant="default" loading={uploading} leftSection={<Uicon name="camera" />}>
                  {t('range.profile.change_picture')}
                </Button>
              )}
            </FileButton>
            <div style={{ marginTop: 6, fontSize: '0.85rem', opacity: 0.7 }}>{t('range.profile.picture_hint')}</div>
          </div>
        </div>
        <Textarea
          label={t('range.profile.bio')}
          placeholder={t('range.profile.bio_hint')}
          maxLength={300}
          autosize
          minRows={3}
          value={bio}
          onChange={(event) => setBio(event.currentTarget.value)}
        />
        <Select
          label={t('range.profile.country')}
          placeholder={t('range.profile.country_hint')}
          data={countries}
          value={country}
          onChange={setCountry}
          searchable
          clearable
        />
        {LINK_KEYS.map((key) => (
          <TextInput
            key={key}
            label={t(`range.profile.link.${key}`)}
            placeholder={t(`range.profile.link.${key}_hint`)}
            leftSection={<Uicon name={linkIcon[key]} />}
            value={links[key] ?? ''}
            onChange={(event) => setLinks({ ...links, [key]: event.currentTarget.value.trim() })}
          />
        ))}
        <Button loading={saving} onClick={save}>
          {t('range.profile.save')}
        </Button>
      </Stack>
    </Modal>
  )
}

// A student's profile: who they are, what they have earned, and everything they finished.
const ProfilePage: FC = () => {
  const { name = '' } = useParams()
  const { t, i18n } = useTranslation()
  const { data, error, mutate } = useProfile(name)
  const refresh = useRangeRefresh()
  const { mutate: mutateUser } = useUser()
  const [tab, setTab] = useState<Tab>('modules')
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)

  // The picture belongs to the platform account: it is sent there, then read back here.
  const changePicture = async (file: File | null) => {
    if (!file) return
    if (file.size > PICTURE_SIZE) {
      showNotification({ color: 'red', message: t('range.profile.picture_too_large') })
      return
    }
    setUploading(true)
    try {
      await api.account.accountAvatar({ file })
      await mutate(await profileApi.sync(), { revalidate: false })
      await mutateUser()
      showNotification({ color: 'teal', message: t('range.profile.picture_saved') })
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setUploading(false)
    }
  }

  // what is on screen may still be the profile that was open before this one
  const profile = data?.name.toLowerCase() === name.toLowerCase() ? data : undefined

  usePageTitle(profile?.name ?? t('range.profile.title'))

  const moduleCertificates = profile?.certificates.filter((c) => c.kind === 'module') ?? []
  const pathCertificates = profile?.certificates.filter((c) => c.kind === 'path') ?? []
  const gameCertificates = profile?.certificates.filter((c) => c.kind === 'game') ?? []
  const earned = profile?.badges.filter((badge) => badge.earnedAt) ?? []
  const links = profile ? LINK_KEYS.filter((key) => profile.links[key]) : []

  const tabs: { id: Tab; count: number }[] = profile
    ? [
        { id: 'modules', count: profile.completedModules.length },
        { id: 'module-certificates', count: moduleCertificates.length },
        { id: 'paths', count: profile.paths.length },
        { id: 'path-certificates', count: pathCertificates.length },
        { id: 'game-certificates', count: gameCertificates.length },
        { id: 'labs', count: profile.labs.length },
        { id: 'badges', count: earned.length },
      ]
    : []

  const empty = (text: string) => <div className={cx(range.card, range.empty)}>{text}</div>

  return (
    <RangePage isLoading={!profile && !error}>
      <div className={cx(range.container, range.page)}>
        {error ? (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.profile.not_found') : error.message}
          </Note>
        ) : (
          profile && (
            <div style={{ display: 'grid', gap: 24 }}>
              {/* who they are, with their four numbers */}
              <section className={classes.profileHead}>
                <div className={classes.avatarBox}>
                  <PlayerAvatar
                    name={profile.name}
                    avatar={profile.avatar}
                    className={classes.avatar}
                    style={{ fontSize: '3.6rem' }}
                  />
                  {profile.self && (
                    <FileButton onChange={changePicture} accept={PICTURE_TYPES}>
                      {(props) => (
                        <Tooltip label={t('range.profile.change_picture')} withArrow>
                          <button
                            type="button"
                            {...props}
                            className={classes.avatarEdit}
                            disabled={uploading}
                            aria-label={t('range.profile.change_picture')}
                          >
                            <Uicon name="camera" />
                          </button>
                        </Tooltip>
                      )}
                    </FileButton>
                  )}
                </div>
                <div className={classes.who}>
                  <h1 className={classes.name}>{profile.name}</h1>
                  {profile.verified && (
                    <div className={classes.verified}>
                      {t('range.profile.verified_short')}
                      <VerifiedTick size={17} />
                    </div>
                  )}
                  <div className={classes.rankLine}>
                    <RankEmblem rank={profile.rankIndex} size={38} title={profile.rank} />
                    <RankTitle rank={profile.rankIndex} name={profile.rank} className={classes.rankName} />
                    <span className={classes.rankChip}>
                      {t('range.rank.level_short')} {profile.level}
                    </span>
                    {profile.role !== 'student' && (
                      <span className={classes.rankChip} data-role>
                        {t(`range.role.${profile.role}`)}
                      </span>
                    )}
                  </div>
                  {profile.bio && <p className={classes.bio}>{profile.bio}</p>}
                  <div className={classes.facts}>
                    {profile.country && (
                      <span className={classes.inline}>
                        <Uicon name="location-alt" />
                        {countryName(profile.country, i18n.language)}
                      </span>
                    )}
                    <span className={classes.inline}>
                      <Uicon name="calendar" />
                      {t('range.profile.joined', { date: shortDate(profile.memberSince, i18n.language) })}
                    </span>
                    <span className={classes.inline}>
                      <Uicon name="clock" />
                      {t('range.profile.active', { when: ago(profile.lastActive, i18n.language) })}
                    </span>
                  </div>
                  {links.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {links.map((key) => (
                        <Tooltip key={key} label={t(`range.profile.link.${key}`)} withArrow>
                          <a
                            className={classes.social}
                            href={linkUrl[key](profile.links[key]!)}
                            target="_blank"
                            rel="noreferrer nofollow"
                            aria-label={t(`range.profile.link.${key}`)}
                          >
                            <Uicon name={linkIcon[key]} />
                          </a>
                        </Tooltip>
                      ))}
                    </div>
                  ) : (
                    <div className={cx(range.small, range.dim)}>{t('range.profile.no_links')}</div>
                  )}
                  <div className={classes.actions}>
                    <Button
                      component={Link}
                      to="/ranking"
                      size="md"
                      radius="sm"
                      leftSection={<Uicon name="leaderboard-trophy" />}
                    >
                      {t('range.ranking.title')}
                    </Button>
                    {profile.self && (
                      <>
                        <button
                          type="button"
                          className={range.button}
                          data-variant="subtle"
                          onClick={() => setEditing(true)}
                        >
                          <Uicon name="edit" />
                          {t('range.profile.edit')}
                        </button>
                        <Link to="/account/profile" className={range.button} data-variant="plain">
                          {t('range.profile.account')}
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                <div className={classes.tiles}>
                  <div className={classes.statTile}>
                    <span className={classes.statLabel}>
                      <Uicon name="star" />
                      {t('range.profile.score')}
                    </span>
                    <span className={classes.statValue}>
                      {profile.xp.toLocaleString(i18n.language)}
                      <small>XP</small>
                    </span>
                  </div>
                  <div className={classes.statTile}>
                    <span className={classes.statLabel}>
                      <Uicon name="trophy" />
                      {t('range.profile.rank')}
                    </span>
                    <span className={classes.statValue}>
                      {profile.position ? `#${profile.position}` : '-'}
                      <small>{t('range.profile.of', { count: profile.of })}</small>
                    </span>
                  </div>
                  <div className={classes.statTile}>
                    <span className={classes.statLabel}>
                      <Uicon name="diploma" />
                      {t('range.profile.certificates')}
                    </span>
                    <span className={classes.statValue}>{profile.stats.certificates}</span>
                  </div>
                  <div className={classes.statTile}>
                    <span className={classes.statLabel}>
                      <Uicon name="book-open-cover" />
                      {t('range.profile.modules')}
                    </span>
                    <span className={classes.statValue}>{profile.stats.modulesCompleted}</span>
                  </div>
                </div>
              </section>

              {/* level, streak and progress */}
              <section className={classes.trio}>
                <div className={classes.panel}>
                  <h2 className={classes.cardTitle}>{t('range.profile.level')}</h2>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '84px minmax(0, 1fr)',
                      gap: 16,
                      alignItems: 'center',
                    }}
                  >
                    <RankEmblem rank={profile.rankIndex} size={84} title={profile.rank} />
                    <div>
                      <div className={range.levelNumber}>
                        <small>{t('range.rank.level_short')}</small>
                        {profile.level}
                      </div>
                      <div className={range.between} style={{ margin: '8px 0 6px' }}>
                        <span className={range.small} style={{ fontWeight: 600 }}>
                          {t('range.rank.level_xp')}
                        </span>
                        <span className={cx(range.small, range.mono, range.dim)}>
                          {profile.xp - profile.levelStart}/{profile.nextLevel - profile.levelStart}
                        </span>
                      </div>
                      <ProgressBar
                        value={percentOf(profile.xp - profile.levelStart, profile.nextLevel - profile.levelStart)}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className={cx(range.small, range.dim)} style={{ marginTop: 14 }}>
                    {profile.nextRank
                      ? t('range.rank.next', { rank: profile.nextRank.name, xp: profile.nextRank.xp - profile.xp })
                      : t('range.rank.top')}
                  </div>
                </div>

                <div className={classes.panel}>
                  <h2 className={classes.cardTitle}>{t('range.streak.title')}</h2>
                  <div className={classes.big}>
                    <Uicon name="flame-solid" size={34} style={{ color: 'var(--mantine-color-orange-5)' }} />
                    {t('range.streak.weeks', { count: profile.streak.current })}
                  </div>
                  <div className={range.between} style={{ margin: '14px 0 6px' }}>
                    <span className={range.small} style={{ fontWeight: 600 }}>
                      {t('range.streak.this_week')}
                    </span>
                    <span className={cx(range.small, range.mono, range.dim)}>
                      {profile.streak.weekXp}/{profile.streak.goal}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(100, percentOf(profile.streak.weekXp, profile.streak.goal))} size="sm" />
                  <div className={cx(range.small, range.dim)} style={{ marginTop: 14 }}>
                    {t('range.streak.best', { count: profile.streak.best })}
                  </div>
                </div>

                <div className={classes.panel}>
                  <h2 className={classes.cardTitle}>{t('range.profile.progress')}</h2>
                  {profile.categories.map((item) => (
                    <div key={item.category} className={classes.catRow}>
                      <span>{t(`range.category.${item.category}`)}</span>
                      <ProgressBar value={percentOf(item.xp, item.total)} size="sm" category={item.category} />
                      <span className={cx(range.mono, range.dim)} style={{ textAlign: 'right' }}>
                        {percentOf(item.xp, item.total)}%
                      </span>
                    </div>
                  ))}
                  <div className={cx(range.small, range.dim)} style={{ marginTop: 14 }}>
                    {t('range.profile.answered', { questions: profile.stats.questions, flags: profile.stats.flags })}
                  </div>
                </div>
              </section>

              {/* badges earned so far */}
              {earned.length > 0 && (
                <section className={classes.panel}>
                  <div className={range.between} style={{ marginBottom: 14 }}>
                    <h2 className={classes.cardTitle} style={{ margin: 0 }}>
                      {t('range.badge.title')}
                    </h2>
                    <button type="button" className={range.link} onClick={() => setTab('badges')}>
                      {t('range.badge.all', { earned: earned.length, total: profile.badges.length })}
                    </button>
                  </div>
                  <div className={classes.badgeStrip}>
                    {earned.map((badge) => (
                      <Tooltip key={badge.id} label={t(`range.badge.${badge.id}.name`)} withArrow>
                        <span>
                          <BadgeMedal id={badge.id} size={56} />
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </section>
              )}

              {/* everything they finished */}
              <section>
                <div className={cx(range.pills, classes.profileTabs)}>
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={range.pill}
                      data-active={tab === item.id || undefined}
                      onClick={() => setTab(item.id)}
                    >
                      {t(`range.profile.tab.${item.id}`)}
                      <span className={range.count}>{item.count}</span>
                    </button>
                  ))}
                </div>

                {tab === 'modules' &&
                  (profile.completedModules.length > 0 ? (
                    <div className={range.grid}>
                      {profile.completedModules.map((module) => (
                        <ModuleCard key={module.slug} module={module} />
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.modules'))
                  ))}

                {tab === 'module-certificates' &&
                  (moduleCertificates.length > 0 ? (
                    <div className={range.grid}>
                      {moduleCertificates.map((certificate) => (
                        <CertificateCard key={certificate.id} certificate={certificate} />
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.module-certificates'))
                  ))}

                {tab === 'paths' &&
                  (profile.paths.length > 0 ? (
                    <div className={range.pathGrid}>
                      {profile.paths.map((path) => (
                        <PathCard key={path.slug} path={path} />
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.paths'))
                  ))}

                {tab === 'path-certificates' &&
                  (pathCertificates.length > 0 ? (
                    <div className={range.grid}>
                      {pathCertificates.map((certificate) => (
                        <CertificateCard key={certificate.id} certificate={certificate} />
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.path-certificates'))
                  ))}

                {tab === 'game-certificates' &&
                  (gameCertificates.length > 0 ? (
                    <div className={range.grid}>
                      {gameCertificates.map((certificate) => (
                        <CertificateCard key={certificate.id} certificate={certificate} />
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.game-certificates'))
                  ))}

                {tab === 'labs' &&
                  (profile.labs.length > 0 ? (
                    <div className={classes.labGrid}>
                      {profile.labs.map((lab) => (
                        <Link key={lab.slug} to={labUrl(lab.slug)} className={classes.labCard}>
                          <div
                            className={cx(classes.labCover, range.shapes)}
                            data-v={variantOf(lab.slug)}
                            style={{ ...categoryStyle(lab.category), height: 110 }}
                          >
                            <span className={classes.emblem} style={{ width: 64, height: 64, fontSize: '1.6rem' }}>
                              <Uicon name={coverIcon(lab.icon, lab.category)} />
                            </span>
                          </div>
                          <div className={classes.labCardBody}>
                            <Label icon={lab.kind === 'machine' ? 'computer' : 'puzzle-alt'}>
                              {t(`range.category.${lab.category}`)}
                            </Label>
                            <div className={range.cardTitle}>{lab.title}</div>
                          </div>
                          <div className={classes.labCardFoot}>
                            <Xp value={lab.xp} />
                            <span>{shortDate(lab.solvedAt, i18n.language)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    empty(t('range.profile.empty.labs'))
                  ))}

                {tab === 'badges' && (
                  <div className={classes.badgeGrid}>
                    {profile.badges.map((badge) => (
                      <div key={badge.id} className={classes.badge} data-locked={!badge.earnedAt || undefined}>
                        <BadgeMedal id={badge.id} />
                        <div>
                          <div className={classes.badgeName}>{t(`range.badge.${badge.id}.name`)}</div>
                          <div className={classes.badgeNote}>
                            {badge.earnedAt
                              ? t('range.badge.earned', { date: shortDate(badge.earnedAt, i18n.language) })
                              : t(`range.badge.${badge.id}.how`)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {profile.self && (
                <EditProfile
                  profile={profile}
                  opened={editing}
                  onClose={() => setEditing(false)}
                  onSaved={(next) => {
                    mutate(next, { revalidate: false })
                    refresh()
                  }}
                  onPicture={changePicture}
                  uploading={uploading}
                />
              )}
            </div>
          )
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default ProfilePage
