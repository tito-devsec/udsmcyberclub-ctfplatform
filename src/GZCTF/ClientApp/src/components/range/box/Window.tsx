import { FC, PointerEvent as ReactPointerEvent, ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '@Styles/AttackBox.module.css'

export type AppName = 'terminal' | 'files' | 'browser' | 'burp' | 'cyberchef' | 'stego' | 'help'

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
  // where the Files window opens
  path?: string
}

// a window is never smaller than this
const MIN_W = 380
const MIN_H = 240
// the edges and corners a window is resized from
const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
type Edge = (typeof EDGES)[number]

interface WindowProps {
  win: WindowState
  // the desktop it sits on, so that it cannot be dragged out of reach
  bounds: { width: number; height: number }
  // the window in front, whose title stands out
  active: boolean
  icon: string
  onChange: (patch: Partial<WindowState>) => void
  onFocus: () => void
  onClose: () => void
  children: ReactNode
}

// A window on the attack box's desktop, drawn like Kali's (its Xfce window frame): the program's
// icon and title, and on the right the hide, fill-the-screen and close buttons. It is dragged by
// its title bar and resized from any edge or corner; a double click fills the screen.
export const Window: FC<WindowProps> = ({ win, bounds, active, icon, onChange, onFocus, onClose, children }) => {
  const { t } = useTranslation()
  const drag = useRef<{
    edge: Edge | 'move'
    x: number
    y: number
    left: number
    top: number
    w: number
    h: number
  } | null>(null)

  const start = (edge: Edge | 'move') => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || win.max) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { edge, x: event.clientX, y: event.clientY, left: win.x, top: win.y, w: win.w, h: win.h }
    // pages shown in windows (the web browser, CyberChef) would catch the mouse on the way
    document.body.dataset.boxDragging = ''
  }
  const stop = () => {
    drag.current = null
    delete document.body.dataset.boxDragging
  }

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const from = drag.current
    if (!from) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    const area = bounds
    if (from.edge === 'move') {
      onChange({
        // the title bar always stays where it can be grabbed
        x: Math.min(Math.max(from.left + dx, 80 - from.w), area.width - 80),
        y: Math.min(Math.max(from.top + dy, 0), area.height - 34),
      })
      return
    }
    let { left: x, top: y, w, h } = from
    if (from.edge.includes('e')) w = Math.max(MIN_W, from.w + dx)
    if (from.edge.includes('s')) h = Math.max(MIN_H, from.h + dy)
    if (from.edge.includes('w')) {
      w = Math.max(MIN_W, from.w - dx)
      x = from.left + from.w - w
    }
    if (from.edge.includes('n')) {
      h = Math.max(MIN_H, from.h - dy)
      y = from.top + from.h - h
      if (y < 0) {
        h += y
        y = 0
      }
    }
    onChange({ x, y, w, h })
  }

  return (
    <section
      className={classes.window}
      data-max={win.max || undefined}
      data-min={win.min || undefined}
      data-active={active || undefined}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={onFocus}
      aria-label={win.title}
    >
      <header
        className={classes.titlebar}
        onPointerDown={start('move')}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onDoubleClick={() => onChange({ max: !win.max })}
      >
        <img className={classes.titleIcon} src={icon} alt="" />
        <div className={classes.title}>{win.title}</div>
        <div className={classes.winButtons} onPointerDown={(event) => event.stopPropagation()}>
          <button
            type="button"
            className={classes.winButton}
            data-kind="min"
            title={t('range.box.window.hide')}
            aria-label={t('range.box.window.hide')}
            onClick={() => onChange({ min: true })}
          />
          <button
            type="button"
            className={classes.winButton}
            data-kind="max"
            title={t('range.box.window.fill')}
            aria-label={t('range.box.window.fill')}
            onClick={() => onChange({ max: !win.max })}
          />
          <button
            type="button"
            className={classes.winButton}
            data-kind="close"
            title={t('range.box.window.close')}
            aria-label={t('range.box.window.close')}
            onClick={onClose}
          />
        </div>
      </header>
      <div className={classes.body}>{children}</div>
      {!win.max &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className={classes.edge}
            data-edge={edge}
            onPointerDown={start(edge)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
          />
        ))}
    </section>
  )
}
