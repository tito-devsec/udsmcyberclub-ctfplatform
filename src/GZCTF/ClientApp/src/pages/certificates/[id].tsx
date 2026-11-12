import { Button, CopyButton } from '@mantine/core'
import cx from 'clsx'
import { FC, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { MainIcon } from '@Components/icon/MainIcon'
import { Note } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { certificateNumber, profileUrl, useCertificate } from '@Utils/Community'
import { formatMinutes, useMe } from '@Utils/Range'
import { useConfig } from '@Hooks/useConfig'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'
import udsmLogo from '../../assets/udsm-logo.webp'

// The club's own logo, as set on the platform.
const ClubLogo: FC = () => {
  const { config } = useConfig()
  return config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />
}

const PETALS = Array.from({ length: 28 }, (_, index) => (index * 2 * Math.PI) / 28)

// The rosette between the two halves of the sheet, with its ribbon.
const Seal: FC = () => {
  const ring = useId()
  return (
    <svg viewBox="0 0 200 270" aria-hidden>
      <path d="M62 150 46 262l30-20 24 26V150z" fill="#083a6b" />
      <path d="M138 150l16 112-30-20-24 26V150z" fill="#0a4f8f" />
      {PETALS.map((angle) => (
        <circle key={angle} cx={100 + 88 * Math.cos(angle)} cy={100 + 88 * Math.sin(angle)} r="11" fill="#2b8ae0" />
      ))}
      <circle cx="100" cy="100" r="90" fill="#2b8ae0" />
      <circle cx="100" cy="100" r="78" fill="#0b2a4a" />
      <circle cx="100" cy="100" r="45" fill="#fff" />
      <defs>
        <path id={ring} d="M100 100m-60 0a60 60 0 1 1 120 0a60 60 0 1 1-120 0" />
      </defs>
      <text fill="#fff" fontSize="12.5" fontWeight="700">
        <textPath href={`#${ring}`} textLength="370" lengthAdjust="spacing">
          UDSM CYBER CLUB • CERTIFICATE OF COMPLETION •
        </textPath>
      </text>
    </svg>
  )
}

// A certificate, on a sheet that can be printed or saved as a PDF. Anyone with its
// address can open it, which is how it is checked.
const CertificatePage: FC = () => {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const { data, error } = useCertificate(id)
  const { data: me } = useMe()

  const certificate = data?.id === id ? data : undefined

  usePageTitle(
    certificate ? t('range.certificate.page_title', { title: certificate.title }) : t('range.certificate.title')
  )

  const address = typeof window === 'undefined' ? '' : window.location.href
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  // while this page is open, printing prints the sheet alone
  useEffect(() => {
    document.documentElement.dataset.print = 'certificate'
    return () => {
      delete document.documentElement.dataset.print
    }
  }, [])

  const facts = certificate
    ? [
        certificate.difficulty && t(`range.difficulty.${certificate.difficulty}`),
        certificate.category && t(`range.category.${certificate.category}`),
        certificate.modules && t('range.count.modules', { count: certificate.modules.length }),
        certificate.minutes && formatMinutes(certificate.minutes),
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <RangePage isLoading={!certificate && !error}>
      <div className={cx(range.container, range.page)}>
        {error ? (
          <Note tone="warn" icon="triangle-warning">
            {error.status === 404 ? t('range.certificate.not_found') : error.message}
          </Note>
        ) : (
          certificate && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div className={cx(range.between, classes.noPrint)} style={{ flexWrap: 'wrap' }}>
                <div>
                  <h1 className={range.sectionTitle}>{t('range.certificate.title')}</h1>
                  <p className={range.lead} style={{ marginTop: 4 }}>
                    {t('range.certificate.verified', { name: certificate.name })}
                  </p>
                </div>
                <div className={range.footActions}>
                  <Link to={profileUrl(certificate.userName)} className={range.button} data-variant="plain">
                    {t('range.certificate.profile', { name: certificate.userName })}
                  </Link>
                  <CopyButton value={address}>
                    {({ copied, copy }) => (
                      <button type="button" className={range.button} data-variant="subtle" onClick={copy}>
                        <Uicon name={copied ? 'check' : 'link'} />
                        {copied ? t('range.machine.copied') : t('range.certificate.copy')}
                      </button>
                    )}
                  </CopyButton>
                  <Button size="md" radius="sm" leftSection={<Uicon name="print" />} onClick={() => window.print()}>
                    {t('range.certificate.print')}
                  </Button>
                </div>
              </div>

              {/* for its owner, while it still carries their user name */}
              {me?.name === certificate.userName && certificate.name === certificate.userName && (
                <div className={classes.noPrint}>
                  <Note icon="info">
                    {t('range.certificate.name_hint')}{' '}
                    <Link to="/account/profile" className={range.link}>
                      {t('range.profile.account')}
                    </Link>
                  </Note>
                </div>
              )}

              <div className={classes.certificate}>
                <div className={classes.certPaper}>
                  <div className={classes.certTop}>
                    <span>
                      {t('range.certificate.date')}:{' '}
                      {new Date(certificate.issuedAt).toLocaleDateString(i18n.language, { dateStyle: 'long' })}
                    </span>
                    <span>
                      {t('range.certificate.id')}: <strong>{certificateNumber(certificate.id)}</strong>
                    </span>
                  </div>

                  <h2 className={classes.certHeading}>{t('range.certificate.heading')}</h2>
                  <div className={classes.certSmall}>{t('range.certificate.given_to')}</div>
                  <div className={classes.certName}>{certificate.name}</div>
                  <div className={classes.certSmall}>{t(`range.certificate.for.${certificate.kind}`)}</div>
                  <div className={classes.certTitle}>{certificate.title}</div>
                  <div className={classes.certSmall}>
                    {t('range.certificate.offered_by')} <strong>UDSM Cyber Club</strong>
                  </div>
                  <p className={classes.certAbout}>
                    {certificate.summary}
                    {certificate.summary && facts && <br />}
                    {facts}
                  </p>

                  <div className={classes.certSigns}>
                    {certificate.signatories.map((signatory) => (
                      <div key={signatory.slot}>
                        <div className={classes.certSignature}>
                          {signatory.signature && <img src={signatory.signature} alt="" />}
                        </div>
                        {signatory.name && <div className={classes.certSignName}>{signatory.name}</div>}
                        <div className={classes.certSignTitle}>{signatory.title}</div>
                      </div>
                    ))}
                  </div>
                  <div className={classes.certVerify}>
                    {t('range.certificate.verify_at', { address: `${origin}/certificates/${certificate.id}` })}
                  </div>
                </div>

                <div className={classes.certSide}>
                  <div className={classes.certUdsm}>
                    <span>
                      <img src={udsmLogo} alt="" />
                    </span>
                    {t('range.certificate.university')}
                  </div>

                  <div className={classes.certSeal}>
                    <Seal />
                    <div className={classes.certSealLogo}>
                      <ClubLogo />
                    </div>
                  </div>

                  <div className={classes.certClub}>
                    <ClubLogo />
                    <div>
                      UDSM Cyber<b>Range</b>
                    </div>
                    <small>
                      {t('range.powered_by')} <strong>UDSMCYBER</strong>
                    </small>
                  </div>
                </div>
              </div>

              {certificate.modules && (
                <div className={cx(classes.panel, classes.noPrint)}>
                  <h2 className={classes.panelTitle}>{t('range.certificate.covers')}</h2>
                  <div className={range.filters}>
                    {certificate.modules.map((module) => (
                      <span key={module} className={range.chip} style={{ cursor: 'default' }}>
                        {module}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </RangePage>
  )
}

export default CertificatePage
