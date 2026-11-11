import cx from 'clsx'
import { FC, PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { WithNavBar } from '@Components/WithNavbar'
import { SkillLevelPrompt } from '@Components/range/SkillLevel'
import classes from '@Styles/Range.module.css'

const TABS = [
  { label: 'range.nav.paths', link: '/paths' },
  { label: 'range.nav.modules', link: '/modules' },
]

// The bar across the top of the CyberRange pages: its name, and the way around it.
const RangeHeader: FC = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <header className={classes.header}>
      <Link to="/paths" className={classes.wordmark}>
        UDSM Cyber<span>Range</span>
      </Link>
      <nav className={classes.nav}>
        {TABS.map((tab) => (
          <Link
            key={tab.link}
            to={tab.link}
            className={classes.pill}
            data-active={pathname === tab.link || pathname.startsWith(`${tab.link}/`) || undefined}
          >
            {t(tab.label)}
          </Link>
        ))}
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
