import { Menu, Skeleton } from '@mantine/core'
import { FC, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Uicon } from '@Components/Uicon'
import { StripedProgress, Xp } from '@Components/range/Parts'
import { rangeApi, RankIcons, SKILL_LEVELS, SkillLevel, SkillLevelIcon, useMe } from '@Utils/Range'
import { showErrorMsg } from '@Utils/Shared'
import { uicons, UICON_SIZE } from '@Utils/Uicons'
import classes from '@Styles/Range.module.css'

// the two colours of each rank's emblem, from Script Kiddie to Omniscient
const RANK_COLOURS: [string, string][] = [
  ['#8b9ab3', '#4a576d'],
  ['#5fb0f5', '#0864af'],
  ['#45dccf', '#0c8a99'],
  ['#b497ff', '#5a3fd0'],
  ['#ffcc66', '#d7811a'],
  ['#ff9166', '#d02f6b'],
]

const HEXAGON = 'M48 3 87 25.5v45L48 93 9 70.5v-45z'
const INNER_HEXAGON = 'M48 12 79 30v36L48 84 17 66V30z'

// A rank's emblem: its icon on a hexagon in the rank's colours.
export const RankEmblem: FC<{ rank: number; size?: number; title?: string }> = ({ rank, size = 92, title }) => {
  const id = useId()
  const index = Math.min(Math.max(rank, 0), RANK_COLOURS.length - 1)
  const [from, to] = RANK_COLOURS[index]
  const glyph = 34

  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label={title} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={HEXAGON} fill={`url(#${id})`} />
      <path d={INNER_HEXAGON} fill="rgba(7, 13, 24, 0.55)" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1" />
      <g transform={`translate(${48 - glyph / 2} ${48 - glyph / 2}) scale(${glyph / UICON_SIZE})`} fill="#fff">
        <path d={uicons[RankIcons[index]]} />
      </g>
    </svg>
  )
}

// The student's level, XP, rank and week, next to the list of paths.
export const RankCard: FC = () => {
  const { t } = useTranslation()
  const { data: me, mutate } = useMe()

  if (!me) return <Skeleton height={330} radius={10} />

  const inLevel = me.xp - me.levelStart
  const levelSize = me.nextLevel - me.levelStart

  const setLevel = async (skillLevel: SkillLevel) => {
    try {
      mutate(await rangeApi.updateMe({ skillLevel }), { revalidate: false })
    } catch (error) {
      showErrorMsg(error, t)
    }
  }

  return (
    <div className={classes.card}>
      <div className={classes.rankTop}>
        <RankEmblem rank={me.rankIndex} title={me.rank} />
        <div>
          <div className={classes.levelNumber}>
            <small>{t('range.rank.level_short')}</small>
            {me.level}
          </div>
          <div className={classes.between} style={{ margin: '8px 0 6px' }}>
            <span className={classes.small} style={{ fontWeight: 600 }}>
              {t('range.rank.level_xp')}
            </span>
            <span className={`${classes.small} ${classes.mono} ${classes.dim}`}>
              {inLevel}/{levelSize}
            </span>
          </div>
          <StripedProgress value={Math.round((inLevel / levelSize) * 100)} size="sm" />
        </div>
      </div>

      <div style={{ padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className={classes.tile}>
            <div className={classes.tileValue}>{me.rank}</div>
            <div className={classes.tileLabel}>{t('range.rank.rank')}</div>
          </div>
          <div className={classes.tile}>
            <div className={classes.tileValue}>
              <Xp value={me.xp} />
            </div>
            <div className={classes.tileLabel}>{t('range.rank.total')}</div>
          </div>
        </div>

        <div className={`${classes.small} ${classes.dim}`}>
          {me.nextRank
            ? t('range.rank.next', { rank: me.nextRank.name, xp: me.nextRank.xp - me.xp })
            : t('range.rank.top')}
        </div>

        <div style={{ borderTop: '1px solid var(--r-border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('range.rank.week')}</div>
          <div className={classes.weekXp}>
            <Uicon name="flame-solid" size={30} />
            {t('range.rank.week_xp', { xp: me.weekXp })}
          </div>
        </div>

        <div className={classes.between} style={{ borderTop: '1px solid var(--r-border)', paddingTop: 14 }}>
          <span className={classes.dim}>{t('range.level.label')}</span>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <button type="button" className={classes.chip} style={{ height: 34 }}>
                {me.skillLevel ? t(`range.level.${me.skillLevel}`) : t('range.level.choose')}
                <Uicon name="angle-small-down" />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {SKILL_LEVELS.map((level) => (
                <Menu.Item
                  key={level}
                  leftSection={<Uicon name={SkillLevelIcon[level]} />}
                  onClick={() => setLevel(level)}
                >
                  {t(`range.level.${level}`)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    </div>
  )
}
