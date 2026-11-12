import { Button, CopyButton } from '@mantine/core'
import cx from 'clsx'
import { FC, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { CertificateSheet } from '@Components/range/CertificateSheet'
import { Note } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { certificateIcon, certificateNumber, gameFacts, profileUrl, useCertificate } from '@Utils/Community'
import { formatMinutes, useMe } from '@Utils/Range'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

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

  const facts = !certificate
    ? ''
    : certificate.game
      ? gameFacts(certificate.game, t, i18n.language)
      : [
          certificate.difficulty && t(`range.difficulty.${certificate.difficulty}`),
          certificate.category && t(`range.category.${certificate.category}`),
          certificate.modules && t('range.count.modules', { count: certificate.modules.length }),
          certificate.minutes && formatMinutes(certificate.minutes),
        ]
          .filter(Boolean)
          .join(' · ')

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
                  {certificate.profile && (
                    <Link to={profileUrl(certificate.userName)} className={range.button} data-variant="plain">
                      {t('range.certificate.profile', { name: certificate.userName })}
                    </Link>
                  )}
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

              <CertificateSheet
                kind={certificate.kind}
                name={certificate.name}
                title={certificate.title}
                summary={certificate.summary}
                facts={facts}
                issuedAt={certificate.issuedAt}
                number={certificateNumber(certificate.id)}
                address={`${origin}/certificates/${certificate.id}`}
                signatories={certificate.signatories}
                icon={certificateIcon(certificate)}
              />

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
