import { FC, SVGProps } from 'react'
import { UICON_SIZE, UiconName, uicons } from '@Utils/Uicons'

export interface UiconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: UiconName
  // width and height, in pixels or any CSS length. By default the icon is as tall as the text around it.
  size?: number | string
}

// An icon from Uicons by Flaticon. It takes the colour of the text around it.
export const Uicon: FC<UiconProps> = ({ name, size = '1em', style, ...others }) => (
  <svg
    viewBox={`0 0 ${UICON_SIZE} ${UICON_SIZE}`}
    width={size}
    height={size}
    fill="currentColor"
    aria-hidden
    focusable={false}
    style={{ flexShrink: 0, overflow: 'visible', ...style }}
    {...others}
  >
    <path d={uicons[name]} />
  </svg>
)
