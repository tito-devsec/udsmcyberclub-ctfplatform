import { FC, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { MainIcon } from '@Components/icon/MainIcon'
import { CategoryLogo } from '@Utils/Artwork'
import { Signatory } from '@Utils/Community'
import { Category } from '@Utils/Range'
import { UiconName } from '@Utils/Uicons'
import { useConfig } from '@Hooks/useConfig'
import classes from '@Styles/Community.module.css'
import udsmLogo from '../../assets/udsm-logo.webp'

export type CertificateKind = 'module' | 'path' | 'game'

export interface CertificateSheetProps {
  kind: CertificateKind
  // the name printed on it
  name: string
  // the module, skill path or game it is for
  title: string
  // a line about what that was, and its facts (difficulty, time, dates, team)
  summary: string | null
  facts: string
  issuedAt: string
  // its number as printed, or a word such as "Preview"
  number: string
  // where anyone can check it
  address: string
  signatories: Signatory[]
  // in the middle of the seal: the logo of its category, or its own symbol when the category
  // has no logo (a game, a general module, a skill path of many categories)
  category?: Category | null
  icon: UiconName
}

// The club's own logo, as set on the platform.
const ClubLogo: FC = () => {
  const { config } = useConfig()
  return config.logoUrl ? <img src={config.logoUrl} alt="" /> : <MainIcon ignoreTheme />
}

const PETALS = Array.from({ length: 28 }, (_, index) => (index * 2 * Math.PI) / 28)

// The rosette between the two halves of the sheet, with its ribbon.
const Seal: FC<{ ring: string }> = ({ ring: words }) => {
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
      <circle cx="100" cy="100" r="50" fill="#fff" />
      <defs>
        <path id={ring} d="M100 100m-60 0a60 60 0 1 1 120 0a60 60 0 1 1-120 0" />
      </defs>
      <text fill="#fff" fontSize="12.5" fontWeight="700">
        <textPath href={`#${ring}`} textLength="370" lengthAdjust="spacingAndGlyphs">
          {words}
        </textPath>
      </text>
    </svg>
  )
}

// A certificate on its A4 sheet: the same on screen, on paper, in a PDF and in a preview.
export const CertificateSheet: FC<CertificateSheetProps> = (props) => {
  const { kind, name, title, summary, facts, issuedAt, number, address, signatories, category, icon } = props
  const { t, i18n } = useTranslation()
  const game = kind === 'game'
  const logo = category && !game ? CategoryLogo[category] : undefined

  return (
    <div className={classes.certificate}>
      <div className={classes.certPaper}>
        <div className={classes.certTop}>
          <span>
            {t('range.certificate.date')}: {new Date(issuedAt).toLocaleDateString(i18n.language, { dateStyle: 'long' })}
          </span>
          <span>
            {t('range.certificate.id')}: <strong>{number}</strong>
          </span>
        </div>

        <h2 className={classes.certHeading}>
          {t(game ? 'range.certificate.heading_game' : 'range.certificate.heading')}
        </h2>
        <div className={classes.certSmall}>{t('range.certificate.given_to')}</div>
        <div className={classes.certName}>{name}</div>
        <div className={classes.certSmall}>{t(`range.certificate.for.${kind}`)}</div>
        <div className={classes.certTitle}>{title}</div>
        <div className={classes.certSmall}>
          {t(game ? 'range.certificate.organised_by' : 'range.certificate.offered_by')} <strong>UDSM Cyber Club</strong>
        </div>
        <p className={classes.certAbout}>
          {summary}
          {summary && facts && <br />}
          {facts}
        </p>

        <div className={classes.certSigns}>
          {signatories.map((signatory) => (
            <div key={signatory.slot}>
              <div className={classes.certSignature}>
                {signatory.signature && <img src={signatory.signature} alt="" />}
              </div>
              {signatory.name && <div className={classes.certSignName}>{signatory.name}</div>}
              <div className={classes.certSignTitle}>{signatory.title}</div>
            </div>
          ))}
        </div>
        <div className={classes.certVerify}>{t('range.certificate.verify_at', { address })}</div>
      </div>

      <div className={classes.certSide}>
        <div className={classes.certUdsm}>
          <span>
            <img src={udsmLogo} alt="" />
          </span>
          {t('range.certificate.university')}
        </div>

        <div className={classes.certSeal}>
          <Seal ring={t(game ? 'range.certificate.seal_game' : 'range.certificate.seal')} />
          <div className={classes.certSealLogo}>
            {logo ? <img src={logo} alt={t(`range.category.${category}`)} /> : <Uicon name={icon} />}
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
  )
}
