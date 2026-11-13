import cx from 'clsx'
import { CSSProperties, FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LogoBox } from '@Components/LogoBox'
import { Uicon } from '@Components/Uicon'
import { Category, CategoryIcon, categoryStyle, Difficulty, DifficultyIcon, formatMinutes } from '@Utils/Range'
import { UiconName } from '@Utils/Uicons'
import classes from '@Styles/Range.module.css'

// the same module or lab always gets the same one of the four arrangements of its picture's shapes
export function variantOf(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 4
}

interface CoverProps {
  icon: UiconName
  // what the cover belongs to: decides where its shapes go
  seed: string
  // its colour; none is the club's blue
  category?: Category | null
  square?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

// The picture of a module or path: its icon on a white disc, over flat shapes in its category's colour.
export const Cover: FC<CoverProps> = ({ icon, seed, category, square, className, style, children }) => (
  <div
    className={cx(classes.cover, classes.shapes, className)}
    data-v={variantOf(seed)}
    data-square={square || undefined}
    style={{ ...categoryStyle(category), ...style }}
  >
    <span className={classes.coverDisc}>
      <Uicon name={icon} />
    </span>
    {children}
  </div>
)

interface ProgressProps {
  // 0 to 100
  value: number
  size?: 'sm' | 'md' | 'lg'
  // a category's progress is drawn in its colour
  category?: Category
}

// A flat progress bar.
export const ProgressBar: FC<ProgressProps> = ({ value, size = 'md', category }) => (
  <div
    className={classes.progress}
    data-size={size}
    data-cat={category}
    style={category ? categoryStyle(category) : undefined}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
  >
    <div className={classes.progressFill} style={{ width: value > 0 ? `max(${value}%, 12px)` : 0 }} />
  </div>
)

export const ProgressRow: FC<ProgressProps> = (props) => (
  <div className={classes.progressRow}>
    <ProgressBar {...props} />
    <span className={classes.progressValue}>{props.value}%</span>
  </div>
)

// An amount of XP, with the XP mark in front of it.
export const Xp: FC<{ value: number; plus?: boolean; pill?: boolean }> = ({ value, plus, pill }) => (
  <span className={classes.xp} data-pill={pill || undefined}>
    <span className={classes.xpTag}>XP</span>
    {plus ? '+' : ''}
    {value}
  </span>
)

export const Fact: FC<{ icon?: UiconName; children: ReactNode }> = ({ icon, children }) => (
  <span className={classes.metaItem}>
    {icon && <Uicon name={icon} />}
    {children}
  </span>
)

interface FactsProps {
  difficulty?: Difficulty
  minutes?: number
  xp?: number
  modules?: number
  sections?: number
}

// The line of facts under a title: difficulty | time | XP | modules.
export const Facts: FC<FactsProps> = ({ difficulty, minutes, xp, modules, sections }) => {
  const { t } = useTranslation()
  return (
    <div className={classes.meta}>
      {difficulty && <Fact icon={DifficultyIcon[difficulty]}>{t(`range.difficulty.${difficulty}`)}</Fact>}
      {minutes !== undefined && <Fact icon="clock">{formatMinutes(minutes)}</Fact>}
      {xp !== undefined && (
        <span className={classes.metaItem}>
          <Xp value={xp} />
        </span>
      )}
      {modules !== undefined && <Fact icon="layers">{t('range.count.modules', { count: modules })}</Fact>}
      {sections !== undefined && <Fact icon="list">{t('range.count.sections', { count: sections })}</Fact>}
    </div>
  )
}

// A small capitalised label with an icon; a category's label shows the icon in its colour.
export const Label: FC<{ icon: UiconName; category?: Category; children: ReactNode }> = ({
  icon,
  category,
  children,
}) => (
  <span className={classes.label} data-cat={category} style={category ? categoryStyle(category) : undefined}>
    <Uicon name={icon} size={14} />
    {children}
  </span>
)

export const CategoryLabel: FC<{ category: Category }> = ({ category }) => {
  const { t } = useTranslation()
  return (
    <Label icon={CategoryIcon[category]} category={category}>
      {t(`range.category.${category}`)}
    </Label>
  )
}

export const PathLabel: FC = () => {
  const { t } = useTranslation()
  return <Label icon="route">{t('range.kind.path')}</Label>
}

interface NoteProps {
  icon?: UiconName
  tone?: 'info' | 'warn' | 'done'
  children: ReactNode
}

export const Note: FC<NoteProps> = ({ icon = 'info', tone = 'info', children }) => (
  <div className={classes.note} data-tone={tone}>
    <Uicon name={icon} />
    <div>{children}</div>
  </div>
)

// The foot of every CyberRange page: "Powered by UDSMCYBER" with the club's logo, and the
// credit Flaticon asks for in return for its icons.
export const PoweredBy: FC = () => {
  const { t } = useTranslation()
  return (
    <div className={classes.powered}>
      <span className={classes.credit}>
        Uicons by{' '}
        <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">
          Flaticon
        </a>
      </span>
      {t('range.powered_by')}
      <LogoBox size="26px" />
      <strong>UDSMCYBER</strong>
    </div>
  )
}
