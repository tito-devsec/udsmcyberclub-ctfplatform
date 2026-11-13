import { FC, PointerEvent as ReactPointerEvent, ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '@Styles/AttackBox.module.css'

export type AppName = 'terminal' | 'files' | 'cyberchef' | 'stego' | 'help'

export interface WindowState {
  id: string
  app: AppName
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  min: boolean
  max: boolean
}

interface WindowProps {
  win: WindowState
  // the desktop it sits on, so that it cannot be dragged out of reach
  bounds: () => { width: number; height: number }
  onChange: (patch: Partial<WindowState>) => void
  onFocus: () => void
  onClose: () => void
  // the app's picture, before the title
  icon?: string
  children: ReactNode
}

// A window on the attack box's desktop: dragged by its title bar, resized from its corner,
// with the close, hide and full-screen lights of the reference desktop.
export const Window: FC<WindowProps> = ({ win, bounds, onChange, onFocus, onClose, icon, children }) => {
  const { t } = useTranslation()
  const drag = useRef<{ x: number; y: number; left: number; top: number; w: number; h: number } | null>(null)

  const start = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || win.max) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, left: win.x, top: win.y, w: win.w, h: win.h }
  }
  const stop = () => {
    drag.current = null
  }

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const from = drag.current
    if (!from) return
    const area = bounds()
    onChange({
      // the title bar always stays where it can be grabbed
      x: Math.min(Math.max(from.left + event.clientX - from.x, 80 - win.w), area.width - 80),
      y: Math.min(Math.max(from.top + event.clientY - from.y, 0), area.height - 34),
    })
  }

  const resize = (event: ReactPointerEvent<HTMLElement>) => {
    const from = drag.current
    if (!from) return
    onChange({
      w: Math.max(360, from.w + event.clientX - from.x),
      h: Math.max(220, from.h + event.clientY - from.y),
    })
  }

  return (
    <section
      className={classes.window}
      data-max={win.max || undefined}
      data-min={win.min || undefined}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={onFocus}
      aria-label={win.title}
    >
      <header
        className={classes.titlebar}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onDoubleClick={() => onChange({ max: !win.max })}
      >
        <div className={classes.lights} onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={classes.light}
            data-kind="close"
            title={t('range.box.window.close')}
            onClick={onClose}
          />
          <button
            type="button"
            className={classes.light}
            data-kind="min"
            title={t('range.box.window.hide')}
            onClick={() => onChange({ min: true })}
          />
          <button
            type="button"
            className={classes.light}
            data-kind="max"
            title={t('range.box.window.fill')}
            onClick={() => onChange({ max: !win.max })}
          />
        </div>
        {icon && <img className={classes.titleIcon} src={icon} alt="" />}
        <div className={classes.title}>{win.title}</div>
        <div style={{ minWidth: 55 }} />
      </header>
      <div className={classes.body}>{children}</div>
      {!win.max && (
        <div
          className={classes.resize}
          onPointerDown={start}
          onPointerMove={resize}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
      )}
    </section>
  )
}
