import { Button, CopyButton } from '@mantine/core'
import cx from 'clsx'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { LogoBox } from '@Components/LogoBox'
import { Uicon } from '@Components/Uicon'
import { Note } from '@Components/range/Parts'
import { RangePage } from '@Components/range/RangePage'
import { certificateNumber, profileUrl, useCertificate } from '@Utils/Community'
import { formatMinutes } from '@Utils/Range'
import { usePageTitle } from '@Hooks/usePageTitle'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

// A certificate, on a sheet that can be printed or saved as a PDF. Anyone with its
// address can open it, which is how it is checked.
const CertificatePage: FC = () => {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const { data, error } = useCertificate(id)

  const certificate = data?.id === id ? data : undefined

  usePageTitle(
    certificate ? t('range.certificate.page_title', { title: certificate.title }) : t('range.certificate.title')
  )

  const address = typeof window === 'undefined' ? '' : window.location.href

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

              <div className={classes.certificate}>
                <div className={classes.certificateInner}>
                  <div className={classes.certBrand}>
                    <LogoBox size="44px" />
                    <div>
                      UDSM Cyber<span>Range</span>
                    </div>
                  </div>

                  <div className={classes.certMain}>
                    <h2 className={classes.certHeading}>{t('range.certificate.heading')}</h2>
                    <div className={classes.certSmall}>{t('range.certificate.given_to')}</div>
                    <div className={classes.certName}>{certificate.name}</div>
                    <div className={classes.certSmall}>{t(`range.certificate.for.${certificate.kind}`)}</div>
                    <div className={classes.certTitle}>{certificate.title}</div>
                    <div className={classes.certSmall}>
                      {[
                        certificate.difficulty && t(`range.difficulty.${certificate.difficulty}`),
                        certificate.category && t(`range.category.${certificate.category}`),
                        certificate.modules && t('range.count.modules', { count: certificate.modules.length }),
                        certificate.minutes && formatMinutes(certificate.minutes),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <div className={classes.certFoot}>
                    <div>
                      <strong>
                        {new Date(certificate.issuedAt).toLocaleDateString(i18n.language, { dateStyle: 'long' })}
                      </strong>
                      {t('range.certificate.date')}
                    </div>
                    <span className={classes.certSeal}>
                      <Uicon name="award" />
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                        {certificateNumber(certificate.id)}
                      </strong>
                      <span className={classes.certPowered}>
                        {t('range.powered_by')} <strong>UDSMCYBER</strong>
                      </span>
                    </div>
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
