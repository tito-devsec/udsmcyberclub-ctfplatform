import { Tooltip } from '@mantine/core'
import cx from 'clsx'
import { CSSProperties, FC, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Label, Xp } from '@Components/range/Parts'
import { BadgeArt } from '@Utils/Artwork'
import { labUrl, LabSummary, profileUrl } from '@Utils/Community'
import { Category, coverIcon, DifficultyIcon } from '@Utils/Range'
import { UICON_SIZE, UiconName, uicons } from '@Utils/Uicons'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

// the tint of a lab's picture, by category
export const categoryTone: Record<Category, number> = {
  general: 0,
  web: 0,
  crypto: 3,
  forensics: 2,
  osint: 5,
  reverse: 1,
  pwn: 4,
  stego: 2,
  misc: 1,
  hardware: 3,
  ics: 4,
  ai: 5,
  web3: 1,
}

// A lab in the catalogue: its emblem, what it is worth, how hard it is and who solved it.
export const LabCard: FC<{ lab: LabSummary }> = ({ lab }) => {
  const { t } = useTranslation()

  return (
    <Link to={labUrl(lab.slug)} className={classes.labCard}>
      <div className={classes.labCover} data-tone={categoryTone[lab.category]}>
        <span className={classes.emblem}>
          <Uicon name={coverIcon(lab.icon, lab.category)} />
        </span>
        {lab.status === 'started' && <span className={range.badge}>{t('range.status.started')}</span>}
      </div>
      <div className={classes.labCardBody}>
        <Label icon={lab.kind === 'machine' ? 'computer' : 'puzzle-alt'}>{t(`range.lab.kind.${lab.kind}`)}</Label>
        <h3 className={range.cardTitle}>{lab.title}</h3>
        <div className={cx(classes.inline, range.dim)}>
          <Xp value={lab.xp} />
          <span>·</span>
          {t(`range.category.${lab.category}`)}
        </div>
      </div>
      <div className={classes.labCardFoot}>
        <span className={classes.inline}>
          <Uicon name={DifficultyIcon[lab.difficulty]} />
          {t(`range.difficulty.${lab.difficulty}`)}
        </span>
        {lab.status === 'completed' ? (
          <span className={range.done}>
            <Uicon name="check-circle-solid" />
            {t('range.lab.solved')}
          </span>
        ) : (
          <Tooltip label={t('range.lab.solvers', { count: lab.solvers })} withArrow>
            <span className={classes.inline}>
              <Uicon name="users-alt" />
              {lab.solvers}
            </span>
          </Tooltip>
        )}
      </div>
    </Link>
  )
}

const HEXAGON = 'M48 3 87 25.5v45L48 93 9 70.5v-45z'

// A medal: an icon on a hexagon in two colours, for a badge the club has no artwork for yet.
export const Medal: FC<{ icon: UiconName; colours: [string, string]; size?: number; title?: string }> = ({
  icon,
  colours,
  size = 64,
  title,
}) => {
  const id = useId()
  const glyph = 40

  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colours[0]} />
          <stop offset="1" stopColor={colours[1]} />
        </linearGradient>
      </defs>
      <path d={HEXAGON} fill={`url(#${id})`} />
      <path
        d={HEXAGON}
        fill="none"
        stroke="rgba(255, 255, 255, 0.35)"
        strokeWidth="2"
        transform="translate(7.2 7.2) scale(0.85)"
      />
      <g transform={`translate(${48 - glyph / 2} ${48 - glyph / 2}) scale(${glyph / UICON_SIZE})`} fill="#fff">
        <path d={uicons[icon]} />
      </g>
    </svg>
  )
}

// A badge's medal, by the badge's name: the club's artwork for it.
export const BadgeMedal: FC<{ id: string; size?: number }> = ({ id, size = 64 }) => {
  const { t } = useTranslation()
  const name = t(`range.badge.${id}.name`)
  const art = BadgeArt[id]
  return art ? (
    <img src={art} width={size} height={size} alt={name} style={{ display: 'block', flexShrink: 0 }} />
  ) : (
    <Medal icon="star" colours={['#8b9ab3', '#4a576d']} size={size} title={name} />
  )
}

// the two colours of the gold, silver and bronze medals
const METALS: Record<number, [string, string]> = {
  1: ['#ffe08a', '#e3a622'],
  2: ['#f1f4f8', '#9ba7b9'],
  3: ['#f3c29a', '#b9692f'],
}

// The medal of one of the top three: a disc with their place, hanging from a ribbon.
export const PlaceMedal: FC<{ place: number; size?: number }> = ({ place, size = 48 }) => {
  const id = useId()
  const [from, to] = METALS[place] ?? METALS[3]

  return (
    <svg
      viewBox="0 0 64 84"
      width={size}
      height={(size * 84) / 64}
      role="img"
      aria-label={`#${place}`}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M12 0h15l11 30H23z" fill="#2b7cd2" />
      <path d="M52 0H37L26 30h15z" fill="#0864af" />
      <circle cx="32" cy="56" r="26" fill={`url(#${id})`} />
      <circle cx="32" cy="56" r="20" fill="none" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" />
      <text x="32" y="65" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1c2434">
        {place}
      </text>
    </svg>
  )
}

interface PlayerAvatarProps {
  name: string
  avatar: string | null
  className?: string
  style?: CSSProperties
}

// Someone's picture, or their initial on the club's blue when they have none.
export const PlayerAvatar: FC<PlayerAvatarProps> = ({ name, avatar, className, style }) =>
  avatar ? (
    <img src={avatar} alt="" className={className} style={{ objectFit: 'cover', ...style }} />
  ) : (
    <span
      className={className}
      aria-hidden
      style={{
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: '1.1em',
        color: '#fff',
        background: 'linear-gradient(135deg, #2b7cd2, #0864af)',
        ...style,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )

// The tick of a verified member.
export const VerifiedTick: FC<{ size?: number | string }> = ({ size }) => {
  const { t } = useTranslation()
  return (
    <Tooltip label={t('range.profile.verified')} withArrow>
      <span style={{ display: 'inline-flex', color: 'var(--r-accent)' }}>
        <Uicon name="badge-check-solid" size={size} />
      </span>
    </Tooltip>
  )
}

// A name that opens the person's profile.
export const PlayerLink: FC<{ name: string; className?: string }> = ({ name, className }) => (
  <Link to={profileUrl(name)} className={className}>
    {name}
  </Link>
)
