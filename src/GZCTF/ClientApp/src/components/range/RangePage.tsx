import cx from 'clsx'
import { FC, PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { WithNavBar } from '@Components/WithNavbar'
import { PlayerAvatar } from '@Components/range/Community'
import { SkillLevelPrompt } from '@Components/range/SkillLevel'
import { ATTACK_BOX_TAB, ATTACK_BOX_URL } from '@Utils/AttackBox'
import { profileUrl } from '@Utils/Community'
import { useMe } from '@Utils/Range'
import { useProposals } from '@Utils/Studio'
import { useUser } from '@Hooks/useUser'
import classes from '@Styles/Range.module.css'

// The places in CyberRange, and the addresses that belong to each.
const TABS = [
  { label: 'range.nav.paths', link: '/', under: ['/paths'] },
  { label: 'range.nav.modules', link: '/modules', under: ['/modules'] },
  { label: 'range.nav.labs', link: '/labs', under: ['/labs'] },
  { label: 'range.ranking.title', link: '/ranking', under: ['/ranking'] },
]

// The bar across the top of the CyberRange pages: its name, the way around it, and the
// student's own profile.
const RangeHeader: FC = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { data: me } = useMe()
  const { user } = useUser()
  // for the superadmin: how many proposed games are waiting for a review
  const { data: proposals } = useProposals(me?.role === 'superadmin')
  const waiting = proposals?.filter((proposal) => proposal.status === 'submitted').length ?? 0

  return (
    <header className={classes.header}>
      <Link to="/" className={classes.wordmark}>
        UDSM Cyber<span>Range</span>
      </Link>
      <nav className={classes.nav}>
        {TABS.map((tab) => (
          <Link
            key={tab.link}
            to={tab.link}
            className={classes.pill}
            data-active={pathname === tab.link || tab.under.some((prefix) => pathname.startsWith(prefix)) || undefined}
          >
            {t(tab.label)}
          </Link>
        ))}
        {me && (
          <a href={ATTACK_BOX_URL} target={ATTACK_BOX_TAB} className={classes.pill}>
            {t('range.nav.attack_box')}
          </a>
        )}
        {me && me.role !== 'student' && (
          <Link to="/studio" className={classes.pill} data-active={pathname.startsWith('/studio') || undefined}>
            {t('range.nav.studio')}
            {waiting > 0 && <span className={classes.count}>{waiting}</span>}
          </Link>
        )}
        {me?.role === 'superadmin' && (
          <Link to="/members" className={classes.pill} data-active={pathname.startsWith('/members') || undefined}>
            {t('range.nav.members')}
          </Link>
        )}
        {me && (
          <Link
            to={profileUrl(me.name)}
            className={classes.pill}
            data-active={pathname.startsWith('/profile') || undefined}
            style={{ paddingLeft: 8 }}
          >
            <PlayerAvatar
              name={me.name}
              avatar={user?.avatar ?? null}
              style={{ width: 28, height: 28, borderRadius: '50%', fontSize: '0.8rem' }}
            />
            {me.name}
          </Link>
        )}
      </nav>
    </header>
  )
}

interface RangePageProps extends PropsWithChildren {
  isLoading?: boolean
  // without the top bar and the footer: the section reader has a bar of its own
  bare?: boolean
}

// The frame of every CyberRange page.
export const RangePage: FC<RangePageProps> = ({ children, isLoading, bare }) => (
  <WithNavBar width="100%" minWidth={0} withFooter={!bare} isLoading={isLoading}>
    <div className={cx(classes.theme, classes.surface)} data-bare={bare || undefined}>
      {!bare && <RangeHeader />}
      {children}
      <SkillLevelPrompt />
    </div>
  </WithNavBar>
)
