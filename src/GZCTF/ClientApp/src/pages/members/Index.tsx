import { Switch, TextInput, Tooltip } from '@mantine/core'
import cx from 'clsx'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { PlayerAvatar, VerifiedTick } from '@Components/range/Community'
import { Note, PoweredBy, Xp } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { RankTitle } from '@Components/range/RankCard'
import { ago, Member, membersApi, profileUrl, useMembers } from '@Utils/Community'
import { useMe } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

const inputStyles = {
  input: {
    height: 44,
    border: 0,
    fontWeight: 600,
    color: 'var(--r-text)',
    background: 'var(--r-raised)',
  },
}

// Everyone who has opened CyberRange, for the superadmin: who tutors, and who is verified.
const MembersPage: FC = () => {
  const { t, i18n } = useTranslation()
  const { data: me, error: meError, known, signedIn } = useMe()
  const allowed = me?.role === 'superadmin'
  const { data: members, error, mutate } = useMembers(allowed)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  usePageTitle(t('range.members.title'))

  const change = async (member: Member, work: () => Promise<unknown>, next: Partial<Member>) => {
    setBusy(member.id)
    try {
      await work()
      await mutate((list) => list?.map((item) => (item.id === member.id ? { ...item, ...next } : item)), {
        revalidate: false,
      })
    } catch (failure) {
      showErrorMsg(failure, t)
    } finally {
      setBusy(null)
    }
  }

  const wanted = search.trim().toLowerCase()
  const shown = members?.filter((member) => member.name.toLowerCase().includes(wanted)) ?? []
  // whether the visitor may be here is known once the platform and the service have answered
  const refused = known && (!signedIn || Boolean(meError) || (me && !allowed))

  return (
    <RangePage isLoading={!refused && !members && !error}>
      <div className={cx(range.container, range.page)}>
        <div className={range.sectionHead} style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className={range.headingIcon}>
              <Uicon name="users-alt" />
            </span>
            <div>
              <h1 className={range.pageTitle} style={{ fontSize: '2.4rem' }}>
                {t('range.members.title')}
              </h1>
              <p className={range.lead} style={{ marginTop: 4, maxWidth: 780 }}>
                {t('range.members.lead')}
              </p>
            </div>
          </div>
        </div>

        {refused && (
          <Note tone="warn" icon="triangle-warning">
            {t('range.members.refused')}
          </Note>
        )}
        {error && (
          <Note tone="warn" icon="triangle-warning">
            {error.message}
          </Note>
        )}

        {members && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div className={classes.tools}>
              <TextInput
                w={300}
                placeholder={t('range.ranking.search')}
                aria-label={t('range.ranking.search')}
                leftSection={<Uicon name="search" />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                styles={inputStyles}
              />
              <span className={range.dim}>
                {t('range.members.summary', {
                  members: members.length,
                  tutors: members.filter((member) => member.role === 'tutor').length,
                  verified: members.filter((member) => member.verified || member.admin).length,
                })}
              </span>
            </div>

            {shown.length > 0 ? (
              <div className={classes.tableWrap}>
                <table className={classes.table}>
                  <thead>
                    <tr>
                      <th>{t('range.members.column.member')}</th>
                      <th>{t('range.members.column.role')}</th>
                      <th>{t('range.members.column.level')}</th>
                      <th>{t('range.ranking.column.score')}</th>
                      <th>{t('range.ranking.column.active')}</th>
                      <th>{t('range.role.tutor')}</th>
                      <th>{t('range.profile.verified_short')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <Link to={profileUrl(member.name)} className={classes.player}>
                            <PlayerAvatar name={member.name} avatar={member.avatar} className={classes.playerAvatar} />
                            <span className={classes.playerName}>
                              {member.name}
                              {(member.verified || member.admin) && <VerifiedTick size={15} />}
                            </span>
                            <RankTitle rank={member.rankIndex} name={member.rank} className={classes.playerRank} />
                          </Link>
                        </td>
                        <td>
                          <span className={classes.rankChip} data-role={member.role !== 'student' || undefined}>
                            {t(`range.role.${member.role}`)}
                          </span>
                        </td>
                        <td>{member.skillLevel ? t(`range.level.${member.skillLevel}`) : '-'}</td>
                        <td>
                          <span className={classes.score}>
                            <Xp value={member.xp} />
                          </span>
                        </td>
                        <td>{ago(member.lastActiveAt, i18n.language)}</td>
                        <td>
                          <Tooltip label={t('range.members.admin_role')} disabled={!member.admin} withArrow>
                            <span style={{ display: 'inline-flex' }}>
                              <Switch
                                aria-label={t('range.members.make_tutor', { name: member.name })}
                                checked={member.role === 'tutor'}
                                disabled={member.admin || busy === member.id}
                                onChange={(event) => {
                                  const role = event.currentTarget.checked ? 'tutor' : 'student'
                                  change(member, () => membersApi.setRole(member.id, role), { role })
                                }}
                              />
                            </span>
                          </Tooltip>
                        </td>
                        <td>
                          <Tooltip label={t('range.members.admin_verified')} disabled={!member.admin} withArrow>
                            <span style={{ display: 'inline-flex' }}>
                              <Switch
                                aria-label={t('range.members.verify', { name: member.name })}
                                checked={member.verified || member.admin}
                                disabled={member.admin || busy === member.id}
                                onChange={(event) => {
                                  const verified = event.currentTarget.checked
                                  change(member, () => membersApi.setVerified(member.id, verified), { verified })
                                }}
                              />
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={cx(range.card, range.empty)}>{t('range.ranking.empty.search')}</div>
            )}
          </div>
        )}

        <PoweredBy />
      </div>
    </RangePage>
  )
}

export default MembersPage
