import { Tooltip } from '@mantine/core'
import cx from 'clsx'
import { CSSProperties, FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Uicon } from '@Components/Uicon'
import { Label, variantOf, Xp } from '@Components/range/Parts'
import { BadgeArt } from '@Utils/Artwork'
import { LabKindIcon, labUrl, LabSummary, profileUrl, SystemIcon } from '@Utils/Community'
import { categoryStyle, coverIcon, DifficultyIcon } from '@Utils/Range'
import { UICON_SIZE, UiconName, uicons } from '@Utils/Uicons'
import classes from '@Styles/Community.module.css'
import range from '@Styles/Range.module.css'

// A lab in the catalogue: its emblem, what it is worth, how hard it is and who solved it.
export const LabCard: FC<{ lab: LabSummary }> = ({ lab }) => {
  const { t } = useTranslation()

  return (
    <Link to={labUrl(lab.slug)} className={classes.labCard}>
      <div
        className={cx(classes.labCover, range.shapes)}
        data-v={variantOf(lab.slug)}
        style={categoryStyle(lab.category)}
      >
        <span className={classes.emblem}>
          <Uicon name={coverIcon(lab.icon, lab.category)} />
        </span>
        {lab.status === 'started' && <span className={range.badge}>{t('range.status.started')}</span>}
      </div>
      <div className={classes.labCardBody}>
        <Label icon={LabKindIcon[lab.kind]}>{t(`range.lab.kind.${lab.kind}`)}</Label>
        <h3 className={range.cardTitle}>{lab.title}</h3>
        <div className={cx(classes.inline, range.dim)}>
          <Xp value={lab.xp} />
          <span>·</span>
          {lab.os ? (
            <span className={classes.inline}>
              <Uicon name={SystemIcon[lab.os]} />
              {t(`range.lab.os.${lab.os}`)}
            </span>
          ) : (
            t(`range.category.${lab.category}`)
          )}
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

// A medal: an icon on a hexagon in two flat tones, for a badge the club has no artwork for yet.
export const Medal: FC<{ icon: UiconName; colours: [string, string]; size?: number; title?: string }> = ({
  icon,
  colours,
  size = 64,
  title,
}) => {
  const glyph = 40

  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} style={{ flexShrink: 0 }}>
      <path d={HEXAGON} fill={colours[0]} />
      <path d={HEXAGON} fill={colours[1]} transform="translate(7.2 7.2) scale(0.85)" />
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

// the two flat tones of the gold, silver and bronze medals
const METALS: Record<number, [string, string]> = {
  1: ['#f5c542', '#d99a1e'],
  2: ['#d5dce6', '#a3afc0'],
  3: ['#e2a26e', '#b9692f'],
}

// The medal of one of the top three: a disc with their place, hanging from a ribbon.
export const PlaceMedal: FC<{ place: number; size?: number }> = ({ place, size = 48 }) => {
  const [face, rim] = METALS[place] ?? METALS[3]

  return (
    <svg
      viewBox="0 0 64 84"
      width={size}
      height={(size * 84) / 64}
      role="img"
      aria-label={`#${place}`}
      style={{ flexShrink: 0 }}
    >
      <path d="M12 0h15l11 30H23z" fill="#3b82f6" />
      <path d="M52 0H37L26 30h15z" fill="#0864af" />
      <circle cx="32" cy="56" r="26" fill={rim} />
      <circle cx="32" cy="56" r="20" fill={face} />
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
        background: '#0864af',
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
